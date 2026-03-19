import TelegramBot from 'node-telegram-bot-api';
import { db } from './db';
import { advertisements, competitions, users, testResults } from '@shared/schema';
import { sql, eq, desc, isNotNull } from 'drizzle-orm';
import { storage } from './storage';

let bot: TelegramBot | null = null;
const userStates: Record<number, any> = {};

function parseUzbekDate(input: string): Date | null {
  try {
    const clean = input.trim();
    let match = clean.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
    if (match) return new Date(clean);
    
    match = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (match) return new Date(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}T00:00:00Z`);

    const map: Record<string, string> = {
      'yanvar': '01', 'fevral': '02', 'mart': '03', 'aprel': '04', 'may': '05', 'iyun': '06',
      'iyul': '07', 'avgust': '08', 'sentyabr': '09', 'oktyabr': '10', 'noyabr': '11', 'dekabr': '12'
    };
    
    for (const [uz, num] of Object.entries(map)) {
      if (clean.toLowerCase().includes(uz)) {
        const dMatch = clean.match(/(\d{1,2})/);
        const yMatch = clean.match(/(\d{4})/);
        if (dMatch && yMatch) {
           return new Date(`${yMatch[1]}-${num}-${dMatch[1].padStart(2, '0')}T00:00:00Z`);
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
  console.log("Telegram Bot successfully started in node backend");

  const isAdmin = (msg: TelegramBot.Message) => {
    if (msg.chat.id !== adminId) {
      bot?.sendMessage(msg.chat.id, "⛔️ <b>Sizda bu botdan foydalanish huquqi yo'q!</b>", { parse_mode: "HTML" });
      return false;
    }
    return true;
  };

  bot.onText(/^\/start$/, async (msg) => {
    if (!isAdmin(msg)) return;
    const text = 
      "👑 <b>Assalomu alaykum, Admin! YoshYozgo Boshqaruv Paneliga xush kelibsiz.</b>\\n\\n" +
      "👇 <b>Quyidagi buyruqlardan birini tanlang yoki menyudan foydalaning:</b>\\n\\n" +
      "📊 <b>Statistika:</b>\\n" +
      " 🔸 /stats — Umumiy ma'lumotlar va reyting\\n" +
      " 🔸 /foydalanuvchilar — Oxirgi 10 ta ro'yxatdan o'tganlar\\n\\n" +
      "📢 <b>Reklama:</b>\\n" +
      " 🔸 /reklama — Yangi reklama qo'shish\\n" +
      " 🔸 /reklama_list — Barcha reklamalar ro'yxati\\n\\n" +
      "🏆 <b>Musobaqa:</b>\\n" +
      " 🔸 /musobaqa_yarat — Yangi musobaqa e'loni\\n" +
      " 🔸 /musobaqa_list — Barcha musobaqalar ro'yxati\\n\\n" +
      "✉️ <b>Ommaviy xabar:</b>\\n" +
      " 🔸 /xabar — Barcha a'zolarga xabar yuborish\\n\\n" +
      "❌ <b>Bekor qilish:</b>\\n" +
      " 🔸 /bekor — Jarayonni to'xtatish";
      
    const opts = {
      parse_mode: 'HTML' as const,
      reply_markup: {
        inline_keyboard: [
           [{ text: "📊 Statistika", callback_data: "cmd_stats" }, { text: "🏆 Musobaqalar", callback_data: "cmd_musobaqa_list" }],
           [{ text: "📢 Reklamalar", callback_data: "cmd_reklama_list" }, { text: "👥 Foydalanuvchilar", callback_data: "cmd_foydalanuvchilar" }]
        ]
      }
    };
    bot?.sendMessage(msg.chat.id, text, opts);
  });

  const sendStats = async (chatId: number) => {
    const loading = await bot?.sendMessage(chatId, "⏳ <i>Statistika yuklanmoqda...</i>", { parse_mode: "HTML" });
    try {
      const totalUsers = await db.execute(sql`SELECT count(*) FROM users`);
      const todayUsers = await db.execute(sql`SELECT count(*) FROM users WHERE date(created_at) = current_date`);
      
      const testsData = await db.execute(sql`SELECT count(*) as total, max(wpm) as max_wpm, coalesce(round(avg(wpm)), 0) as avg_wpm FROM test_results`);
      
      const text = 
        "📊 <b>Batafsil Statistika:</b>\\n\\n" +
        `👥 <b>Jami foydalanuvchilar:</b> ${totalUsers.rows[0].count}\\n` +
        `🆕 <b>Bugun qo'shilganlar:</b> ${todayUsers.rows[0].count}\\n\\n` +
        `📝 <b>Jami testlar soni:</b> ${testsData.rows[0].total}\\n` +
        `⚡️ <b>O'rtacha tezlik (WPM):</b> ${testsData.rows[0].avg_wpm}\\n` +
        `🔥 <b>Eng yuqori tezlik (WPM):</b> ${testsData.rows[0].max_wpm || 0}`;

      if (loading) bot?.editMessageText(text, { chat_id: chatId, message_id: loading.message_id, parse_mode: "HTML" });
    } catch (e) {
      if (loading) bot?.editMessageText("❌ Xatolik yuz berdi: " + (e as any).message, { chat_id: chatId, message_id: loading.message_id });
    }
  };

  bot.onText(/^\/stats$/, (msg) => {
    if (!isAdmin(msg)) return;
    sendStats(msg.chat.id);
  });
  
  const sendUsersList = async (chatId: number) => {
    const loading = await bot?.sendMessage(chatId, "⏳ <i>Foydalanuvchilar yuklanmoqda...</i>", { parse_mode: "HTML" });
    try {
      const latest = await db.select().from(users).orderBy(desc(users.createdAt)).limit(10);
      let text = "👥 <b>Oxirgi 10 ta foydalanuvchi:</b>\\n\\n";
      latest.forEach((u, i) => {
        text += `${i+1}. <b>${u.firstName || 'Nomsiz'}</b> - ${u.email}\\n`;
      });
      if (loading) bot?.editMessageText(text, { chat_id: chatId, message_id: loading.message_id, parse_mode: "HTML" });
    } catch (e) {
      if (loading) bot?.editMessageText("❌ Xatolik.", { chat_id: chatId, message_id: loading.message_id });
    }
  };

  bot.onText(/^\/foydalanuvchilar$/, (msg) => {
    if (!isAdmin(msg)) return;
    sendUsersList(msg.chat.id);
  });

  bot.onText(/^\/bekor$/, (msg) => {
    if (!isAdmin(msg)) return;
    delete userStates[msg.chat.id];
    bot?.sendMessage(msg.chat.id, "❌ <b>Barcha buyruqlar bekor qilindi.</b>", { parse_mode: "HTML" });
  });

  // ========== Ommaviy Xabar ==========
  bot.onText(/^\/xabar(?:\s+(.+))?$/, (msg, match) => {
    if (!isAdmin(msg)) return;
    const textInfo = match && match[1];
    if (textInfo) {
       userStates[msg.chat.id] = { type: 'xabar', text: textInfo };
       const confirmMsg = 
          "⚠️ <b>Diqqat!</b> Quyidagi xabar barcha botga ulangan foydalanuvchilarga yuboriladi:\\n\\n" +
          `<i>${textInfo}</i>\\n\\n` +
          "<b>Tasdiqlaysizmi?</b>";
       const opts = {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Ha, yuborish", callback_data: "x_yes" }],
              [{ text: "❌ Bekor qilish", callback_data: "m_no" }]
            ]
          }
        };
        bot?.sendMessage(msg.chat.id, confirmMsg, opts);
    } else {
      userStates[msg.chat.id] = { type: 'xabar' };
      bot?.sendMessage(msg.chat.id, "📝 <b>Barcha foydalanuvchilarga jo'natiladigan xabar matnini kiriting:</b>", { parse_mode: "HTML" });
    }
  });

  // ========== REKLAMA CREATION ==========
  bot.onText(/^\/reklama$/, (msg) => {
    if (!isAdmin(msg)) return;
    userStates[msg.chat.id] = { type: 'reklama', step: 'title' };
    bot?.sendMessage(msg.chat.id, "📢 <b>Yangi reklama</b>\\n\\n1. Homiy nomi yoki sarlavhani kiriting:", { parse_mode: "HTML" });
  });

  // ========== MUSOBAQA CREATION ==========
  bot.onText(/^\/musobaqa_yarat$/, (msg) => {
    if (!isAdmin(msg)) return;
    userStates[msg.chat.id] = { type: 'musobaqa', step: 'title' };
    bot?.sendMessage(msg.chat.id, "🏆 <b>Musobaqa e'lonini yaratamiz</b>\\n\\n1. Musobaqa nomini kiriting:", { parse_mode: "HTML" });
  });

  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const state = userStates[msg.chat.id];
    if (!state) return;

    if (state.type === 'xabar') {
       const confirmMsg = 
          "⚠️ <b>Diqqat!</b> Quyidagi xabar barcha botga ulangan foydalanuvchilarga yuboriladi:\\n\\n" +
          `<i>${msg.text}</i>\\n\\n` +
          "<b>Tasdiqlaysizmi?</b>";
       state.text = msg.text;
       const opts = {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Ha, yuborish", callback_data: "x_yes" }],
              [{ text: "❌ Bekor qilish", callback_data: "m_no" }]
            ]
          }
        };
        bot?.sendMessage(msg.chat.id, confirmMsg, opts);
    }
    else if (state.type === 'reklama') {
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
        bot?.sendMessage(msg.chat.id, "2. Qachon bo'ladi? (Erkin formatda, masalan: 01.04.2026 yoxud 1 aprel 2026):");
      } else if (state.step === 'date') {
        const d = parseUzbekDate(msg.text);
        if (!d) {
          bot?.sendMessage(msg.chat.id, "❌ <b>Sana formati noto'g'ri! Iltimos tekshirib qaytadan kiriting.</b> (Masalan: 01.04.2026)", { parse_mode: 'HTML' });
          return;
        }
        state.date = d.toISOString();
        state.step = 'prize';
        bot?.sendMessage(msg.chat.id, `✅ <b>Sana qabul qilindi:</b> ${d.toLocaleDateString()}\\n\\n3. Sovrin (Masalan: 1,000,000 so'm yoki Premium):`, { parse_mode: 'HTML' });
      } else if (state.step === 'prize') {
        state.prize = msg.text;
        state.step = 'confirm';

        const preview = 
          `<b>Musobaqa:</b> ${state.title}\\n` +
          `<b>Sana:</b> ${new Date(state.date).toLocaleDateString()}\\n` +
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

    if (query.data === 'cmd_stats') return sendStats(chatId);
    if (query.data === 'cmd_foydalanuvchilar') return sendUsersList(chatId);
    if (query.data === 'cmd_musobaqa_list') return sendMusobaqaList(chatId);
    if (query.data === 'cmd_reklama_list') return sendReklamaList(chatId);

    if (query.data === 'r_no' || query.data === 'm_no') {
      delete userStates[chatId];
      bot?.editMessageText("❌ <b>Bekor qilindi.</b>", { chat_id: chatId, message_id: query.message.message_id, parse_mode: "HTML" });
      return;
    }

    if (query.data === 'x_yes' && state?.type === 'xabar') {
       await bot?.editMessageText("⏳ <i>Xabar yuborilmoqda...</i>", { chat_id: chatId, message_id: query.message.message_id, parse_mode: "HTML" });
       try {
          const t_users = await db.select().from(users).where(isNotNull(users.telegramId));
          let success = 0;
          for (const u of t_users) {
            try {
              if (u.telegramId) {
                 await bot?.sendMessage(u.telegramId, `📢 <b>YOZGO YANGILIKLARI</b>\\n\\n${state.text}`, { parse_mode: 'HTML' });
                 success++;
              }
            } catch(e) {}
          }
          bot?.editMessageText(`✅ <b>Xabar ${success} ta foydalanuvchiga muvaffaqiyatli yuborildi!</b>`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: "HTML" });
       } catch (e) {
          bot?.editMessageText("❌ Xatolik yuz berdi.", { chat_id: chatId, message_id: query.message.message_id, parse_mode: "HTML" });
       }
       delete userStates[chatId];
    }

    if (query.data === 'r_yes' && state?.type === 'reklama') {
      await bot?.editMessageText("⏳ <i>Yuklanmoqda...</i>", { chat_id: chatId, message_id: query.message.message_id, parse_mode: "HTML" });
      try {
        await db.insert(advertisements).values({
          title: state.title,
          description: state.description,
          imageUrl: state.imageUrl,
          linkUrl: state.linkUrl,
          startDate: new Date(),
          endDate: new Date("2030-12-31T23:59:59.000Z"),
          isActive: true
        });
        bot?.editMessageText("✅ <b>Reklama saytga muvaffaqiyatli joylandi!</b>", { chat_id: chatId, message_id: query.message.message_id, parse_mode: "HTML" });
      } catch (e) {
        bot?.editMessageText("❌ Xatolik: " + (e as any).message, { chat_id: chatId, message_id: query.message.message_id });
      }
      delete userStates[chatId];
    }

    if (query.data === 'm_yes' && state?.type === 'musobaqa') {
      await bot?.editMessageText("⏳ <i>Yuklanmoqda...</i>", { chat_id: chatId, message_id: query.message.message_id, parse_mode: "HTML" });
      try {
        await storage.createCompetition({
           title: state.title,
           date: new Date(state.date),
           prize: state.prize || null
        });
        bot?.editMessageText("✅ <b>Musobaqa saytga joylandi!</b>", { chat_id: chatId, message_id: query.message.message_id, parse_mode: "HTML" });
      } catch (e) {
        bot?.editMessageText("❌ Xatolik: " + (e as any).message, { chat_id: chatId, message_id: query.message.message_id });
      }
      delete userStates[chatId];
    }
    
    if (query.data?.startsWith('comp_cancel_')) {
       const id = query.data.replace('comp_cancel_', '');
       try {
          await db.delete(competitions).where(eq(competitions.id, id));
          bot?.editMessageText("✅ <b>Musobaqa butunlay o'chirildi (bekor qilindi).</b>", { chat_id: chatId, message_id: query.message.message_id, parse_mode: "HTML" });
       } catch (e) {
          bot?.editMessageText("❌ Xato: " + (e as any).message, { chat_id: chatId, message_id: query.message.message_id, parse_mode: "HTML" });
       }
    }
  });

  const sendReklamaList = async (chatId: number) => {
    const loading = await bot?.sendMessage(chatId, "⏳ <i>Reklamalar yuklanmoqda...</i>", { parse_mode: 'HTML' });
    try {
      const ads = await db.select().from(advertisements);
      if (!ads.length) return bot?.editMessageText("📢 Reklamalar mavjud emas.", { chat_id: chatId, message_id: loading?.message_id });
      bot?.deleteMessage(chatId, loading!.message_id).catch(()=>{});
      for (const ad of ads) {
        const status = ad.isActive ? "🟢 FAOL" : "🔴 O'CHIRILGAN";
        const text = `<b>ID:</b> <code>${ad.id}</code>\\n<b>Title:</b> ${ad.title}\\n<b>Status:</b> ${status}\\n<b>Kliklar:</b> ${ad.clicks || 0}\\n\\nYoqish: /reklama_on ${ad.id}\\nO'chirish: /reklama_off ${ad.id}`;
        await bot?.sendMessage(chatId, text, { parse_mode: "HTML" });
      }
    } catch (e) {}
  };

  bot.onText(/^\/reklama_list$/, (msg) => {
    if (!isAdmin(msg)) return;
    sendReklamaList(msg.chat.id);
  });

  bot.onText(/^\/reklama_(on|off)\s+(.+)$/, async (msg, match) => {
    if (!isAdmin(msg) || !match) return;
    const loading = await bot?.sendMessage(msg.chat.id, "⏳ O'zgartirilmoqda...", { parse_mode: 'HTML' });
    const [, action, id] = match;
    const isActive = action === 'on';
    try {
      await storage.toggleAdvertisement(id, isActive);
      if (loading) bot?.editMessageText(`✅ <b>Muvaffaqiyatli ${isActive ? 'YOQILDI' : "O'CHIRILDI"}</b>`, { chat_id: msg.chat.id, message_id: loading.message_id, parse_mode: 'HTML' });
    } catch (e) {
      if (loading) bot?.editMessageText("❌ Xatolik: " + (e as any).message, { chat_id: msg.chat.id, message_id: loading.message_id });
    }
  });

  const sendMusobaqaList = async (chatId: number) => {
    const loading = await bot?.sendMessage(chatId, "⏳ <i>Musobaqalar yuklanmoqda...</i>", { parse_mode: 'HTML' });
    try {
      const comps = await db.select().from(competitions).orderBy(desc(competitions.createdAt));
      if (!comps.length) return bot?.editMessageText("🏆 Musobaqalar mavjud emas.", { chat_id: chatId, message_id: loading?.message_id });
      bot?.deleteMessage(chatId, loading!.message_id).catch(()=>{});
      
      const now = new Date();
      for (const c of comps) {
        let status = "🟢 AKTIV";
        if (!c.isActive) status = "🔴 TUGATILGAN";
        else if (new Date(c.date) > now) status = "⏳ KUTILMOQDA";

        let text = `<b>ID:</b> <code>${c.id}</code>\\n🏆 <b>${c.title}</b>\\n🎁 <b>Sovrin:</b> ${c.prize}\\n🕒 <b>Sana:</b> ${new Date(c.date).toLocaleString()}\\n📊 <b>Status:</b> ${status}`;
        if (c.winnerName) text += `\\n👑 <b>G'olib:</b> ${c.winnerName}`;
        if (c.isActive) text += `\\n\\n✅ <b>Tugatish usuli:</b>\\n<code>/musobaqa_tugat ${c.id} G'olib-Ismi</code>`;
        
        const opts = {
          parse_mode: 'HTML' as const,
          reply_markup: c.isActive ? {
             inline_keyboard: [[{ text: "🗑 Bekor qilish (O'chirish)", callback_data: `comp_cancel_${c.id}` }]]
          } : undefined
        };
        await bot?.sendMessage(chatId, text, opts);
      }
    } catch (e) {}
  };

  bot.onText(/^\/musobaqa_list$/, (msg) => {
    if (!isAdmin(msg)) return;
    sendMusobaqaList(msg.chat.id);
  });
  
  bot.onText(/^\/musobaqa_bekor\s+(.+)$/, async (msg, match) => {
    if (!isAdmin(msg) || !match) return;
    const id = match[1];
    const loading = await bot?.sendMessage(msg.chat.id, "⏳ O'chirilmoqda...");
    try {
      await db.delete(competitions).where(eq(competitions.id, id));
      if (loading) bot?.editMessageText("✅ <b>Musobaqa muvaffaqiyatli bekor qilindi (o'chirildi).</b>", { chat_id: msg.chat.id, message_id: loading.message_id, parse_mode: 'HTML' });
    } catch (e) {
      if (loading) bot?.editMessageText("❌ Xato: topilmadi yoki " + (e as any).message, { chat_id: msg.chat.id, message_id: loading.message_id });
    }
  });

  bot.onText(/^\/musobaqa_tugat\s+([^\s]+)\s+(.+)$/, async (msg, match) => {
    if (!isAdmin(msg) || !match) return;
    const [, id, winnerName] = match;
    const loading = await bot?.sendMessage(msg.chat.id, "⏳ <i>Yakunlanmoqda...</i>", { parse_mode: 'HTML' });
    try {
      await db.update(competitions).set({ isActive: false, winnerName }).where(eq(competitions.id, id));
      if (loading) bot?.editMessageText(`✅ <b>Musobaqa yopildi va G'olib belgilandi:</b> ${winnerName}`, { chat_id: msg.chat.id, message_id: loading.message_id, parse_mode: 'HTML' });
      // Shuningdek adminga jami sms jo'natish:
      bot?.sendMessage(msg.chat.id, `👑 <b>MUSOBAQA TUGADI!</b>\\n\\n🏆 <b>G'olib:</b> ${winnerName}`, { parse_mode: 'HTML' });
    } catch (e) {
      if (loading) bot?.editMessageText("❌ Xatolik: " + (e as any).message, { chat_id: msg.chat.id, message_id: loading.message_id });
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
          bot?.sendMessage(adminId, `⏳ <b>Diqqat eslatma!</b>\\n\\n🏆 <b>${c.title}</b> musobaqasi yarim soat / 1 soat ichida boshlanadi! Saytni nazorat qiling.`, { parse_mode: 'HTML' });
        }
      }
    } catch (e) {}
  }, 10 * 60 * 1000); // 10 mins
}
