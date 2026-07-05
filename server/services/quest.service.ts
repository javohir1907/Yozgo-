/**
 * YOZGO Gamifikatsiya — Kunlik quest xizmati (Feature 6).
 *
 * Kunlik quest to'plami sanadan sof funksiya (pickDailyQuests) — DB'da definitsiya
 * yo'q, refresh cron'siz (lazy). Progress solo (POST /api/results) va battle
 * (finishBattle) nuqtalaridan increment qilinadi. Tugatish EXACT-ONCE:
 * `completed=false` guard'li UPDATE g'olib bo'lgan so'rovgina addUserXp chaqiradi.
 *
 * Contract A: quest mukofoti addUserXp (level xp) beradi, LEKIN weekly_xp'ga
 * QO'SHILMAYDI (aks holda liga faollik XP'sini ikki marta sanaydi).
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { pickDailyQuests, questProgressDelta, type QuestEvent } from "@shared/quests/quest-defs";

async function tashkentDateStr(): Promise<string> {
  const r: any = await db.execute(sql`SELECT (now() AT TIME ZONE 'Asia/Tashkent')::date AS d`);
  return String(r.rows[0].d);
}

export interface QuestView {
  key: string;
  icon: string;
  xpReward: number;
  target: number;
  progress: number;
  completed: boolean;
}

/** Bugungi 3 quest + foydalanuvchi progressi. */
export async function getTodayQuests(
  userId: string,
): Promise<{ date: string; quests: QuestView[]; allCompleted: boolean }> {
  const d = await tashkentDateStr();
  const defs = pickDailyQuests(d);
  const rows: any = await db.execute(sql`
    SELECT quest_key, progress, target, completed FROM daily_quest_progress
    WHERE user_id = ${userId} AND quest_date = ${d}
  `);
  const map = new Map<string, any>();
  for (const r of rows.rows ?? []) map.set(r.quest_key, r);

  const quests: QuestView[] = defs.map((def) => {
    const row = map.get(def.key);
    return {
      key: def.key,
      icon: def.icon,
      xpReward: def.xpReward,
      target: def.target,
      progress: row ? Number(row.progress) : 0,
      completed: row ? Boolean(row.completed) : false,
    };
  });
  return { date: d, quests, allCompleted: quests.every((q) => q.completed) };
}

/**
 * Har event uchun bugungi questlar progressini oshiradi. Best-effort (throw qilmaydi).
 * Tugatilganda XP faqat BIR MARTA beriladi (completed=false guard).
 */
export async function incrementQuests(userId: string, event: QuestEvent): Promise<void> {
  try {
    const d = await tashkentDateStr();
    const defs = pickDailyQuests(d);
    for (const def of defs) {
      const delta = questProgressDelta(def, event);
      if (delta <= 0) continue;

      // Diqqat: bare param'lar ($1) Postgres'da default 'text' bo'ladi — integer
      // ustunga LEAST(text) yozib bo'lmaydi (42804). Shuning uchun ::int cast.
      const up: any = await db.execute(sql`
        INSERT INTO daily_quest_progress (user_id, quest_key, quest_date, progress, target)
        VALUES (${userId}, ${def.key}, ${d}, LEAST(${def.target}::int, ${delta}::int), ${def.target}::int)
        ON CONFLICT (user_id, quest_key, quest_date)
        DO UPDATE SET progress = LEAST(daily_quest_progress.target, daily_quest_progress.progress + ${delta}::int)
          WHERE daily_quest_progress.completed = false
        RETURNING id, progress, target, completed
      `);
      const row = up.rows?.[0];
      if (!row) continue; // allaqachon tugatilgan (WHERE completed=false blokladi)

      if (Number(row.progress) >= Number(row.target) && row.completed === false) {
        // EXACT-ONCE tugatish: faqat false->true o'tishini yutgan so'rov XP beradi.
        const done: any = await db.execute(sql`
          UPDATE daily_quest_progress
          SET completed = true, completed_at = now(), xp_awarded = ${def.xpReward}
          WHERE id = ${row.id} AND completed = false
          RETURNING id
        `);
        if ((done.rows ?? []).length === 1) {
          // Contract A: quest XP -> addUserXp (level xp), weekly_xp'ga QO'SHILMAYDI.
          await storage.addUserXp(userId, def.xpReward);
        }
      }
    }
  } catch (e) {
    console.error("[QUEST] incrementQuests xatosi:", e);
  }
}
