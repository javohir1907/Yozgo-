// server/utils/notifier.ts

import https from "https";

export async function sendAdminNotification(message: string, replyMarkup?: any) {
  const token = (process.env.ADMIN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "8734022218:AAGDKCInMbR30qXcgYuzu5T8mZRECNA6My8").trim();
  // Eng quyi ehtiyot chorasi sifatida, o'zingizning aniq guruh/shaxsiy IDingiz kiritildi:
  const chatId = (process.env.ADMIN_CHAT_ID || process.env.ADMIN_TELEGRAM_ID || "5150389360").trim();

  // Agar token yoki ID kiritilmagan bo'lsa, tizimni qotirmaslik uchun indamaymiz
  if (!token || !chatId) return;

  const payloadData = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: "HTML",
    ...(replyMarkup && { reply_markup: replyMarkup })
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${token.trim()}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payloadData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { 
        if (res.statusCode && res.statusCode >= 400) {
          console.error(`[TELEGRAM API XATOLIGI] Status: ${res.statusCode}, Batafsil:`, data);
        } else {
          console.log(`[TELEGRAM SUCCESS]`, data); 
        }
        resolve(data); 
      });
    });

    req.on('error', (e) => {
      console.error("Telegram admin botga xabar yuborishda TRYCATCH xatolik:", e);
      reject(e);
    });

    req.write(payloadData);
    req.end();
  });
}
