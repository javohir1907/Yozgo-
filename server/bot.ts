import TelegramBot from "node-telegram-bot-api";
import { db } from "./db";
import { advertisements, competitions } from "@shared/schema";
import { sql, eq, desc, isNotNull } from "drizzle-orm";
import { storage } from "./storage";
import { sendEmail } from "./mailer";
import { processInChunks } from "./utils/async-chunker";
import { BotStateService } from "./services/bot-state.service";

let bot: TelegramBot | null = null;

export function getAdminBot() {
  return bot;
}

function parseUzbekDate(input: string): Date | null {
  try {
    const clean = input.trim();
    let match = clean.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
    if (match) return new Date(clean);

    match = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (match)
      return new Date(
        `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}T00:00:00Z`
      );

    const map: Record<string, string> = {
      yanvar: "01",
      fevral: "02",
      mart: "03",
      aprel: "04",
      may: "05",
      iyun: "06",
      iyul: "07",
      avgust: "08",
      sentyabr: "09",
      oktyabr: "10",
      noyabr: "11",
      dekabr: "12",
    };

    for (const [uz, num] of Object.entries(map)) {
      if (clean.toLowerCase().includes(uz)) {
        const dMatch = clean.match(/(\d{1,2})/);
        const yMatch = clean.match(/(\d{4})/);
        if (dMatch && yMatch) {
          return new Date(`${yMatch[1]}-${num}-${dMatch[1].padStart(2, "0")}T00:00:00Z`);
        }
      }
    }
    const d = new Date(clean);
    if (!isNaN(d.getTime())) return d;
  } catch (e) {}
  return null;
}

export function startBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const adminIdStr = process.env.ADMIN_TELEGRAM_ID;

  if (!token) return;
  const adminId = adminIdStr ? parseInt(adminIdStr, 10) : 0;

  bot = new TelegramBot(token, { polling: true });
  console.log("Telegram Admin Bot successfully started in node backend");

  const isAdmin = (msg: TelegramBot.Message) => {
    if (msg.chat.id !== adminId) {
      bot?.sendMessage(msg.chat.id, "Sizda bu botdan foydalanish huquqi yo'q.", {
        parse_mode: "HTML",
      });
      return false;
    }
    return true;
  };

  bot.onText(/^\/start$/, async (msg) => {
    if (!isAdmin(msg)) return;
    const text =
      "Boshqaruv paneliga xush kelibsiz.\n\n" +
      "Buyruqlar ro'yxati:\n\n" +
      "/stats - Barcha statistik ma'lumotlar\n" +
      "/foydalanuvchilar - Oxirgi 10 ta foydalanuvchi\n\n" +
      "/reklama - Yangi reklama qo'shish\n" +
      "/reklama_list - Barcha reklamalar ro'yxati\n\n" +
      "/musobaqa_och - Yangi musobaqa ochish\n" +
      "/musobaqa_list - Barcha musobaqalar ro'yxati\n\n" +
      "/xabar - Barcha foydalanuvchilarga xabar yuborish\n" +
      "/bekor - Har qanday jarayonni to'xtatish";

    const opts = {
      parse_mode: "HTML" as const,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Statistika", callback_data: "cmd_stats" },
            { text: "Musobaqalar", callback_data: "cmd_musobaqa_list" },
          ],
          [
            { text: "Reklamalar", callback_data: "cmd_reklama_list" },
            { text: "Foydalanuvchilar", callback_data: "cmd_foydalanuvchilar" },
          ],
        ],
      },
    };
    bot?.sendMessage(msg.chat.id, text, opts);
  });

  const sendStats = async (chatId: number) => {
    await bot?.sendMessage(chatId, "Yuklanmoqda...", { parse_mode: "HTML" });
    try {
      const stats = await db.execute(sql`
        SELECT 
          (SELECT count(*) FROM users) as total_users,
          (SELECT count(*) FROM users WHERE date(created_at) = current_date) as today_users,
          (SELECT count(*) FROM users WHERE created_at >= date_trunc('week', current_date)) as week_users,
          (SELECT count(*) FROM users WHERE created_at >= date_trunc('month', current_date)) as month_users,
          (SELECT count(*) FROM test_results) as total_tests,
          (SELECT count(*) FROM test_results WHERE date(created_at) = current_date) as today_tests,
          (SELECT coalesce(round(avg(wpm)), 0) FROM test_results) as avg_wpm,
          (SELECT count(*) FROM competitions WHERE is_active = true) as active_comps,
          (SELECT count(*) FROM competitions) as total_comps
      `);

      const maxWpmRecord = await db.execute(sql`
        SELECT t.wpm, u.email, u.first_name 
        FROM test_results t 
        JOIN users u ON t.user_id = u.id 
        ORDER BY t.wpm DESC 
        LIMIT 1
      `);

      const r = stats.rows[0] as any;
      let maxWpmText = "Mavjud emas";
      if (maxWpmRecord.rows.length > 0) {
        const m = maxWpmRecord.rows[0] as any;
        maxWpmText = `${m.wpm} (${m.first_name || m.email.split("@")[0]})`;
      }

      const text =
        "Batafsil Statistika:\n\n" +
        `- Jami foydalanuvchilar: ${r.total_users} ta\n` +
        `- Bugun qo'shilganlar: ${r.today_users} ta\n` +
        `- Bu hafta qo'shilganlar: ${r.week_users} ta\n` +
        `- Bu oy qo'shilganlar: ${r.month_users} ta\n\n` +
        `- Jami testlar: ${r.total_tests} ta\n` +
        `- Bugungi testlar: ${r.today_tests} ta\n` +
        `- O'rtacha WPM: ${r.avg_wpm}\n` +
        `- Eng yuqori WPM: ${maxWpmText}\n\n` +
        `- Aktiv musobaqalar: ${r.active_comps} ta\n` +
        `- Jami o'tkazilgan musobaqalar: ${r.total_comps} ta`;

      bot?.sendMessage(chatId, text, { parse_mode: "HTML" });
    } catch (e) {
      bot?.sendMessage(chatId, "Xatolik yuz berdi: " + (e as any).message);
    }
  };

  bot.onText(/^\/stats$/, (msg) => {
    if (!isAdmin(msg)) return;
    sendStats(msg.chat.id);
  });

  const sendUsersList = async (chatId: number) => {
    await bot?.sendMessage(chatId, "Yuklanmoqda...", { parse_mode: "HTML" });
    try {
      const usersList = await db.execute(sql`
        SELECT 
          u.id, u.first_name, u.email, u.created_at,
          (SELECT count(*) FROM test_results t WHERE t.user_id = u.id) as total_tests,
          (SELECT max(wpm) FROM test_results t WHERE t.user_id = u.id) as max_wpm
        FROM users u
        ORDER BY u.created_at DESC
        LIMIT 10
      `);

      if (usersList.rows.length === 0) {
        bot?.sendMessage(chatId, "Foydalanuvchilar topilmadi.");
        return;
      }

      for (const u of usersList.rows as any[]) {
        const dateStr = new Date(u.created_at).toLocaleString("uz-UZ");
        const text =
          `- ID: ${u.id}\n` +
          `- Ismi: ${u.first_name || u.email.split("@")[0]}\n` +
          `- Email: ${u.email}\n` +
          `- Ro'yxatdan o'tgan sana: ${dateStr}\n` +
          `- Jami testlari soni: ${u.total_tests || 0} ta\n` +
          `- Eng yuqori WPM natijasi: ${u.max_wpm || 0}`;
        await bot?.sendMessage(chatId, text);
      }
    } catch (e) {
      bot?.sendMessage(chatId, "Xatolik yuz berdi: " + (e as any).message);
    }
  };

  bot.onText(/^\/foydalanuvchilar$/, (msg) => {
    if (!isAdmin(msg)) return;
    sendUsersList(msg.chat.id);
  });

  bot.onText(/^\/bekor$/, async (msg) => {
    if (!isAdmin(msg)) return;
    await BotStateService.clearState(msg.chat.id);
    bot?.sendMessage(msg.chat.id, "Barcha buyruqlar bekor qilindi.", { parse_mode: "HTML" });
  });

  // ========== Ommaviy Xabar ==========
  bot.onText(/^\/xabar(?:\s+(.+))?$/, async (msg, match) => {
    if (!isAdmin(msg)) return;
    const textInfo = match && match[1];
    if (textInfo) {
      await BotStateService.setState(msg.chat.id, { type: "xabar", text: textInfo });
      const confirmMsg =
        "Diqqat! Quyidagi xabar barcha botga ulangan foydalanuvchilarga yuboriladi:\n\n" +
        `${textInfo}\n\n` +
        "Tasdiqlaysizmi?";
      const opts = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Ha, yuborish", callback_data: "x_yes" }],
            [{ text: "Bekor qilish", callback_data: "m_no" }],
          ],
        },
      };
      bot?.sendMessage(msg.chat.id, confirmMsg, opts);
    } else {
      await BotStateService.setState(msg.chat.id, { type: "xabar" });
      bot?.sendMessage(
        msg.chat.id,
        "Barcha foydalanuvchilarga jo'natiladigan xabar matnini kiriting:",
        { parse_mode: "HTML" }
      );
    }
  });

  // ========== REKLAMA CREATION ==========
  bot.onText(/^\/reklama$/, async (msg) => {
    if (!isAdmin(msg)) return;
    await BotStateService.setState(msg.chat.id, { type: "reklama", step: "title" });
    bot?.sendMessage(msg.chat.id, "Yangi reklama.\n\n1. Homiy nomi yoki sarlavhani kiriting:", {
      parse_mode: "HTML",
    });
  });

  // ========== MUSOBAQA CREATION ==========
  bot.onText(/^\/musobaqa_och$/, async (msg) => {
    if (!isAdmin(msg)) return;
    await BotStateService.setState(msg.chat.id, { type: "musobaqa", step: "title" });
    bot?.sendMessage(msg.chat.id, "Yangi musobaqa ochish.\n\n1. Musobaqa nomini kiriting:", {
      parse_mode: "HTML",
    });
  });

  bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    const state = await BotStateService.getState(msg.chat.id);
    if (!state) return;

    if (state.type === "xabar") {
      const confirmMsg =
        "Diqqat! Quyidagi xabar barcha botga ulangan foydalanuvchilarga yuboriladi:\n\n" +
        `${msg.text}\n\n` +
        "Tasdiqlaysizmi?";
      state.text = msg.text;
      await BotStateService.setState(msg.chat.id, state);
      const opts = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Ha, yuborish", callback_data: "x_yes" }],
            [{ text: "Bekor qilish", callback_data: "m_no" }],
          ],
        },
      };
      bot?.sendMessage(msg.chat.id, confirmMsg, opts);
    } else if (state.type === "reklama") {
      state.title = msg.text;
      state.step = "image";
      await BotStateService.setState(msg.chat.id, state);
      bot?.sendMessage(msg.chat.id, "2. Reklama rasmi (URL orqali tashlang):");
    } else if (state.step === "image") {
      state.imageUrl = msg.text;
      state.step = "link";
      await BotStateService.setState(msg.chat.id, state);
      bot?.sendMessage(msg.chat.id, "3. Havola (Bosganda qayerga o'tishi kerakligini kiriting):");
    } else if (state.step === "link") {
      state.linkUrl = msg.text;
      state.step = "desc";
      await BotStateService.setState(msg.chat.id, state);
      bot?.sendMessage(
        msg.chat.id,
        "4. Qisqa tavsif kiriting (majburiy emas, bo'sh qoldirish uchun nuqta qo'ying):"
      );
    } else if (state.step === "desc") {
      state.description = msg.text === "." ? "" : msg.text;
      state.step = "confirm";
      await BotStateService.setState(msg.chat.id, state);

      const preview =
        `Homiy nomi: ${state.title}\n` +
        `Rasm havolasi: ${state.imageUrl}\n` +
        `Havola URL: ${state.linkUrl}\n` +
        `Tavsif: ${state.description}\n\n` +
        "Ushbu reklamani tasdiqlaysizmi?";

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Ha, joylash", callback_data: "r_yes" }],
            [{ text: "Bekor qilish", callback_data: "r_no" }],
          ],
        },
      };
      bot?.sendMessage(msg.chat.id, preview, opts);
    } else if (state.type === "musobaqa") {
      if (state.step === "title") {
        state.title = msg.text;
        state.step = "date";
        await BotStateService.setState(msg.chat.id, state);
        bot?.sendMessage(
          msg.chat.id,
          "2. Sanani kiriting.\n\n" +
            "Istalgan formatda yozishingiz mumkin. Masalan:\n" +
            "- 2026-04-01\n" +
            "- 01.04.2026\n" +
            "- 1 aprel 2026\n\n" +
            "Agar noto'g'ri bo'lsa, tizim o'zi xabar beradi."
        );
      } else if (state.step === "date") {
        const d = parseUzbekDate(msg.text);
        if (!d) {
          bot?.sendMessage(
            msg.chat.id,
            "Kiritilgan sana formati noto'g'ri. Iltimos to'g'ri sanani kiriting.\n\n" +
              "To'g'ri namuna: 01.04.2026 yoki 2026-04-01"
          );
          return;
        }
        state.date = d.toISOString();
        state.step = "prize";
        await BotStateService.setState(msg.chat.id, state);
        bot?.sendMessage(
          msg.chat.id,
          `Sanasi qabul qilindi: ${d.toLocaleDateString("uz-UZ")}\n\n` +
            `3. Musobaqa sovrinini kiriting:`
        );
      } else if (state.step === "prize") {
        state.prize = msg.text;
        state.step = "confirm";
        await BotStateService.setState(msg.chat.id, state);

        const preview =
          `Musobaqa nomi: ${state.title}\n` +
          `Sanasi: ${new Date(state.date).toLocaleDateString("uz-UZ")}\n` +
          `Sovrin: ${state.prize}\n\n` +
          "Barcha ma'lumotlar to'g'rimi?";

        const opts = {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Tasdiqlash", callback_data: "m_yes" }],
              [{ text: "Bekor qilish", callback_data: "m_no" }],
            ],
          },
        };
        bot?.sendMessage(msg.chat.id, preview, opts);
      }
    } else if (state.type === "msg_winner") {
      try {
        const { sendMessageToWinner, getUserIdByTelegram } = require("./userBot");
        // Save to DB
        const { db } = require("./db");
        const { adminMessages } = require("@shared/schema");
        await db.insert(adminMessages).values({
          fromAdmin: true,
          toUserId: state.winnerUserId,
          message: msg.text,
        });

        // Try getting telegram ID of user
        const { sql } = require("drizzle-orm");
        const uRes = await db.execute(
          sql`SELECT telegram_id FROM users WHERE id = ${state.winnerUserId}`
        );
        const tId = uRes.rows[0]?.telegram_id;

        if (tId) {
          await sendMessageToWinner(tId, msg.text);
          bot?.sendMessage(msg.chat.id, "Xabar g'olibga yuborildi.");
        } else {
          bot?.sendMessage(
            msg.chat.id,
            "Foydalanuvchining Telegram ID si topilmadi. U botdan kirmagan bo'lishi mumkin."
          );
        }
      } catch (e: any) {
        bot?.sendMessage(msg.chat.id, "Xatolik: " + e.message);
      }
      await BotStateService.clearState(msg.chat.id);
    }
  });

  bot.on("callback_query", async (query) => {
    if (!query.message) return;
    const chatId = query.message.chat.id;
    const state = await BotStateService.getState(chatId);
    bot?.answerCallbackQuery(query.id);

    if (query.data === "cmd_stats") return sendStats(chatId);
    if (query.data === "cmd_foydalanuvchilar") return sendUsersList(chatId);
    if (query.data === "cmd_musobaqa_list") return sendMusobaqaList(chatId);
    if (query.data === "cmd_reklama_list") return sendReklamaList(chatId);

    if (query.data === "r_no" || query.data === "m_no") {
      await BotStateService.clearState(chatId);
      bot?.sendMessage(chatId, "Bekor qilindi.");
      return;
    }

    if (query.data === "x_yes" && state?.type === "xabar") {
      await bot?.sendMessage(chatId, "Yuklanmoqda...");
      try {
        const { notifications } = require("@shared/schema");
        await db.insert(notifications).values({
          title: "Yozgo Administratori",
          message: state.text,
        });

        const { broadcastFromUserBot } = require("./userBot");
        const result = await broadcastFromUserBot(state.text);
        bot?.sendMessage(chatId, result.text);
      } catch (e) {
        bot?.sendMessage(chatId, "Xatolik yuz berdi: " + (e as any)?.message);
      }
      await BotStateService.clearState(chatId);
    }

    if (query.data?.startsWith("br_battle_")) {
      const code = query.data.replace("br_battle_", "");
      await bot?.sendMessage(chatId, "Kanalga yuborilmoqda...");
      try {
        const { getUserBot } = require("./userBot");
        const userBotInstance = getUserBot();

        if (!userBotInstance) {
          throw new Error("Yozgo User Bot ishlamayapti.");
        }

        const url = `https://yozgo.uz/battle`;
        const bText = `🏆 JANG (BATTLE) XONASI OCHILDI!\n\nAsosiy xona kodi:\n<code>${code}</code>\n<i>(Kodni ustiga bosib bemalol nusxalashingiz mumkin)</i>\n\nXonaga kirish individual kodingizni beruvchi bot: @yozgo_bot\n\nJangga kirish sayti: ${url}\n\nDarhol qatnashing va raqobatlashamiz!`;

        await userBotInstance.sendMessage("@yozgo_uz", bText, { parse_mode: "HTML" });
        bot?.sendMessage(
          chatId,
          "Barcha ma'lumotlar @yozgo_uz kanaliga muvaffaqiyatli yuborildi! ✅"
        );
      } catch (e) {
        bot?.sendMessage(chatId, "Xatolik yuz berdi: " + (e as any)?.message);
      }
    }

    if (query.data === "r_yes" && state?.type === "reklama") {
      await bot?.sendMessage(chatId, "Yuklanmoqda...");
      try {
        await db.insert(advertisements).values({
          title: state.title || "Untitled",
          imageUrl: state.imageUrl || null,
          linkUrl: state.linkUrl || null,
          expiresAt: new Date("2030-12-31T23:59:59.000Z"),
          isActive: true,
        });
        bot?.sendMessage(chatId, "Reklama saytga muvaffaqiyatli qo'shildi.");
      } catch (e) {
        bot?.sendMessage(chatId, "Xatolik: " + (e as any).message);
      }
      await BotStateService.clearState(chatId);
    }

    if (query.data?.startsWith("comp_parts_")) {
      const id = query.data.replace("comp_parts_", "");
      try {
        const { competitionParticipants, users } = require("@shared/schema");
        const participants = await db
          .select({
            username: users.firstName,
            email: users.email
          })
          .from(competitionParticipants)
          .innerJoin(users, eq(competitionParticipants.userId, users.id))
          .where(eq(competitionParticipants.competitionId, Number(id)));

        if (participants.length === 0) {
          bot?.sendMessage(chatId, "Hali hech kim ushbu musobaqa uchun ro'yxatdan o'tmagan.");
        } else {
          let listStr = "Musobaqa ishtirokchilari ro'yxati (Waitlist): \n\n";
          participants.forEach((p, i) => {
            listStr += `${i + 1}. ${p.username || p.email?.split("@")[0] || "Noma'lum"}\n`;
          });
          bot?.sendMessage(chatId, listStr);
        }
      } catch (e) {
        bot?.sendMessage(chatId, "Xato: " + (e as any).message);
      }
    }

    if (query.data === "m_yes" && state?.type === "musobaqa") {
      await bot?.sendMessage(chatId, "Yuklanmoqda...");
      try {
        await storage.createCompetition({
          title: state.title || "Untitled",
          startTime: new Date(state.date || Date.now()),
          endTime: new Date(state.date || Date.now()),
          reward: state.prize || null,
        } as any);
        bot?.sendMessage(chatId, "Musobaqa saytga joylandi.");
      } catch (e) {
        bot?.sendMessage(chatId, "Xatolik: " + (e as any).message);
      }
      await BotStateService.clearState(chatId);
    }

    if (query.data?.startsWith("comp_cancel_")) {
      const id = query.data.replace("comp_cancel_", "");
      try {
        const { competitionParticipants } = require("@shared/schema");
        await db.delete(competitionParticipants).where(eq(competitionParticipants.competitionId, Number(id)));
        await db.delete(competitions).where(eq(competitions.id, Number(id)));
        bot?.sendMessage(chatId, "Musobaqa bekor qilindi.");
      } catch (e) {
        bot?.sendMessage(chatId, "Xato: " + (e as any).message);
      }
    }

    if (query.data?.startsWith("msg_winner_")) {
      const winnerUserId = query.data.replace("msg_winner_", "");
      await BotStateService.setState(chatId, { type: "msg_winner", winnerUserId });
      bot?.sendMessage(chatId, "G'olibga jo'natiladigan xabar matnini kiriting:", {
        parse_mode: "HTML",
      });
    }

    if (query.data?.startsWith("verify_y_")) {
      const payload = query.data.replace("verify_y_", "");
      const [battleId, tgId] = payload.split("|");
      bot?.sendMessage(chatId, "Tasdiqlandi va kod jo'natilmoqda...");
      try {
        const { generateAndSendRoomCode } = require("./userBot");
        await generateAndSendRoomCode(battleId, parseInt(tgId, 10));
      } catch (e: any) {
        bot?.sendMessage(chatId, "Xato: " + e.message);
      }
    }

    if (query.data?.startsWith("verify_n_")) {
      const tgId = query.data.replace("verify_n_", "");
      bot?.sendMessage(chatId, "Rad etildi.");
      try {
        const { sendMessageToWinner } = require("./userBot");
        await sendMessageToWinner(
          parseInt(tgId, 10),
          "Sizning obunangiz rad etildi, iltimos qayta tekshiring va shartlarni to'liq bajaring."
        );
      } catch (e) {}
    }
  });

  const sendReklamaList = async (chatId: number) => {
    await bot?.sendMessage(chatId, "Yuklanmoqda...");
    try {
      const ads = await db.select().from(advertisements);
      if (!ads.length) {
        bot?.sendMessage(chatId, "Reklamalar mavjud emas.");
        return;
      }
      for (const ad of ads) {
        const status = ad.isActive ? "Aktiv" : "Nofaol";
        const dateStr = ad.createdAt ? new Date(ad.createdAt).toLocaleString("uz-UZ") : "Noma'lum";
        const text =
          `- ID: ${ad.id}\n` +
          `- Homiy nomi: ${ad.title}\n` +
          `- Havola: ${ad.linkUrl}\n` +
          `- Qo'shilgan sana: ${dateStr}\n` +
          `- Kutilgan kunlar: ${ad.durationDays || 7} marta\n` +
          `- Holati: ${status}\n\n` +
          `Aktivlashtirish: /reklama_on ${ad.id}\n` +
          `O'chirish: /reklama_off ${ad.id}`;
        await bot?.sendMessage(chatId, text);
      }
    } catch (e) {
      bot?.sendMessage(chatId, "Xatolik: " + (e as any).message);
    }
  };

  bot.onText(/^\/reklama_list$/, (msg) => {
    if (!isAdmin(msg)) return;
    sendReklamaList(msg.chat.id);
  });

  bot.onText(/^\/reklama_(on|off)\s+(.+)$/, async (msg, match) => {
    if (!isAdmin(msg) || !match) return;
    const [, action, id] = match;
    const isActive = action === "on";
    try {
      await storage.toggleAdvertisement(id, isActive);
      bot?.sendMessage(
        msg.chat.id,
        `Reklama holati o'zgartirildi: ${isActive ? "Aktiv" : "Nofaol"}`
      );
    } catch (e) {
      bot?.sendMessage(msg.chat.id, "Xatolik: " + (e as any).message);
    }
  });

  const sendMusobaqaList = async (chatId: number) => {
    await bot?.sendMessage(chatId, "Yuklanmoqda...");
    try {
      const comps = await db.select().from(competitions).orderBy(desc(competitions.createdAt));
      if (!comps.length) {
        bot?.sendMessage(chatId, "Musobaqalar mavjud emas.");
        return;
      }

      const now = new Date();
      for (const c of comps) {
        let status = "Aktiv";
        if (!c.isActive) status = "Tugagan";
        else if (new Date(c.startTime || c.createdAt) > now) status = "Kutilmoqda";

        let text =
          `- ID raqami: ${c.id}\n` +
          `- Nomi: ${c.title}\n` +
          `- Sanasi: ${new Date(c.startTime || c.createdAt).toLocaleString("uz-UZ")}\n` +
          `- Sovrini: ${c.reward}\n` +
          `- Holati: ${status}`;

        if (c.isActive)
          text += `\n\nTugatish uchun:\n/musobaqa_tugat ${c.id} FOYDALANUVCHI_ISMI`;

        const opts = {
          reply_markup: c.isActive
            ? {
                inline_keyboard: [
                  [{ text: "Ishtirokchilarni ko'rish", callback_data: `comp_parts_${c.id}` }],
                  [{ text: "Bekor qilish", callback_data: `comp_cancel_${c.id}` }]
                ],
              }
            : undefined,
        };
        await bot?.sendMessage(chatId, text, opts);
      }
    } catch (e) {
      bot?.sendMessage(chatId, "Xatolik: " + (e as any).message);
    }
  };

  bot.onText(/^\/musobaqa_list$/, (msg) => {
    if (!isAdmin(msg)) return;
    sendMusobaqaList(msg.chat.id);
  });

  bot.onText(/^\/musobaqa_bekor\s+(.+)$/, async (msg, match) => {
    if (!isAdmin(msg) || !match) return;
    const id = match[1];
    await bot?.sendMessage(msg.chat.id, "O'chirilmoqda...");
    try {
      const { competitionParticipants } = require("@shared/schema");
      await db.delete(competitionParticipants).where(eq(competitionParticipants.competitionId, Number(id)));
      await db.delete(competitions).where(eq(competitions.id, Number(id)));
      bot?.sendMessage(msg.chat.id, "Musobaqa. o'chirildi.");
    } catch (e) {
      bot?.sendMessage(msg.chat.id, "Xato: " + (e as any).message);
    }
  });

  bot.onText(/^\/musobaqa_tugat\s+([^\s]+)\s+(.+)$/, async (msg, match) => {
    if (!isAdmin(msg) || !match) return;
    const [, id, winnerName] = match;
    await bot?.sendMessage(msg.chat.id, "Yakunlanmoqda...");
    try {
      await db
        .update(competitions)
        .set({ isActive: false })
        .where(eq(competitions.id, Number(id)));
      bot?.sendMessage(msg.chat.id, `Musobaqa tugatildi. G'olib: ${winnerName}`);
    } catch (e) {
      bot?.sendMessage(msg.chat.id, "Xatolik: " + (e as any).message);
    }
  });

  // Scheduled check every 10 min
  const alertedIds = new Set<number>();
  setInterval(
    async () => {
      try {
        const comps = await db.select().from(competitions).where(eq(competitions.isActive, true));
        const now = new Date();
        for (const c of comps) {
          if (!c.startTime) continue;
          const diffHrs = (new Date(c.startTime).getTime() - now.getTime()) / (1000 * 3600);
          if (diffHrs > 0 && diffHrs <= 1 && !alertedIds.has(c.id)) {
            alertedIds.add(c.id);
            bot?.sendMessage(
              adminId,
              `Eslatma:\n\n${c.title} musobaqasi boshlanishiga 1 soat qoldi.`
            );
            
            // Mail jo'natish waitlistdagi barcha foydalanuvchilarga
            try {
              const { competitionParticipants, users } = require("@shared/schema");
              const participants = await db
                .select({ email: users.email, username: users.firstName })
                .from(competitionParticipants)
                .innerJoin(users, eq(competitionParticipants.userId, users.id))
                .where(eq(competitionParticipants.competitionId, c.id));
                
              // Event Loop'ni bloklamasdan Email yuborish
              await processInChunks(participants, 50, 1000, async (p: any) => {
                if (p.email) {
                  await sendEmail(p.email, "Musobaqa yaqinlashmoqda!", `Hurmatli ${p.username || "qatnashchimiz"},\n\nSiz kutgan "${c.title}" musobaqasi boshlanishiga oz vaqt qoldi!\nZudlik bilan saytga kirib, jang xonasiga hozir bo'ling.\n\nBatafsil: https://yozgo.uz/battle`);
                }
              });
            } catch (err) {
              console.error("Cron email hatoligi:", err);
            }
          }
        }
      } catch (e) {}
    },
    10 * 60 * 1000
  ); // 10 mins
}

export const sendRoomCreatedMessage = (code: string) => {
  if (!bot) return;
  const adminIdStr = process.env.ADMIN_TELEGRAM_ID;
  const adminId = adminIdStr ? parseInt(adminIdStr, 10) : 0;
  if (!adminId) return;

  const text =
    `🏆 Musobaqa boshlanmoqda!\n\n` +
    `Asosiy xona kodi:\n<code>${code}</code>\n<i>(Ustiga bosib nusxalashingiz mumkin)</i>\n\n` +
    `Botdan kodingizni oling: @yozgo_bot\n\n` +
    `Saytga kirish: https://yozgo.uz/battle`;

  const opts = {
    parse_mode: "HTML" as const,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📢 @yozgo_uz kanalga yuborish", callback_data: `br_battle_${code}` },
          { text: "📋 Nusxalash", copy_text: { text } } as any,
        ],
      ],
    },
  };

  try {
    bot.sendMessage(adminId, text, opts).catch(() => {});
  } catch (e) {}
};

export const sendBotMessage = (message: string) => {
  if (!bot) return;
  const adminIdStr = process.env.ADMIN_TELEGRAM_ID;
  const adminId = adminIdStr ? parseInt(adminIdStr, 10) : 0;
  if (!adminId) return;
  bot.sendMessage(adminId, message);
};

export const sendWarningToAdmin = (message: string) => {
  sendBotMessage(message);
};

export const sendWinnerToAdmin = (userId: string, name: string) => {
  if (!bot) return;
  const adminIdStr = process.env.ADMIN_TELEGRAM_ID;
  const adminId = adminIdStr ? parseInt(adminIdStr, 10) : 0;
  if (!adminId) return;

  const text = `🎉 G'olib aniqlandi: ${name}\nID: ${userId}\nU bilan bog'lanish yoki xabar yozish uchun ma'lumotlarini kutishingiz mumkin.`;
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✉️ G'olibga xabar yozish", callback_data: `msg_winner_${userId}` }],
      ],
    },
  };
  bot.sendMessage(adminId, text, opts);
};
