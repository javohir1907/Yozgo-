import TelegramBot from "node-telegram-bot-api";
import { db } from "./db";
import { users, battles, roomAccessCodes, adminMessages } from "@shared/schema";
import { isNotNull, sql, eq, and } from "drizzle-orm";
import crypto from "crypto";
import { processInChunks } from "./utils/async-chunker";
import { BotStateService } from "./services/bot-state.service";

let userBot: TelegramBot | null = null;
const MINI_APP_URL = process.env.VITE_API_BASE_URL?.replace("/api", "") || "https://yozgo.uz";

export function getUserBot() {
  return userBot;
}

export function startUserBot() {
  const token = process.env.USER_BOT_TOKEN;
  if (!token) {
    console.warn("⚠️ USER_BOT_TOKEN topilmadi — User Bot o'chirildi");
    return;
  }

  // Webhookni birinchi o'chirib, keyin Polling bilan ishga tushirish xavfsizroq
  fetch(`https://api.telegram.org/bot${token}/deleteWebhook`).catch(() => {});

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

  try {
    fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: {
          type: "web_app",
          text: "O'ynash 🚀",
          web_app: { url: MINI_APP_URL },
        },
      }),
    }).catch(() => {});
  } catch (err) {}

  userBot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const param = match && match[1];

    if (param) {
      await handleRoomCode(chatId, param, msg.from?.id);
      return;
    }

    const text =
      `Assalomu alaykum, ${msg.chat.first_name || "foydalanuvchi"}! 🦁\n\n` +
      `YOZGO — O'zbekistonning birinchi va yagona terma-yozish raqobat platformasiga xush kelibsiz!\n\n` +
      `Musobaqada ishtirok etish uchun xona kodini botga yuboring (masalan: OHSVEW).`;

    const opts = {
      reply_markup: {
        inline_keyboard: [[{ text: "🎯 Yozgoga kirish", web_app: { url: "https://yozgo.uz" } }]],
      },
    };

    userBot?.sendMessage(chatId, text, opts);
  });

  userBot.on("message", async (msg) => {
    try {
      if (!msg.text && !msg.contact && !msg.location && !msg.photo) return;
      const chatId = msg.chat.id;
      const state = await BotStateService.getState(chatId);

      // Winner Data Collection Flow
      if (state?.type === "winner_data") {
        if (state.step === "phone") {
          if (msg.contact?.phone_number || msg.text) {
            state.phone = msg.contact?.phone_number || msg.text;
            state.step = "location";
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

// Kod yaratish va DB xatolarini KUCHAYTIRDIK
export async function generateAndSendRoomCode(
  battleId: string,
  telegramId: number,
  chatId: number
) {
  const [firstUser] = await db.select().from(users).limit(1);
  const dummyUserId = firstUser?.id;

  if (!dummyUserId) {
    userBot?.sendMessage(chatId, "❌ Tizimda asosiy foydalanuvchi topilmadi. Iltimos saytdan ro'yxatdan o'ting.");
    return;
  }

  try {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 characters
    await db.insert(roomAccessCodes).values({
      roomId: battleId,
      userId: dummyUserId, // Buni ishlashi uchun schema.ts dagi UNIQUE o'chgan bo'lishi kerak
      code: code,
    });

    const text = `🎉 Sizning kirish kodingiz:\n\n\`${code}\`\n\n👆 Yuqoridagi kod ustiga bir marta bossangiz avtomatik nusxalanadi.\nSaytdagi maydonga kiritib jangga qo'shiling. Kod bir martalik!`;

    userBot?.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "📲 Jangga kirish", web_app: { url: `${MINI_APP_URL}/battle` } }]],
      },
    });
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
