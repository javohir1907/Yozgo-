import TelegramBot from 'node-telegram-bot-api';
import { db } from './db';
import { users } from '@shared/schema';
import { isNotNull, sql } from 'drizzle-orm';

let userBot: TelegramBot | null = null;
const MINI_APP_URL = process.env.VITE_API_BASE_URL?.replace('/api', '') || "https://yozgo.uz"; // fallback to root

export function startUserBot() {
  const token = process.env.USER_BOT_TOKEN;
  if (!token) return;

  userBot = new TelegramBot(token, { polling: true });
  console.log("Foydalanuvchi Boti (User Bot) muvaffaqiyatli ishga tushdi!");

  // Try to set Chat Menu Button globally
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

  userBot.onText(/^\/start$/, async (msg) => {
    const chatId = msg.chat.id;
    
    const text = 
      `Assalomu alaykum, ${msg.chat.first_name || 'foydalanuvchi'}! 🦁\n\n` +
      `YOZGO — O'zbekistonning birinchi va yagona terma-yozishraqobat platformasiga xush kelibsiz!\n\n` +
      `👇 Pastdagi tugmani bosib darhol musobaqalarga qo'shiling va yutuqlarni yutib oling.`;

    const opts = {
      reply_markup: {
        inline_keyboard: [[{ text: "Ilovani ochish 📱", web_app: { url: MINI_APP_URL } }]]
      }
    };
    
    userBot?.sendMessage(chatId, text, opts);
  });
}

// Admin botidan barchaga xabar yuborish uchun ishlatiladigan maxsus funksiya
export async function broadcastFromUserBot(text: string) {
  if (!userBot) return { success: 0, fail: 0, text: "Foydalanuvchi boti ulanmagan (USER_BOT_TOKEN yo'q)" };

  let success = 0;
  let fail = 0;
  
  try {
    const t_users = await db.execute(sql`SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL`);
    for (const u of t_users.rows) {
      if (u.telegram_id) {
        try {
          // Barchasiga userBot (Foydalanuvchi Boti) orqali xabar boradi!
          await userBot.sendMessage(u.telegram_id as number, `Yangi Xabar:\n\n${text}`);
          success++;
        } catch (e) {
          fail++;
        }
      }
    }
  } catch (err) {
    return { success, fail, text: "Xatolik yuz berdi." };
  }
  
  return { success, fail, text: `Xabar muvaffaqiyatli ${success} kishiga yuborildi. (${fail} ta xato)` };
}
