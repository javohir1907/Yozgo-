// server/utils/notifier.ts

import https from "https";

export async function sendAdminNotification(message: string, replyMarkup?: any) {
  const token = "8734022218:AAGDKCInMbR30qXcgYuzu5T8mZRECNA6My8";
  const chatId = "5150389360";

  if (!token || !chatId) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  // Mantiq: Biz mutlaqo kutmaymiz (No await), prosta yuboramiz.
  // Xato bo'lsa ham sistemaga ta'sir qilmaydi.
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      ...(replyMarkup && { reply_markup: replyMarkup })
    }),
    // Signal: uzoq kutmaslik uchun (Timeout kabi)
    signal: AbortSignal.timeout(3000) 
  }).catch(err => {
    // Shunchaki loglaymiz, lekin serverni to'xtatmaymiz
    console.error("[NOTIFIER ERROR] Admin bot bilan ulanishda xato, lekin sayt ishlayapti:", err.message);
  });
}
