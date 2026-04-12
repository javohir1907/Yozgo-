/**
 * YOZGO - Anti-Cheat Engine
 * 
 * Ushbu modul foydalanuvchilarning yozish parametrlarini tahlil qiladi va 
 * bot yoki cheater ekanligini aniqlaydi.
 */

import { storage } from "../storage";
import { type User } from "@shared/schema";
import { sendAdminNotification } from "./notifier";

interface TypingSnapshot {
  wpm: number;
  progress: number;
  timestamp: number;
}

const PLAYER_SNAPSHOTS = new Map<string, TypingSnapshot[]>();

/**
 * Foydalanuvchi natijasini tahlil qilish.
 */
export function analyzeTyping(userId: string, currentWpm: number, progress: number): boolean {
  // 1. Absolute Limit
  if (currentWpm > 260) {
    console.warn(`🚨 [LIMIT] User ${userId} exceeded absolute WPM limit: ${currentWpm}`);
    return true;
  }

  const now = Date.now();
  const snapshots = PLAYER_SNAPSHOTS.get(userId) || [];
  
  // Oxirgi 1 soniyadagi snapshotni qo'shamiz
  snapshots.push({ wpm: currentWpm, progress, timestamp: now });
  
  // Faqat oxirgi 10 ta snapshotni saqlaymiz
  if (snapshots.length > 10) snapshots.shift();
  PLAYER_SNAPSHOTS.set(userId, snapshots);

  if (snapshots.length < 3) return false;

  const last = snapshots[snapshots.length - 1];
  const secondLast = snapshots[snapshots.length - 2];

  // 2. Acceleration Check (Impossible speed boost)
  // Masalan: 0.2 soniya ichida 50 WPM dan 200 WPM ga sakrash
  const timeDiff = (last.timestamp - secondLast.timestamp) / 1000;
  const wpmDiff = last.wpm - secondLast.wpm;

  if (timeDiff > 0 && wpmDiff > 100) {
     console.warn(`🚨 [ACCEL] User ${userId} had impossible WPM jump: ${secondLast.wpm} -> ${last.wpm}`);
     return true;
  }

  // 3. Perfect Consistency (Bot detection)
  // Haqiqiy insonlarda har doim o'zgarish bo'ladi. Agar 5 ta snapshotda WPM aynan bir xil bo'lsa (va 100+ bo'lsa)
  if (snapshots.length >= 5) {
    const lastFive = snapshots.slice(-5);
    const allSame = lastFive.every(s => s.wpm === lastFive[0].wpm && s.wpm > 100);
    if (allSame) {
       console.warn(`🚨 [BOT] User ${userId} shows perfect consistency (Bot behavior)`);
       return true;
    }
  }

  return false;
}

/**
 * VPN yoki Proxy ishlatayotganini tekshirish.
 */
export async function isVpnOrProxy(ip: string, headers: any): Promise<boolean> {
  // 1. Header checks
  const proxyHeaders = [
    'via',
    'x-proxy-id',
    'proxy-client-ip',
    'forwarded',
    'x-forwarded-for', // Usually set by load balancer but can contain multiple IPs
  ];

  // Agar 'x-forwarded-for' da bir nechta IP bo'lsa, bu proksi orqali kelgan bo'lishi mumkin
  const forwardHeader = headers['x-forwarded-for'];
  if (forwardHeader && String(forwardHeader).split(',').length > 2) {
     // Render/Cloudflare usually add 1-2 IPs. 3+ is suspicious.
     return true;
  }

  // 2. Headless browser check (Some bots use it)
  const userAgent = (headers['user-agent'] || '').toLowerCase();
  if (userAgent.includes('headless') || userAgent.includes('bot') || userAgent.includes('crawl')) {
     return true;
  }

  // 3. Known VPN/Proxy service headers
  if (headers['cf-ipcountry'] === 'T1') return true; // Tor

  return false;
}

/**
 * Cheaterni ban qilish.
 */
export async function banUser(userId: string, reason: string): Promise<void> {
  console.log(`🔨 [BAN] Banning user ${userId}. Reason: ${reason}`);
  await storage.setUserBanned(userId, true);
  
  // Adminga xabar berish
  sendAdminNotification(
    `🔨 <b>FOYDALANUVCHI BLOKLANDI! (CHEATING)</b>\n\n` +
    `🆔 ID: <code>${userId}</code>\n` +
    `📝 Sabab: ${reason}\n\n` +
    `<i>Anti-cheat tizimi tomonidan aniqlandi.</i>`
  );
}

export function resetPlayerSnapshots(userId: string) {
  PLAYER_SNAPSHOTS.delete(userId);
}
