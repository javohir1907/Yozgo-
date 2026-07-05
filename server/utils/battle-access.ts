/**
 * Jang xonasiga kirish qoidalari — REST (routes.ts) va Socket (battle-manager.ts)
 * ikkalasi bir xil mantiqni ishlatishi uchun umumiy joyga chiqarildi (DRY).
 */

export interface AccessCheckResult {
  ok: boolean;
  message?: string;
}

/**
 * Foydalanuvchi jinsi xona cheklovi bilan mos kelishini tekshiradi.
 * MUHIM: gender qiymati ISHONCHLI manbadan (DB) olinishi kerak, client obyektidan emas.
 */
export function checkGenderEligibility(
  gender: string | null | undefined,
  genderRestriction: string | null | undefined,
): AccessCheckResult {
  if (!genderRestriction || genderRestriction === "all") {
    return { ok: true };
  }
  if (!gender) {
    return {
      ok: false,
      message:
        "Profilingizda jinsingiz ko'rsatilmagan. Xonaga kirish uchun avval profildan jinsingizni belgilang!",
    };
  }
  if (gender !== genderRestriction) {
    const requiredGender = genderRestriction === "male" ? "Yigitlar 🧍‍♂️" : "Qizlar 🧍‍♀️";
    return {
      ok: false,
      message: `🚫 Kechirasiz, qoidaga muvofiq ushbu xona faqat ${requiredGender} uchun mo'ljallangan!`,
    };
  }
  return { ok: true };
}
