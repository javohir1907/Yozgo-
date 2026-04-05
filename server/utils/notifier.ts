// server/utils/notifier.ts

import https from "https";

export async function sendAdminNotification(message: string, replyMarkup?: any) {
  const rawToken = process.env.ADMIN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "8734022218:AAGDKCInMbR30qXcgYuzu5T8mZRECNA6My8";
  const rawChatId = process.env.ADMIN_CHAT_ID || process.env.ADMIN_TELEGRAM_ID || "5150389360";

  const token = rawToken.replace(/['"]/g, '').trim();
  const chatId = String(rawChatId).replace(/['"]/g, '').trim();

  // Agar token yoki ID kiritilmagan bo'lsa, tizimni qotirmaslik uchun indamaymiz
  if (!token || !chatId) return;

  const payloadData = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: "HTML",
    ...(replyMarkup && { reply_markup: replyMarkup })
  });

  return new Promise((resolve, reject) => {
    const { spawn } = require("child_process");
    const curl = spawn("curl", [
      "-s",
      "-X", "POST",
      `https://api.telegram.org/bot${token}/sendMessage`,
      "-H", "Content-Type: application/json",
      "-d", payloadData
    ]);

    let data = '';
    curl.stdout.on("data", (chunk: any) => { data += chunk.toString(); });
    
    curl.stderr.on("data", (chunk: any) => {
      console.error("[cURL STDERR]:", chunk.toString());
    });

    curl.on("close", (code: number) => {
      if (code === 0) {
        console.log(`[TELEGRAM SUCCESS cURL]`, data);
        resolve(data);
      } else {
        console.error(`[TELEGRAM API cURL XATOLIGI] Exit code: ${code}`);
        reject(new Error(`curl exit code ${code}`));
      }
    });

    curl.on("error", (err: any) => {
      console.error("Telegram admin botga xabar yuborishda cURL xatoligi:", err);
      reject(err);
    });
  });
}
