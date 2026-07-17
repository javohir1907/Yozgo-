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
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
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
    body: JSON.stringify({ from, to, subject, text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend xatosi ${res.status}: ${body}`);
  }
}
