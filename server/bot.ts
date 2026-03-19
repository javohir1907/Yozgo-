import TelegramBot from 'node-telegram-bot-api';
import { db } from './db';
import { advertisements, competitions } from '@shared/schema';
import { sql, eq, desc } from 'drizzle-orm';
import { storage } from './storage';

let bot: TelegramBot | null = null;
const userStates: Record<number, any> = {};

export function startBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const adminIdStr = process.env.ADMIN_TELEGRAM_ID;

  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN is not set. Bot is disabled.");
    return;
  }
  const adminId = adminIdStr ? parseInt(adminIdStr, 10) : 0;

  bot = new TelegramBot(token, { polling: true });
  console.log("Telegram Bot successfully started in node backend");

  const isAdmin = (msg: TelegramBot.Message) => {
    if (msg.chat.id !== adminId) {
      bot?.sendMessage(msg.chat.id, "⛔️ Ruxsat yo'q!");
      return false;
    }
    return true;
  };

  bot.onText(/^\/start$/, (msg) => {
    if (!isAdmin(msg)) return;
    const text = 
      "👑 <b>Xush kelibsiz, Admin!</b>\\n\\n" +
      "Buyruqlar:\\n" +
      "/stats - Barcha statistikalar\\n\\n" +
      "📢 <b>Reklama:</b>\\n" +
      "/reklama - Yangi reklama qo'shish\\n" +
      "/reklama_list - Reklamalar ro'yxati\\n\\n" +
      "🏆 <b>Musobaqa:</b>\\n" +
      "/musobaqa_yarat - Yangi musobaqa\\n" +
      "/musobaqa_list - Musobaqalar ro'yxati\\n" +
      "/bekor - Har qanday jarayonni to'xtatish";
    bot?.sendMessage(msg.chat.id, text, { parse_mode: "HTML" });
  });

  bot.onText(/^\/stats$/, async (msg) => {
    if (!isAdmin(msg)) return;
    try {
      const totalUsers = await db.execute(sql`SELECT count(*) FROM users`);
      const todayUsers = await db.execute(sql`SELECT count(*) FROM users WHERE date(created_at) = current_date`);
      const activeBattles = await db.execute(sql`SELECT count(*) FROM battles WHERE status IN ('waiting', 'playing')`);
      const todayTests = await db.execute(sql`SELECT count(*), COALESCE(round(avg(wpm)), 0) as avg_wpm FROM test_results WHERE date(created_at) = current_date`);

      const text = 
        "📊 <b>Statistika:</b>\\n\\n" +
        `👤 Jami foydalanuvchilar: <b>${totalUsers.rows[0].count}</b>\\n` +
        `🆕 Bugungi ro'yxatdan o'tganlar: <b>${todayUsers.rows[0].count}</b>\\n` +
        `⚔️ Aktiv jang xonalari: <b>${activeBattles.rows[0].count}</b>\\n` +
        `⌨️ Bugun yechilgan testlar: <b>${todayTests.rows[0].count}</b>\\n` +
        `⚡️ O'rtacha reyting/WPM: <b>${todayTests.rows[0].avg_wpm}</b>`;

      bot?.sendMessage(msg.chat.id, text, { parse_mode: "HTML" });
    } catch (e) {
      bot?.sendMessage(msg.chat.id, "Xatolik yuz berdi: " + (e as any).message);
    }
  });

  bot.onText(/^\/bekor$/, (msg) => {
    if (!isAdmin(msg)) return;
    delete userStates[msg.chat.id];
    bot?.sendMessage(msg.chat.id, "❌ Bekor qilindi.");
  });

  // ========== REKLAMA CREATION ==========
  bot.onText(/^\/reklama$/, (msg) => {
    if (!isAdmin(msg)) return;
    userStates[msg.chat.id] = { type: 'reklama', step: 'title' };
    bot?.sendMessage(msg.chat.id, "📢 Yangi reklama qo'shamiz.\\n\\n1. Homiy nomi yoki sarlavhani kiriting:");
  });

  // ========== MUSOBAQA CREATION ==========
  bot.onText(/^\/musobaqa_yarat$/, (msg) => {
    if (!isAdmin(msg)) return;
    userStates[msg.chat.id] = { type: 'musobaqa', step: 'title' };
    bot?.sendMessage(msg.chat.id, "🏆 Musobaqa e'lonini yaratamiz.\\n\\n1. Musobaqa nomini kiriting:");
  });

  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const state = userStates[msg.chat.id];
    if (!state) return;

    if (state.type === 'reklama') {
      if (state.step === 'title') {
        state.title = msg.text;
        state.step = 'image';
        bot?.sendMessage(msg.chat.id, "2. Reklama rasmi (URL orqali tashlang):");
      } else if (state.step === 'image') {
        state.imageUrl = msg.text;
        state.step = 'link';
        bot?.sendMessage(msg.chat.id, "3. Havola (Bosganda qayerga o'tsin?):");
      } else if (state.step === 'link') {
        state.linkUrl = msg.text;
        state.step = 'desc';
        bot?.sendMessage(msg.chat.id, "4. Qisqa tavsif (Ixtiyoriy, agar yozmasangiz nuqta yoki 'yoq' deng):");
      } else if (state.step === 'desc') {
        state.description = msg.text === 'yoq' || msg.text === '.' ? '' : msg.text;
        state.step = 'confirm';
        
        const preview = 
          `<b>Sarlavha:</b> ${state.title}\\n` +
          `<b>Rasm:</b> ${state.imageUrl}\\n` +
          `<b>Link:</b> ${state.linkUrl}\\n` +
          `<b>Tavsif:</b> ${state.description}\\n\\n` +
          "Barcha ma'lumotlar to'g'rimi?";

        const opts = {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Ha, joylaymiz", callback_data: "r_yes" }],
              [{ text: "❌ Bekor qilish", callback_data: "r_no" }]
            ]
          }
        };
        bot?.sendMessage(msg.chat.id, preview, opts);
      }
    } 
    else if (state.type === 'musobaqa') {
      if (state.step === 'title') {
        state.title = msg.text;
        state.step = 'date';
        bot?.sendMessage(msg.chat.id, "2. Qachon bo'ladi? (Masalan: 2026-04-01T20:00 yoki 2026-04-01):");
      } else if (state.step === 'date') {
        let dateStr = msg.text;
        if (dateStr.length === 10) dateStr += "T00:00:00.000Z";
        else if (dateStr.includes("T") && !dateStr.endsWith("Z")) {
           dateStr += dateStr.split(":").length === 2 ? ":00.000Z" : ".000Z";
        }
        state.date = dateStr;
        state.step = 'prize';
        bot?.sendMessage(msg.chat.id, "3. Sovrin (Masalan: 1,000,000 so'm yoki Premium):");
      } else if (state.step === 'prize') {
        state.prize = msg.text;
        state.step = 'confirm';

        const preview = 
          `<b>Musobaqa:</b> ${state.title}\\n` +
          `<b>Sana:</b> ${state.date}\\n` +
          `<b>Sovrin:</b> ${state.prize}\\n\\n` +
          "Barcha ma'lumotlar to'g'rimi?";

        const opts = {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Yaratish", callback_data: "m_yes" }],
              [{ text: "❌ Bekor qilish", callback_data: "m_no" }]
            ]
          }
        };
        bot?.sendMessage(msg.chat.id, preview, opts);
      }
    }
  });

  bot.on('callback_query', async (query) => {
    if (!query.message) return;
    const chatId = query.message.chat.id;
    const state = userStates[chatId];
    bot?.answerCallbackQuery(query.id);

    if (query.data === 'r_no' || query.data === 'm_no') {
      delete userStates[chatId];
      bot?.editMessageText("❌ Bekor qilindi.", { chat_id: chatId, message_id: query.message.message_id });
      return;
    }

    if (query.data === 'r_yes' && state?.type === 'reklama') {
      try {
        await await db.insert(advertisements).values({
          title: state.title,
          description: state.description,
          imageUrl: state.imageUrl,
          linkUrl: state.linkUrl,
          startDate: new Date(),
          endDate: new Date("2030-12-31T23:59:59.000Z"),
          isActive: true
        });
        bot?.editMessageText("✅ Reklama saytga joylandi!", { chat_id: chatId, message_id: query.message.message_id });
      } catch (e) {
        bot?.editMessageText("Xatolik: " + (e as any).message, { chat_id: chatId, message_id: query.message.message_id });
      }
      delete userStates[chatId];
    }

    if (query.data === 'm_yes' && state?.type === 'musobaqa') {
      try {
        await storage.createCompetition({
           title: state.title,
           date: new Date(state.date),
           prize: state.prize
        });
        bot?.editMessageText("✅ Musobaqa saytga joylandi!", { chat_id: chatId, message_id: query.message.message_id });
      } catch (e) {
        bot?.editMessageText("Xatolik: " + (e as any).message, { chat_id: chatId, message_id: query.message.message_id });
      }
      delete userStates[chatId];
    }
  });

  // ========== LISTS & TOGGLES ==========
  bot.onText(/^\/reklama_list$/, async (msg) => {
    if (!isAdmin(msg)) return;
    try {
      const ads = await db.select().from(advertisements);
      if (!ads.length) return bot?.sendMessage(msg.chat.id, "Reklamalar mavjud emas.");
      for (const ad of ads) {
        const status = ad.isActive ? "🟢 ON" : "🔴 OFF";
        const text = `<b>ID:</b> <code>${ad.id}</code>\\n<b>Title:</b> ${ad.title}\\n<b>Status:</b> ${status}\\n<b>Clicks:</b> ${ad.clicks || 0}\\n\\n/reklama_on ${ad.id}\\n/reklama_off ${ad.id}`;
        await bot?.sendMessage(msg.chat.id, text, { parse_mode: "HTML" });
      }
    } catch (e) {}
  });

  bot.onText(/^\/reklama_(on|off)\s+(.+)$/, async (msg, match) => {
    if (!isAdmin(msg) || !match) return;
    const [, action, id] = match;
    const isActive = action === 'on';
    try {
      await storage.toggleAdvertisement(id, isActive);
      bot?.sendMessage(msg.chat.id, `✅ Muvaffaqiyatli ${isActive ? 'YOQILDI' : "O'CHIRILDI"}`);
    } catch (e) {
      bot?.sendMessage(msg.chat.id, "Xatolik: " + (e as any).message);
    }
  });

  bot.onText(/^\/musobaqa_list$/, async (msg) => {
    if (!isAdmin(msg)) return;
    try {
      const comps = await db.select().from(competitions).orderBy(desc(competitions.createdAt));
      if (!comps.length) return bot?.sendMessage(msg.chat.id, "Musobaqalar mavjud emas.");
      for (const c of comps) {
        const status = c.isActive ? "🟢 AKTIV" : "🔴 TUGATILGAN";
        let text = `<b>ID:</b> <code>${c.id}</code>\\n<b>${c.title}</b>\\n<b>Prize:</b> ${c.prize}\\n<b>Date:</b> ${c.date.toLocaleString()}\\n<b>Status:</b> ${status}`;
        if (c.winnerName) text += `\\n🏆 <b>G'olib:</b> ${c.winnerName}`;
        if (c.isActive) text += `\\n\\nTugatish usuli:\\n<code>/musobaqa_tugat ${c.id} G'olib-Nomi</code>`;
        await bot?.sendMessage(msg.chat.id, text, { parse_mode: "HTML" });
      }
    } catch (e) {}
  });

  bot.onText(/^\/musobaqa_tugat\s+([^\s]+)\s+(.+)$/, async (msg, match) => {
    if (!isAdmin(msg) || !match) return;
    const [, id, winnerName] = match;
    try {
      await db.update(competitions).set({ isActive: false, winnerName }).where(eq(competitions.id, id));
      bot?.sendMessage(msg.chat.id, `✅ Musobaqa yopildi va G'olib belgilandi: ${winnerName}`);
      bot?.sendMessage(msg.chat.id, `🏆 Musobaqa tugadi!\\n\\nG'olib: <b>${winnerName}</b>`, { parse_mode: 'HTML' });
    } catch (e) {
      bot?.sendMessage(msg.chat.id, "Xatolik: " + (e as any).message);
    }
  });

  // Scheduled check every 10 min
  const alertedIds = new Set<string>();
  setInterval(async () => {
    try {
      const comps = await db.select().from(competitions).where(eq(competitions.isActive, true));
      const now = new Date();
      for (const c of comps) {
        if (!c.date) continue;
        const diffHrs = (new Date(c.date).getTime() - now.getTime()) / (1000 * 3600);
        if (diffHrs > 0 && diffHrs <= 1 && !alertedIds.has(c.id)) {
          alertedIds.add(c.id);
          bot?.sendMessage(adminId, `⏳ <b>Diqqat!</b>\\n\\n<b>${c.title}</b> musobaqasi yarim soat / 1 soat ichida boshlanadi!`, { parse_mode: 'HTML' });
        }
      }
    } catch (e) {}
  }, 10 * 60 * 1000); // 10 mins
}
