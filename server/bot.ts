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
  // ESKI NODE.JS ADMIN BOTNI TO'LIQ O'CHIRDIK!
  // Python botga xalaqit bermasligi uchun bu yerda TelegramBot ishga tushirilmaydi.
  console.log("Eski Node.js Admin bot o'chirilgan. Endi Python bot ishlatilmoqda.");
  return;
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
