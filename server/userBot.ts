import TelegramBot from "node-telegram-bot-api";
import { db } from "./db";
import { users, battles, roomAccessCodes, verificationCodes } from "@shared/schema";
import { sql, eq, and, gt } from "drizzle-orm";
import crypto from "crypto";
import { processInChunks } from "./utils/async-chunker";
import { BotStateService } from "./services/bot-state.service";

let userBot: TelegramBot | null = null;

// APP_MODE=admin (admin.yozgo.uz konteyneri): Telegram bitta bot token uchun ikkita
// getUpdates poller'ga ruxsat bermaydi (409 Conflict). Shu sababli admin konteynerda
// bot instansiyasi UMUMAN yaratilmaydi (main konteyner yagona poller bo'lib qoladi).
const IS_ADMIN_MODE = (process.env.APP_MODE || "").toLowerCase() === "admin";

export function getUserBot() {
  return userBot;
}

export function startUserBot() {
  const token = process.env.USER_BOT_TOKEN;
  if (!token) {
    console.warn("⚠️ USER_BOT_TOKEN topilmadi — User Bot o'chirildi");
    return;
  }

  // Admin konteynerda POLLING yo'q (bitta token uchun ikkita getUpdates poller
  // 409 Conflict beradi), lekin instansiyaning O'ZI kerak: ommaviy xabar
  // (/api/admin/broadcast) faqat shu konteynerda mavjud, va u userBot orqali
  // yuboradi. Ilgari bu yerda `return` bo'lgani uchun userBot null qolib,
  // broadcast har doim "0 user"ga ketardi. Yuborish uchun polling shart emas.
  if (IS_ADMIN_MODE) {
    userBot = new TelegramBot(token, { polling: false });
    console.log("[userBot] APP_MODE=admin — send-only rejim (polling o'chiq)");
    return;
  }

  // Webhookni birinchi o'chirib, keyin Polling bilan ishga tushirish xavfsizroq
  fetch(`https://api.telegram.org/bot${token}/deleteWebhook`).catch((err) => console.error("Webhook deletion failed:", err));

  userBot = new TelegramBot(token, { 
    polling: { 
      interval: 300,
      autoStart: true,
      params: { timeout: 10 }
    } 
  });
  
  console.log("✅ Foydalanuvchi Boti (User Bot) muvaffaqiyatli ishga tushdi va Polling boshlandi!");

  // Polling xatolarini ushlash (Server qotib qolmasligi uchun eng muhim qism)
  userBot.on("polling_error", (error: any) => {
    if (error.code === "ETELEGRAM" && error.message.includes("401")) {
      console.error("❌ [TELEGRAM ERROR] Bot Tokeni NOTO'G'RI! Polling to'xtatildi.");
      userBot?.stopPolling(); // Xato tokun bilan serverni qiynamaslik uchun to'xtatamiz
    } else {
      console.warn("⚠️ [TELEGRAM WARNING] Polling xatoligi:", error.message);
    }
  });

  // The chat menu button is reset to Telegram's default: the bot no longer
  // opens the site as a mini app.
  try {
    fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menu_button: { type: "default" } }),
    }).catch((err) => console.error("Menu button reset failed:", err));
  } catch (err) {}

  userBot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const param = match && match[1];

    // Saytdan ro'yxat/login deep-link: /start auth_<token>
    if (param && param.startsWith("auth_")) {
      // XAVFSIZLIK: auth oqimi FAQAT shaxsiy chatda. Guruhda ruxsat berilsa holat
      // guruh chatId'siga yozilib, boshqa a'zoning kontakti begona tokenga bog'lanadi
      // va 6 xonali kod guruhga (token egasiga ko'rinadigan joyga) yuboriladi.
      if (msg.chat.type !== "private") {
        userBot?.sendMessage(chatId, "❌ Tasdiqlash faqat bot bilan shaxsiy chatda ishlaydi.");
        return;
      }
      await handleAuthToken(chatId, param.slice(5), msg.from?.id);
      return;
    }

    // Tashlab qo'yilgan auth jarayoni holatini tozalaymiz (room-code va oddiy /start
    // yo'llarida) — aks holda keyingi matnlar auth branch'ga urilib, xona-kod oqimi
    // qator eskirguncha ishlamay qoladi.
    const st = await BotStateService.getState(chatId);
    if (st?.type === "auth_phone") await BotStateService.clearState(chatId);

    if (param) {
      await handleRoomCode(chatId, param, msg.from?.id);
      return;
    }

    const text =
      `Assalomu alaykum, ${msg.chat.first_name || "foydalanuvchi"}! 🦁\n\n` +
      `YOZGO — O'zbekistonning birinchi va yagona terma-yozish raqobat platformasiga xush kelibsiz!\n\n` +
      `Musobaqada ishtirok etish uchun xona kodini botga yuboring (masalan: OHSVEW).`;

    userBot?.sendMessage(chatId, text);
  });

  userBot.on("message", async (msg) => {
    try {
      if (!msg.text && !msg.contact && !msg.location && !msg.photo) return;
      const chatId = msg.chat.id;
      const state = await BotStateService.getState(chatId);

      // Auth oqimi: telefon raqami kutilyapti (register/login deep-link'dan keyin).
      // MUHIM: winner_data va room-code fallback'dan OLDIN — auth holatidagi contact/text
      // boshqa branch'larga tushmasin (branch oxirida return).
      if (state?.type === "auth_phone") {
        // Auth oqimi faqat shaxsiy chatda (qo'shimcha himoya — /start'dagi guard bilan bir xil sabab).
        if (msg.chat.type !== "private") return;

        // A NEWER token pasted while an old attempt is still pending must win.
        // Otherwise this branch swallows it with "press the phone button" and
        // the user is stuck on a stale attempt until the row expires — which is
        // what made retrying feel impossible without a page reload.
        const restart = msg.text?.match(/\bauth_([a-f0-9]{32})\b/i) || msg.text?.match(/^([a-f0-9]{32})$/i);
        if (restart) {
          await handleAuthToken(chatId, restart[1].toLowerCase(), msg.from?.id);
          return;
        }

        if (msg.contact) {
          // Faqat O'ZINING kontakti qabul qilinadi. Forward qilingan begona kontakt
          // user_id=undefined yoki boshqa id bilan keladi — ikkalasi ham rad etiladi.
          if (msg.contact.user_id !== msg.from?.id) {
            userBot?.sendMessage(chatId, "❌ Iltimos O'ZINGIZNING raqamingizni yuboring (tugma orqali).");
            return;
          }
          const [row] = await db.select().from(verificationCodes).where(and(
            eq(verificationCodes.id, state.rowId),
            gt(verificationCodes.expiresAt, new Date()),
          ));
          if (!row) {
            await BotStateService.clearState(chatId);
            userBot?.sendMessage(chatId, "❌ Havola eskirgan. Iltimos saytdan qayta urinib ko'ring.", {
              reply_markup: { remove_keyboard: true },
            });
            return;
          }
          await db.update(verificationCodes)
            .set({ telegramId: String(msg.from!.id), phone: msg.contact.phone_number })
            .where(eq(verificationCodes.id, row.id));
          await BotStateService.clearState(chatId);
          userBot?.sendMessage(
            chatId,
            `✅ Telegram tasdiqlandi!\n\nTasdiqlash kodingiz:\n\n\`${row.code}\`\n\n👆 Kodni saytdagi maydonga kiriting.`,
            { parse_mode: "Markdown", reply_markup: { remove_keyboard: true } },
          );
        } else if (msg.text && !msg.text.startsWith("/")) {
          // Qator eskirgan bo'lsa holatni tozalaymiz — aks holda foydalanuvchi auth'ni
          // tashlab ketganidan keyin HAR matn (xona kodi ham) shu branch'da qolib ketadi.
          const [row] = await db.select().from(verificationCodes).where(and(
            eq(verificationCodes.id, state.rowId),
            gt(verificationCodes.expiresAt, new Date()),
          ));
          if (!row) {
            await BotStateService.clearState(chatId);
            userBot?.sendMessage(chatId, "❌ Tasdiqlash havolasi eskirgan. Saytdan qayta urinib ko'ring yoki xona kodini yuboring.", {
              reply_markup: { remove_keyboard: true },
            });
          } else {
            userBot?.sendMessage(chatId, "📱 Iltimos «Raqamni yuborish» tugmasini bosing (matn emas).");
          }
        }
        return;
      }

      // Winner Data Collection Flow
      if (state?.type === "winner_data") {
        if (state.step === "phone") {
          if (msg.contact?.phone_number || msg.text) {
            state.phone = msg.contact?.phone_number || msg.text;
            state.step = "location";
            // The mutated object must be written back. Without this the stored
            // state stayed on step "phone" forever, so this branch re-ran on
            // every message and the `return` below swallowed everything the
            // user sent afterwards — including room codes. Anyone who had ever
            // been sent a winner message could never use the bot again.
            await BotStateService.setState(chatId, state);
            userBot?.sendMessage(
              chatId,
              "📍 Endi manzilingizni yuboring (Location jo'nating yoki matn ko'rinishida yozing):",
              {
                reply_markup: {
                  keyboard: [[{ text: "Manzilni yuborish 📍", request_location: true }]],
                  resize_keyboard: true,
                  one_time_keyboard: true,
                },
              }
            );
          }
        } else if (state.step === "location") {
          if (msg.location || msg.text) {
            state.location = msg.location
              ? `${msg.location.latitude}, ${msg.location.longitude}`
              : msg.text;
            state.step = "photo";
            await BotStateService.setState(chatId, state);
            userBot?.sendMessage(
              chatId,
              "🤳 Pasport yoki ID karta rasmini yuboring (Sovrin topshirilishi uchun majburiy):",
              {
                reply_markup: { remove_keyboard: true },
              }
            );
          }
        } else if (state.step === "photo") {
          if (msg.photo) {
            state.photo = msg.photo[msg.photo.length - 1].file_id;
            userBot?.sendMessage(
              chatId,
              "✅ Rahmat! Ma'lumotlaringiz adminga yuborildi. Tez orada siz bilan bog'lanamiz!"
            );

            // Forward to Admin
            const adminBotToken = process.env.ADMIN_BOT_TOKEN;
            const adminIdStr = process.env.ADMIN_CHAT_ID || process.env.ADMIN_TELEGRAM_ID;
            if (adminBotToken && adminIdStr) {
              const adminMsg = `📦 G'olibdan ma'lumotlar keldi: ${msg.from?.first_name || "Noma'lum"}\n📱 Tel: ${state.phone}\n📍 Manzil: ${state.location}`;
              fetch(`https://api.telegram.org/bot${adminBotToken}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: adminIdStr,
                  photo: state.photo,
                  caption: adminMsg
                })
              }).catch(e => console.error("Admin botga rasm yuborishda xato:", e));
            }
            await BotStateService.clearState(chatId);
          } else {
            userBot?.sendMessage(chatId, "Iltimos rasm formatida yuboring.");
          }
        }
        return;
      }

      // Xona kodini matndan tutib olishni KUCHAYTIRDIK
      if (msg.text && !msg.text.startsWith("/")) {
        const text = msg.text.trim();

        // MANUAL AUTH FALLBACK.
        // The deep link (t.me/bot?start=auth_<token>) only delivers its payload
        // when Telegram itself opens the chat. Pressing "START BOT" on the
        // t.me web page — which is what a desktop browser shows — frequently
        // drops it, and then the phone prompt never appears and registration
        // dead-ends. So the same token is accepted as a pasted message: the
        // site shows it with a copy button, and the user can finish from any
        // device, including their phone, without the link working at all.
        const authMatch = text.match(/\bauth_([a-f0-9]{32})\b/i) || text.match(/^([a-f0-9]{32})$/i);
        if (authMatch) {
          await handleAuthToken(chatId, authMatch[1].toLowerCase(), msg.from?.id);
          return;
        }

        let extractedCode = "";

        const match = text.match(/Asl Xona Kodi:\s*([A-Za-z0-9]{4,10})/i);
        if (match && match[1]) {
          extractedCode = match[1];
        } else {
          // Qanday formatda yozsa ham, 4-10 harfli kodni qidirib topadi
          const words = text.toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/);
          const possibleCode = words.find(w => w.length >= 4 && w.length <= 10);
          if (possibleCode) {
             extractedCode = possibleCode;
          }
        }

        if (extractedCode) {
          await handleRoomCode(chatId, extractedCode, msg.from?.id);
        } else {
          userBot?.sendMessage(chatId, "⚠️ Xabar ichidan yaroqli xona kodi topilmadi. Faqat saytdagi 5 xonali kodni yuboring.");
        }
      }
    } catch (e: any) {
      console.error("userBot message handler error:", e);
      userBot?.sendMessage(msg.chat.id, `❌ KUTILMAGAN XATOLIK: ${e.message}`);
    }
  });

  userBot.on("callback_query", async (query) => {
    if (!query.message) return;
    const chatId = query.message.chat.id;

    if (query.data?.startsWith("check_subs_")) {
      const battleId = query.data.replace("check_subs_", "");
      try {
        const uId = query.from.id;
        
        // Kanal ulanishidan holi tizim -> Endi to'g'ridan-to'g'ri kod yaratadi
        userBot?.answerCallbackQuery(query.id, { text: "So'rov qayta ishlanyapti... ✅" });
        await generateAndSendRoomCode(battleId, uId, chatId);
      } catch (err: any) {
        userBot?.sendMessage(chatId, "Xatolik: " + err.message);
      }
    }
  });
}

// Saytdagi register/login deep-link: token tekshirilgach AVVAL telefon raqami so'raladi
// (request_contact). Kontakt kelgach (message handler'dagi auth_phone branch) telegram_id
// + phone bog'lanadi va tasdiqlash kodi yuboriladi. Method A: bot Start bosmagan userга
// yozolmaydi — user Start bosgani uchun endi yozа olamiz.
async function handleAuthToken(chatId: number, token: string, tgUserId?: number) {
  if (!tgUserId) return;
  const [row] = await db.select().from(verificationCodes).where(and(
    eq(verificationCodes.channel, "telegram"),
    eq(verificationCodes.token, token),
    gt(verificationCodes.expiresAt, new Date()),
  ));
  if (!row) {
    userBot?.sendMessage(chatId, "❌ Havola eskirgan yoki yaroqsiz. Iltimos saytdan qayta urinib ko'ring.");
    return;
  }
  // Qayta /start yangi token bilan kelsa setState upsert qiladi — eski jarayon bekor bo'ladi.
  await BotStateService.setState(chatId, { type: "auth_phone", token, rowId: row.id });
  userBot?.sendMessage(
    chatId,
    "📱 Tasdiqlash uchun telefon raqamingizni yuboring (quyidagi tugmani bosing):",
    {
      reply_markup: {
        keyboard: [[{ text: "Raqamni yuborish 📱", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    },
  );
}

async function handleRoomCode(chatId: number, code: string, tgUserId?: number) {
  if (!tgUserId) return;
  const [battle] = await db.select().from(battles).where(eq(battles.code, code));
  
  if (!battle) {
    userBot?.sendMessage(chatId, `❌ Xona topilmadi yoki yopilgan! (Siz kiritgan kod: ${code})`);
    return;
  }

  if (battle.status === "finished") {
    userBot?.sendMessage(chatId, "❌ Bu musobaqa allaqachon yakunlangan!");
    return;
  }

  // Tizim admin xabariga bog'lanmaganligi sababli, 
  // User Botga kelgan kod bo'yicha to'g'ridan-to'g'ri individual kodni generatsiya qilamiz.
  await generateAndSendRoomCode(battle.id, tgUserId, chatId);
}

/**
 * Mints a one-time room access code bound to a specific site account.
 *
 * Split out of generateAndSendRoomCode so the friend-invite path can mint a
 * code and hand it to the in-app notification — clicking that notification
 * previously landed on the battle menu with no code, which is why an invited
 * friend could never actually get into the room.
 */
export async function mintRoomAccessCode(battleId: string, userId: string): Promise<string> {
  const code = crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 characters
  await db.insert(roomAccessCodes).values({ roomId: battleId, userId, code });
  return code;
}

// Kod yaratish va DB xatolarini KUCHAYTIRDIK
export async function generateAndSendRoomCode(
  battleId: string,
  telegramId: number,
  chatId: number
) {
  // The code must belong to the Telegram user who asked for it. This used to
  // take `db.select().from(users).limit(1)` — an arbitrary row — so every code
  // was stamped with the same unrelated account and `telegramId` was ignored
  // entirely. Map the Telegram id to the site account instead.
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.telegramId, String(telegramId)));

  if (!owner) {
    await userBot?.sendMessage(
      chatId,
      "❌ Bu Telegram hisobi saytdagi akkauntga bog'lanmagan.\n\nAvval yozgo.uz'da ro'yxatdan o'ting yoki Telegram orqali kiring, so'ng kodni qayta yuboring.",
    );
    return;
  }

  try {
    const code = await mintRoomAccessCode(battleId, owner.id);

    const text = `🎉 Sizning kirish kodingiz:\n\n\`${code}\`\n\n👆 Yuqoridagi kod ustiga bir marta bossangiz avtomatik nusxalanadi.\nSaytdagi maydonga kiritib jangga qo'shiling. Kod bir martalik!`;

    // Awaited: an un-awaited send meant a blocked bot / Markdown error rejected
    // outside this try, so the row was already written, the user got nothing,
    // and the failure only surfaced in the unhandledRejection log.
    await userBot?.sendMessage(chatId, text, { parse_mode: "Markdown" });
  } catch (err: any) {
    console.error("Kod generatsiya xatosi:", err.message);
    
    // DB unique xatosi bo'lsa darhol telegramga yozadi
    if (err.message.includes("unique") || err.message.includes("duplicate")) {
       userBot?.sendMessage(chatId, `⚠️ **BAZADA XATOLIK MAVJUD!**\nOldin kiritilgan o'zgarishlar Ma'lumotlar Bazasiga saqlanmagan.\n\nIltimos server/render terminaliga kirib quyidagi buyruqni bering:\n\n\`npm run db:push\``, { parse_mode: "Markdown" });
    } else {
       userBot?.sendMessage(chatId, `❌ Kod yaratishda xatolik yuz berdi: ${err.message}`);
    }
  }
}

export async function sendMessageToWinner(telegramId: number, text: string) {
  if (!userBot) return;

  // Custom winner collection logic starts here if text contains specific trigger?
  // Actually, we should trigger winner data collection explicitly when winner is chosen.
  // We'll let admin write the custom message, and then we ALSO ask for phone.

  await userBot.sendMessage(telegramId, `Yangi xabar (Admindan):\n\n${text}`);

  // Set state to collect winner info
  await BotStateService.setState(telegramId, { type: "winner_data", step: "phone" });

  userBot.sendMessage(
    telegramId,
    "🎉 Tabriklaymiz! Sovrin olish uchun quyidagi ma'lumotlarni yuboring:\n\n1. 📱 Telefon raqamingizni yuboring (Tugmani bosing yoki yozing):",
    {
      reply_markup: {
        keyboard: [[{ text: "Raqamni yuborish 📱", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );
}


/**
 * Har qanday muayyan foydalanuvchiga bitta erkin matnli xabar (best-effort) —
 * do'st so'rovi/qabul qilinishi kabi past-hajmli hodisalar uchun. Xato bo'lsa
 * jim o'tkaziladi — sayt oqimini to'xtatmasin.
 */
export async function notifyUser(telegramId: number, text: string) {
  if (!userBot) return;
  try {
    await userBot.sendMessage(telegramId, text);
  } catch {
    /* jim o'tkazamiz */
  }
}

export async function broadcastFromUserBot(text: string) {
  if (!userBot) return { success: 0, fail: 0, text: "Foydalanuvchi boti ulanmagan" };
  let success = 0,
    fail = 0;
  try {
    const t_users = await db.execute(
      sql`SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL`
    );

    // Event Loop'ni bloklamasdan Telegram xabar yuborish
    await processInChunks(t_users.rows, 50, 1000, async (u: any) => {
      if (u.telegram_id) {
        try {
          await userBot!.sendMessage(u.telegram_id as number, `Yangi Xabar:\n\n${text}`);
          success++;
        } catch (e) {
          fail++;
        }
      }
    });
  } catch (err) {
    return { success, fail, text: "Xatolik yuz berdi." };
  }
  return {
    success,
    fail,
    text: `Xabar muvaffaqiyatli ${success} kishiga yuborildi. (${fail} ta xato)`,
  };
}
