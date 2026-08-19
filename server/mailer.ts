/**
 * Email yuborish — Resend HTTP API (https://resend.com).
 * XAVFSIZLIK: sukut bilan "muvaffaqiyat" YO'Q.
 * - RESEND_API_KEY sozlanmagan (prod) yoki yuborish fail bo'lsa -> THROW. Chaqiruvchi (auth)
 *   buni ushlab foydalanuvchiga haqiqiy xato qaytaradi (200 "yuborildi" EMAS).
 * - YAGONA istisno: development'da kalit yo'q bo'lsa -> kodni konsolga chiqarib return
 *   (lokal test uchun). Prod'da HECH QACHON bunday emas.
 *
 * ESLATMA: standart "from" onboarding@resend.dev (test rejimi) — yozgo.uz domeni
 * Resend'da verify qilinmaguncha xatlar faqat Resend hisob egasining emailiga yetadi.
 * Domen verify bo'lgach RESEND_FROM env orqali kod o'zgartirmasdan almashtiriladi.
 */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Yozgo Jamoasi <onboarding@resend.dev>";

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[MAIL DEV-SIMULATION] To: ${to} | ${subject}\n${text}`);
      return;
    }
    throw new Error("RESEND_API_KEY sozlanmagan — email yuborilmadi");
  }

  // try/catch YO'Q — fail bo'lsa xato yuqoriga ko'tariladi (chaqiruvchi ushlaydi).
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    // `text` is always sent alongside `html`: it is the fallback for plain-text
    // clients and it keeps the message out of spam heuristics that flag
    // HTML-only mail.
    body: JSON.stringify({ from, to, subject, text, ...(html ? { html } : {}) }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend xatosi ${res.status}: ${body}`);
  }
}

/**
 * Bir martalik kod uchun HTML shablon.
 *
 * Deliberately old-school: tables, inline styles, no external CSS or images.
 * Gmail/Outlook strip <style> blocks and block remote assets, so anything
 * fancier degrades into unstyled text — which is exactly what the previous
 * plain-text mail looked like.
 */
export function otpEmailHtml(opts: {
  code: string;
  title: string;
  intro: string;
  expiryNote: string;
  ignoreNote: string;
}): string {
  const { code, title, intro, expiryNote, ignoreNote } = opts;
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
            <tr>
              <td style="background:#18181b;padding:20px 28px;">
                <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:6px;color:#ffffff;">YOZGO</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 8px 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
                <h1 style="margin:0 0 8px 0;font-size:18px;line-height:1.4;color:#18181b;">${title}</h1>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#52525b;">${intro}</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 28px;">
                <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#18181b;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:10px;padding:16px 12px;">${code}</div>
                <p style="margin:12px 0 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#71717a;">${expiryNote}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;border-top:1px solid #e4e4e7;padding-top:16px;">${ignoreNote}</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#a1a1aa;">© ${new Date().getFullYear()} YOZGO · yozgo.uz</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Parolni tiklash havolasi uchun HTML shablon (otpEmailHtml bilan bir uslubda). */
export function resetEmailHtml(opts: { resetLink: string; email: string }): string {
  const { resetLink, email } = opts;
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
            <tr>
              <td style="background:#18181b;padding:20px 28px;">
                <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:6px;color:#ffffff;">YOZGO</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 8px 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
                <h1 style="margin:0 0 8px 0;font-size:18px;line-height:1.4;color:#18181b;">Parolni tiklash</h1>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#52525b;">
                  <strong style="color:#18181b;">${email}</strong> hisobi uchun parolni tiklash so'raldi. Yangi parol o'rnatish uchun quyidagi tugmani bosing.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 28px;">
                <a href="${resetLink}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;padding:14px 28px;border-radius:8px;">Parolni tiklash</a>
                <p style="margin:12px 0 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#71717a;">Havola 15 daqiqa davomida amal qiladi.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
                <p style="margin:0 0 12px 0;font-size:12px;line-height:1.6;color:#71717a;border-top:1px solid #e4e4e7;padding-top:16px;">
                  Tugma ishlamasa, ushbu manzilni brauzerga nusxalang:
                </p>
                <p style="margin:0;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:11px;line-height:1.5;color:#52525b;word-break:break-all;">${resetLink}</p>
                <p style="margin:16px 0 0 0;font-size:12px;line-height:1.6;color:#71717a;">Agar bu so'rovni siz yubormagan bo'lsangiz, ushbu xatni e'tiborsiz qoldiring — parolingiz o'zgarmaydi.</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#a1a1aa;">© ${new Date().getFullYear()} YOZGO · yozgo.uz</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
