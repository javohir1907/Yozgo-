/**
 * YOZGO Gamifikatsiya — Ligalar (Feature 5).
 *
 * Divizionlar: Bronza(0) -> Kumush(1) -> Oltin(2) -> Platina(3) -> Olmos(4) -> Afsona(5).
 * Foydalanuvchilar ~30 kishilik cohort'larga bo'linadi, SHU haftalik XP (weekly_xp,
 * Contract A) bo'yicha reytinglanadi. Dushanba 00:00 Asia/Tashkent (Contract B):
 * top N ko'tariladi, quyi N tushadi, weekly_xp reset, cohort'lar qayta shakllanadi.
 */
import { randomUUID } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { leagueMembers, users } from "@shared/schema";
import { logger } from "../utils/logger";

export const COHORT_SIZE = 30;
export const PROMOTE_COUNT = 7;
export const RELEGATE_COUNT = 5;
export const MIN_TIER = 0;
export const MAX_TIER = 5;

const LEAGUE_DEFS = [
  { key: "bronze", tier: 0, name: "Bronza", icon: "Shield", sortOrder: 0 },
  { key: "silver", tier: 1, name: "Kumush", icon: "ShieldHalf", sortOrder: 1 },
  { key: "gold", tier: 2, name: "Oltin", icon: "Medal", sortOrder: 2 },
  { key: "platinum", tier: 3, name: "Platina", icon: "Award", sortOrder: 3 },
  { key: "diamond", tier: 4, name: "Olmos", icon: "Gem", sortOrder: 4 },
  { key: "legend", tier: 5, name: "Afsona", icon: "Crown", sortOrder: 5 },
];

/** Liga katalogini idempotent seed qiladi (index.ts startup'da). */
export async function seedLeagues(): Promise<void> {
  for (const l of LEAGUE_DEFS) {
    await db.execute(sql`
      INSERT INTO leagues (key, tier, name, icon, sort_order)
      VALUES (${l.key}, ${l.tier}, ${l.name}, ${l.icon}, ${l.sortOrder})
      ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order
    `);
  }
}

/** Cohort'dagi hajm bo'yicha promote/relegate sonlari (kichik cohort'da 0 = churn yo'q). */
function movementCounts(size: number): { promote: number; relegate: number } {
  const cap = Math.floor(size / 3); // kichik/yangi cohort'ni himoya qiladi (1-2 kishi -> 0)
  return {
    promote: Math.min(PROMOTE_COUNT, cap),
    relegate: Math.min(RELEGATE_COUNT, cap),
  };
}

/** Bo'sh joyi bor cohort topadi (o'sha tier, shu hafta) yoki yangi cohort ochadi. */
async function assignCohort(tier: number): Promise<string> {
  const res: any = await db.execute(sql`
    SELECT cohort_id, count(*)::int AS c FROM league_members
    WHERE league_tier = ${tier} AND cohort_id IS NOT NULL
    GROUP BY cohort_id HAVING count(*) < ${COHORT_SIZE}
    ORDER BY c DESC LIMIT 1
  `);
  const existing = res.rows?.[0]?.cohort_id;
  return existing ?? randomUUID();
}

/** A'zolikni ta'minlaydi (lazy enroll) va cohort tayinlaydi (mid-week joiner uchun). */
async function ensureMembership(userId: string): Promise<{ leagueTier: number; cohortId: string }> {
  await db.execute(sql`
    INSERT INTO league_members (user_id, league_tier, weekly_xp, week_start)
    VALUES (${userId}, 0, 0, date_trunc('week', (now() AT TIME ZONE 'Asia/Tashkent'))::date)
    ON CONFLICT (user_id) DO NOTHING
  `);
  const [m] = await db
    .select({ leagueTier: leagueMembers.leagueTier, cohortId: leagueMembers.cohortId })
    .from(leagueMembers)
    .where(eq(leagueMembers.userId, userId));

  let cohortId = m?.cohortId ?? null;
  if (!cohortId) {
    cohortId = await assignCohort(m?.leagueTier ?? 0);
    await db
      .update(leagueMembers)
      .set({ cohortId })
      .where(eq(leagueMembers.userId, userId));
  }
  return { leagueTier: m?.leagueTier ?? 0, cohortId };
}

export interface LeagueStanding {
  tier: number;
  tierKey: string;
  tierName: string;
  tierIcon: string;
  promoteCount: number;
  relegateCount: number;
  cohortSize: number;
  me: { userId: string; rank: number; weeklyXp: number } | null;
  members: {
    userId: string;
    username: string;
    avatarUrl: string | null;
    weeklyXp: number;
    rank: number;
  }[];
}

/** Foydalanuvchining joriy liga holati va cohort reytingi. */
export async function getStandingForUser(userId: string): Promise<LeagueStanding> {
  const { leagueTier, cohortId } = await ensureMembership(userId);

  const rows = await db
    .select({
      userId: leagueMembers.userId,
      weeklyXp: leagueMembers.weeklyXp,
      username: users.firstName,
      email: users.email,
      avatarUrl: users.profileImageUrl,
    })
    .from(leagueMembers)
    .innerJoin(users, eq(leagueMembers.userId, users.id))
    .where(eq(leagueMembers.cohortId, cohortId))
    .orderBy(desc(leagueMembers.weeklyXp), leagueMembers.joinedAt);

  const [tierRow] = await db.execute(sql`SELECT key, name, icon FROM leagues WHERE tier = ${leagueTier}`).then(
    (r: any) => r.rows ?? [],
  );

  const members = rows.map((r, i) => ({
    userId: r.userId,
    username: r.username || r.email?.split("@")[0] || "Unknown",
    avatarUrl: r.avatarUrl ?? null,
    weeklyXp: r.weeklyXp,
    rank: i + 1,
  }));
  const meRow = members.find((m) => m.userId === userId) ?? null;
  const { promote, relegate } = movementCounts(members.length);

  return {
    tier: leagueTier,
    tierKey: tierRow?.key ?? "bronze",
    tierName: tierRow?.name ?? "Bronza",
    tierIcon: tierRow?.icon ?? "Shield",
    promoteCount: promote,
    relegateCount: relegate,
    cohortSize: members.length,
    me: meRow ? { userId, rank: meRow.rank, weeklyXp: meRow.weeklyXp } : null,
    members,
  };
}

type ResetMember = {
  id: string;
  userId: string;
  leagueTier: number;
  cohortId: string | null;
  weeklyXp: number;
};

/**
 * Haftalik reset (Dushanba 00:00 Tashkent). Single-fire guard: league_reset_log
 * PK bo'yicha INSERT — konflikt bo'lsa allaqachon bajarilgan (multi-instance/qayta
 * urinishda dublikat promote bo'lmaydi).
 */
export async function leagueWeeklyReset(): Promise<{ processed: number; skipped: boolean }> {
  const guard: any = await db.execute(sql`
    INSERT INTO league_reset_log (week_start)
    VALUES (date_trunc('week', (now() AT TIME ZONE 'Asia/Tashkent'))::date)
    ON CONFLICT (week_start) DO NOTHING
    RETURNING week_start
  `);
  if (!(guard.rows?.length)) {
    logger.info("[LEAGUE] reset: bu hafta allaqachon bajarilgan (skip).", { source: "cron" });
    return { processed: 0, skipped: true };
  }
  const thisMonday: string = String(guard.rows[0].week_start);
  // Yopilayotgan hafta (o'yin o'ynalgan hafta) yorlig'i history uchun.
  const prev = new Date(thisMonday + "T00:00:00Z");
  prev.setUTCDate(prev.getUTCDate() - 7);
  const closingWeek = prev.toISOString().slice(0, 10);

  const membersRes: any = await db.execute(sql`
    SELECT id, user_id, league_tier, cohort_id, weekly_xp FROM league_members
  `);
  const allMembers: ResetMember[] = (membersRes.rows ?? []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    leagueTier: Number(r.league_tier),
    cohortId: r.cohort_id ?? null,
    weeklyXp: Number(r.weekly_xp),
  }));

  // Cohort bo'yicha guruhla (NULL cohort -> alohida "unassigned" guruh).
  const byCohort = new Map<string, ResetMember[]>();
  for (const m of allMembers) {
    const key = m.cohortId ?? `unassigned:${m.leagueTier}`;
    if (!byCohort.has(key)) byCohort.set(key, []);
    byCohort.get(key)!.push(m);
  }

  // Har cohort'ni weekly_xp bo'yicha rankla, outcome + yangi tier hisobla, history yoz.
  const processed: { m: ResetMember; newTier: number }[] = [];
  for (const list of byCohort.values()) {
    list.sort((a, b) => b.weeklyXp - a.weeklyXp);
    const { promote, relegate } = movementCounts(list.length);
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      let outcome: "promote" | "stay" | "relegate" = "stay";
      let newTier = m.leagueTier;
      if (i < promote && m.leagueTier < MAX_TIER) {
        outcome = "promote";
        newTier = m.leagueTier + 1;
      } else if (i >= list.length - relegate && m.leagueTier > MIN_TIER) {
        outcome = "relegate";
        newTier = m.leagueTier - 1;
      }
      await db.execute(sql`
        INSERT INTO league_history (user_id, week_start, league_tier, final_rank, weekly_xp, outcome)
        VALUES (${m.userId}, ${closingWeek}, ${m.leagueTier}, ${i + 1}, ${m.weeklyXp}, ${outcome})
      `);
      processed.push({ m, newTier });
    }
  }

  // Keyingi hafta cohort'larini qayta shakllantir: yangi tier bo'yicha guruhlab,
  // 30 kishidan chunk qilib, yangi cohort_id tayinlaymiz.
  const byTier = new Map<number, { m: ResetMember; newTier: number }[]>();
  for (const p of processed) {
    if (!byTier.has(p.newTier)) byTier.set(p.newTier, []);
    byTier.get(p.newTier)!.push(p);
  }
  for (const [tier, list] of byTier.entries()) {
    for (let i = 0; i < list.length; i += COHORT_SIZE) {
      const chunk = list.slice(i, i + COHORT_SIZE);
      const cohortId = randomUUID();
      for (const { m } of chunk) {
        await db.execute(sql`
          UPDATE league_members
          SET league_tier = ${tier}, weekly_xp = 0, week_start = ${thisMonday},
              cohort_id = ${cohortId}, updated_at = now()
          WHERE id = ${m.id}
        `);
      }
    }
  }

  logger.info(`[LEAGUE] reset bajarildi: ${processed.length} a'zo qayta taqsimlandi.`, {
    source: "cron",
  });
  return { processed: processed.length, skipped: false };
}
