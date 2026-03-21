import TelegramBot from 'node-telegram-bot-api';
import { db } from './db';
import { users, battles, roomAccessCodes, adminMessages } from '@shared/schema';
import { isNotNull, sql, eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { getAdminBot } from './bot';

let userBot: TelegramBot | null = null;
const MINI_APP_URL = process.env.VITE_API_BASE_URL?.replace('/api', '') || "https://yozgo.uz";
const userStates: Record<number, any> = {};

export function getUserBot() {
  return userBot;
}

export function startUserBot() {
  const token = process.env.USER_BOT_TOKEN;
  if (!token) {
    console.warn('⚠️ USER_BOT_TOKEN not set — user bot disabled');
    return;
  }

  userBot = new TelegramBot(token, { polling: true });
  console.log("Foydalanuvchi Boti (User Bot) muvaffaqiyatli ishga tushdi!");

  try {
    fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
         menu_button: {
            type: "web_app",
            text: "O'ynash 🚀",
            web_app: { url: MINI_APP_URL }
         }
      })
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
      `Assalomu alaykum, ${msg.chat.first_name || 'foydalanuvchi'}! 🦁\n\n` +
      `YOZGO — O'zbekistonning birinchi va yagona terma-yozishraqobat platformasiga xush kelibsiz!\n\n` +
      `Masobaqaga qo'shilish uchun xona kodini botga yuboring yoki quyidagi tugmani bosing.`;

    const opts = {
      reply_markup: {
        inline_keyboard: [[{ text: "🎯 Yozgoga kirish", web_app: { url: "https://yozgo.uz" } }]]
      }
    };
    
    userBot?.sendMessage(chatId, text, opts);
  });

  userBot.on('message', async (msg) => {
    if (!msg.text && !msg.contact && !msg.location && !msg.photo) return;
    const chatId = msg.chat.id;
    const state = userStates[chatId];

    // Winner Data Collection Flow
    if (state?.type === 'winner_data') {
      if (state.step === 'phone') {
        if (msg.contact?.phone_number || msg.text) {
          state.phone = msg.contact?.phone_number || msg.text;
          state.step = 'location';
          userBot?.sendMessage(chatId, "📍 Endi manzilingizni yuboring (Location jo'nating yoki matn ko'rinishida yozing):", {
            reply_markup: {
              keyboard: [[{ text: "Manzilni yuborish 📍", request_location: true }]],
              resize_keyboard: true,
              one_time_keyboard: true
            }
          });
        }
      } else if (state.step === 'location') {
        if (msg.location || msg.text) {
          state.location = msg.location ? `${msg.location.latitude}, ${msg.location.longitude}` : msg.text;
          state.step = 'photo';
          userBot?.sendMessage(chatId, "🤳 Pasport yoki ID karta rasmini yuboring (Sovrin topshirilishi uchun majburiy):", {
            reply_markup: { remove_keyboard: true }
          });
        }
      } else if (state.step === 'photo') {
        if (msg.photo) {
          state.photo = msg.photo[msg.photo.length - 1].file_id;
          userBot?.sendMessage(chatId, "✅ Rahmat! Ma'lumotlaringiz adminga yuborildi. Tez orada siz bilan bog'lanamiz!");
          
          // Forward to Admin
          const adminBot = getAdminBot();
          const adminIdStr = process.env.ADMIN_TELEGRAM_ID;
          if (adminBot && adminIdStr) {
            const adminMsg = `📦 G'olibdan ma'lumotlar keldi: ${msg.from?.first_name || 'Noma\'lum'}\n📱 Tel: ${state.phone}\n📍 Manzil: ${state.location}`;
            adminBot.sendPhoto(parseInt(adminIdStr, 10), state.photo, { caption: adminMsg });
          }
          delete userStates[chatId];
        } else {
          userBot?.sendMessage(chatId, "Iltimos rasm formatida yuboring.");
        }
      }
      return;
    }

    // Checking for raw room codes (if user types ROOM2025 directly)
    if (msg.text && !msg.text.startsWith('/')) {
      const isMaybeCode = msg.text.length >= 4 && msg.text.length <= 10;
      if (isMaybeCode) {
        await handleRoomCode(chatId, msg.text.toUpperCase(), msg.from?.id);
      }
    }
  });

  userBot.on('callback_query', async (query) => {
    if (!query.message) return;
    const chatId = query.message.chat.id;
    
    if (query.data?.startsWith('check_subs_')) {
      const battleId = query.data.replace('check_subs_', '');
      try {
        const uId = query.from.id;
        // Check Telegram Channel Subscription (requires bot to be an admin in the channel)
        try {
          const chatMember = await userBot?.getChatMember('@yozgo_uz', uId);
          if (chatMember && ['left', 'kicked'].includes(chatMember.status)) {
             userBot?.answerCallbackQuery(query.id, { text: "Kanalga a'zo bo'lmadingiz!", show_alert: true });
             return;
          }
        } catch(e) {
          // Ignore if bot is not admin or channel does not exist - assume valid for now or skip checking
        }

        userBot?.sendMessage(chatId, "Tekshirish adminga yuborildi, biroz kuting...");
        
        // Notify admin for manual verify
        const adminBot = getAdminBot();
        const adminIdStr = process.env.ADMIN_TELEGRAM_ID;
        if (adminBot && adminIdStr) {
          const text = `O'yinchi (${query.from.first_name || 'User'}) YouTube/Instagram shartini bajardimi deb so'ramoqda\nBattle ID: ${battleId}`;
          adminBot.sendMessage(parseInt(adminIdStr, 10), text, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ Tasdiqlash", callback_data: `verify_y_${battleId}|${uId}` },
                  { text: "❌ Rad etish", callback_data: `verify_n_${uId}` }
                ]
              ]
            }
          });
        }
      } catch (err: any) {
        userBot?.sendMessage(chatId, "Xatolik: " + err.message);
      }
      userBot?.answerCallbackQuery(query.id);
    }
  });
}

async function handleRoomCode(chatId: number, code: string, tgUserId?: number) {
  if (!tgUserId) return;
  const [battle] = await db.select().from(battles).where(eq(battles.code, code));
  if (!battle) {
    if (code.length < 8) {
       userBot?.sendMessage(chatId, "Xona kodi topilmadi yoki yopilgan.");
    }
    return;
  }
  
  if (battle.status === 'finished') {
    userBot?.sendMessage(chatId, "Bu musobaqa allaqachon yakunlangan!");
    return;
  }

  // Check required subscriptions UI
  const text = 
    `Quyidagi shartlarni bajaring:\n\n` +
    `✅ Telegram: @yozgo_uz kanaliga a'zo bo'ling\n` +
    `✅ YouTube va Instagram (havolalari musobaqa e'lonida berilgan) ga obuna bo'ling\n\n` +
    `Barchasini bajarganingizdan so'ng pastdagi tugmani bosing.`;

  userBot?.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [[{ text: "Barchasini bajardim ✅", callback_data: `check_subs_${battle.id}` }]]
    }
  });
}

export async function generateAndSendRoomCode(battleId: string, telegramId: number) {
  // Find user by telegram ID
  const uRes = await db.execute(sql`SELECT id FROM users WHERE telegram_id = ${telegramId.toString()}`);
  let userId = uRes.rows[0]?.id as string;
  
  if (!userId) {
    userBot?.sendMessage(telegramId, "Siz tizimdan ro'yxatdan o'tmagansiz (Saytda Telegram bilan kirishni tanlang)!");
    return;
  }

  const [existingCode] = await db.select()
    .from(roomAccessCodes)
    .where(and(eq(roomAccessCodes.roomId, battleId), eq(roomAccessCodes.userId, userId)));

  let code = existingCode?.code;

  if (!code) {
    code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 characters
    await db.insert(roomAccessCodes).values({
      roomId: battleId,
      userId: userId,
      code: code
    });
  }

  const text = `🎉 Sizning kirish kodingiz: <b>${code}</b>\n\nBu kodni saytga kirish uchun ishlating. Kod bir martalik!`;
  userBot?.sendMessage(telegramId, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{ text: "📲 Jangga kirish", url: `${MINI_APP_URL}/battle` }]]
    }
  });
}

export async function sendMessageToWinner(telegramId: number, text: string) {
  if (!userBot) return;
  
  // Custom winner collection logic starts here if text contains specific trigger?
  // Actually, we should trigger winner data collection explicitly when winner is chosen.
  // We'll let admin write the custom message, and then we ALSO ask for phone.
  
  await userBot.sendMessage(telegramId, `Yangi xabar (Admindan):\n\n${text}`);
  
  // Set state to collect winner info
  userStates[telegramId] = { type: 'winner_data', step: 'phone' };
  
  userBot.sendMessage(telegramId, "🎉 Tabriklaymiz! Sovrin olish uchun quyidagi ma'lumotlarni yuboring:\n\n1. 📱 Telefon raqamingizni yuboring (Tugmani bosing yoki yozing):", {
    reply_markup: {
      keyboard: [[{ text: "Raqamni yuborish 📱", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
}

export async function broadcastFromUserBot(text: string) {
  if (!userBot) return { success: 0, fail: 0, text: "Foydalanuvchi boti ulanmagan" };
  let success = 0, fail = 0;
  try {
    const t_users = await db.execute(sql`SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL`);
    for (const u of t_users.rows) {
      if (u.telegram_id) {
        try {
          await userBot.sendMessage(u.telegram_id as number, `Yangi Xabar:\n\n${text}`);
          success++;
        } catch (e) { fail++; }
      }
    }
  } catch (err) { return { success, fail, text: "Xatolik yuz berdi." }; }
  return { success, fail, text: `Xabar muvaffaqiyatli ${success} kishiga yuborildi. (${fail} ta xato)` };
}
