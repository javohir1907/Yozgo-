// server/utils/notifier.ts

export async function sendAdminNotification(message: string, replyMarkup?: any) {
  const token = process.env.ADMIN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ADMIN_CHAT_ID || process.env.ADMIN_TELEGRAM_ID;

  // Agar token yoki ID kiritilmagan bo'lsa, tizimni qotirmaslik uchun indamaymiz
  if (!token || !chatId) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const payload: any = {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
    };

    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Telegram admin botga xabar yuborishda xatolik:", error);
  }
}
