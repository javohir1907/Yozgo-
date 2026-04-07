import https from "https";

export async function sendAdminNotification() {
  const token = "8734022218:AAGDKCInMbR30qXcgYuzu5T8mZRECNA6My8";
  const chatId = "5150389360";
  const message = `⚔️ <b>Qo'lda Yuborilgan Test Xabar! (Native-HTTPS)</b>\n\nYangi HTTPS kodi aniq ishlayapti qarang 🔥\nBu xabar yozgo tizimidagi xuddi shu kod orqali yuborildi.`;

  const markup = {
    inline_keyboard: [[
      { text: "📢 @yozgo_uz kanaliga jo'natish", callback_data: `test` }
    ]]
  };

  const payloadData = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: "HTML",
    reply_markup: markup
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
      console.error("Xatolik:", e);
      reject(e);
    });

    req.write(payloadData);
    req.end();
  });
}

(async () => {
    await sendAdminNotification();
    console.log("Done checking!");
})();
