// server/utils/notifier.ts
import https from "https";

export async function sendAdminNotification(message: string, replyMarkup?: any) {
    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.ADMIN_BOT_TOKEN;
    const chatId = process.env.ADMIN_TELEGRAM_ID || process.env.ADMIN_CHAT_ID;

  if (!token || !chatId) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: "HTML",
                ...(replyMarkup && { reply_markup: replyMarkup })
        }),
        signal: AbortSignal.timeout(3000)
  }).catch(err => {
        console.error("[NOTIFIER ERROR] Admin bot bilan ulanishda xato, lekin sayt ishlayapti:", err.message);
  });
}
