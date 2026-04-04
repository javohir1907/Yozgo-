import nodemailer from "nodemailer";

export async function sendEmail(to: string, subject: string, text: string) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    if (process.env.NODE_ENV === "production") {
      console.error("🔥 CRITICAL WARNING: Production muhitida SMTP_USER yoki SMTP_PASS o'rnatilmagan! Emaillar manzillariga yetib bormaydi!");
    } else {
      console.warn(`[MAIL SIMULATION] To: ${to}\nSubject: ${subject}\nText: ${text}`);
      console.warn("DIQQAT: SMTP logini yo'q (server .env ichiga SMTP_USER va SMTP_PASS kiritilmadi), shuning uchun bular Gmailga bormaydi.");
    }
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });

  const mailOptions = {
    from: `"Yozgo Jamoasi" <${user}>`,
    to,
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email successfully sent to: ${to}`);
  } catch (error) {
    console.error("Email yuborishda xatolik yuz berdi:", error);
  }
}
