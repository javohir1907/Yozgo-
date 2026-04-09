/**
 * YOZGO - Real-time Battle Manager
 * 
 * Ushbu modul Socket.io yordamida real-vaqt rejimida "Battle" (jang) 
 * xonalarini boshqaradi. Ishtirokchilarning tezligi, progressi va 
 * natijalarini sinxronizatsiya qiladi.
 * 
 * @author YOZGO Team
 * @version 1.2.0
 */

// ============ IMPORTS ============
import { type Server } from "http";
import { Server as SocketServer, Socket } from "socket.io";

import { storage } from "./storage";
import { words } from "../shared/words";
import { type User } from "@shared/schema";
import { sendAdminNotification } from "./utils/notifier";
import { sessionMiddleware } from "./auth";

// ============ TYPES & INTERFACES ============

/**
 * Ishtirokchi (Player) ma'lumotlari struktura.
 */
interface Player {
  socket: Socket;
  user: User;
  progress: number;
  wpm: number;
  accuracy: number;
  bestWpm: number;
  bestAccuracy: number;
  attempts: number;
  isReady: boolean;
  isFinished: boolean;
  isDisconnected?: boolean;
}

/**
 * Jang xonasi sozlamalari.
 */
interface RoomSettings {
  testDuration: number; // soniyalarda (e.g. 30)
  totalTime: number; // daqiqalarda (e.g. 5)
  maxAttempts: number;
  language?: string;
  adminParticipates?: boolean;
}

/**
 * Real-vaqt rejimidagi Jang xonasi obyekti.
 */
interface Room {
  id: string; // Ma'lumotlar bazasidagi UUID
  code: string; // 6 xonali xona kodi
  language: string;
  mode: string;
  adminId: string;
  players: Map<string, Player>; // userId -> Player
  status: "waiting" | "playing" | "finished";
  startTime?: number;
  endTime?: number;
  settings: RoomSettings;
  testWords: string[];
}

// ============ MAIN CLASS ============

export class BattleManager {
  private io: SocketServer;
  private rooms: Map<string, Room> = new Map(); // roomCode -> Room

  /**
   * BattleManager konstruktori.
   * 
   * @param server - HTTP Server obyekti
   */
  constructor(server: Server) {
    this.io = new SocketServer(server, {
      cors: {
        origin: [
          "https://yozgo.uz",
          "https://www.yozgo.uz",
          "http://localhost:5000",
          "http://localhost:5173",
        ],
        methods: ["GET", "POST"],
        credentials: true,
      },
      // XAVFSIZLIK VA UZILISHLAR UCHUN QO'SHILDI:
      pingTimeout: 10000,   // 10 soniya javob kelmasa, client uzildi deb hisoblanadi
      pingInterval: 5000,   // Har 5 soniyada client tirikligini tekshirish
      connectTimeout: 5000,
    });
    this.setupSocketIO();

    // XAVFSIZLIK: WebSockets orqali avtorizatsiyani ta'minlash
    if (sessionMiddleware) {
      const wrap = (middleware: any) => (socket: Socket, next: any) => middleware(socket.request, {}, next);
      this.io.use(wrap(sessionMiddleware));
    }

    // Har 15 daqiqada tozala
    setInterval(() => this.cleanupInactiveRooms(), 15 * 60 * 1000);
  }

  private cleanupInactiveRooms(): void {
    const now = Date.now();
    for (const [code, room] of Array.from(this.rooms.entries())) {
      const isWaitingTooLong = room.status === "waiting" && room.startTime && (now - room.startTime > 60 * 60 * 1000);
      const isPlayingStuck = room.status === "playing" && room.endTime && (now > room.endTime + 5 * 60 * 1000); // Tugash vaqtidan 5 daqiqa o'tib ketsa ham yopilmagan bo'lsa

      if (room.status === "finished" || isWaitingTooLong || isPlayingStuck) {
        this.rooms.delete(code);
        console.log(`🧹 [BATTLE] Inactive or stuck room ${code} cleaned up from memory.`);
      }
    }
  }

  /**
   * Socket.io hodisalarini (events) sozlaydi.
   */
  private setupSocketIO(): void {
    this.io.on("connection", (socket: Socket) => {
      let currentRoomCode: string | null = null;
      let currentUserId: string | null = null;

      // Xonaga qo'shilish
      socket.on("join-room", async (data: { code: string; user: User }) => {
        const req = socket.request as any;
        const secureUserId = req.session?.userId;
        
        // Anti-Spoofing: Dasturga ulanayotgan shaxs anonim bo'lmasligi kerak
        if (!secureUserId) {
           socket.emit("error-message", { message: "Ruxsat etilmagan: Avtorizatsiyadan o'tilmagan" });
           return;
        }

        // Agar client jo'natgan yuzer ID real ID bilan mos kelmasa radd qilamiz (ID Spoofing)
        if (data.user?.id !== secureUserId) {
           socket.emit("error-message", { message: "Xavfsizlik xatosi: Kiritilgan ma'lumotlar soxta!" });
           console.warn(`[SECURITY] ID Spoofing Attack Detected: Socket ${socket.id} tried to claim ID ${data.user?.id} but real session ID is ${secureUserId}`);
           return;
        }

        const code = data.code;
        // Baza ustidan bazaviy ishonchli 'secureUser' obyektini yuklash kerak bo'lsa, qilsa bo'ladi.
        // Hozirgi client yuborgan obyekt ID si validatsiyadan o'tganligi uchun undan foydalanish mumkin
        await this.handleJoinRoom(socket, code, data.user);
        currentRoomCode = code;
        currentUserId = secureUserId;
      });

      // Jangni boshlash (faqat Admin)
      socket.on("start-battle", (data: { settings: RoomSettings }) => {
        if (currentRoomCode && currentUserId) {
          this.handleStartBattle(currentRoomCode, currentUserId, data.settings);
        }
      });

      // Natijani yuborish (har bir urinish oxirida)
      socket.on("submit-result", (data: { wpm: number; accuracy: number; progress: number }) => {
        if (currentRoomCode && currentUserId) {
          this.handleResultSubmission(currentRoomCode, currentUserId, data);
        }
      });

      let typingEventCount = 0;
      let typingEventResetTime = Date.now();

      // Yozish progressini real-vaqtda kuzatish
      socket.on("typing-progress", (data: { progress: number; wpm: number }) => {
        const now = Date.now();
        if (now - typingEventResetTime > 1000) {
          typingEventCount = 0;
          typingEventResetTime = now;
        }
        typingEventCount++;

        // Rate Limit: 1 soniyada 5 tadan ortiq xit bo'lsa e'tibor bermaslik (Anti-DoS)
        if (typingEventCount > 5) return;

        if (currentRoomCode && currentUserId) {
          this.handleTypingProgress(currentRoomCode, currentUserId, data.progress, data.wpm);
        }
      });

      // Aloqa uzilganda
      socket.on("disconnect", () => {
        if (currentRoomCode && currentUserId) {
          this.handleLeaveRoom(currentRoomCode, currentUserId);
        }
      });
    });
  }

  // ============ EVENT HANDLERS ============

  /**
   * Yangi o'yinchini xonaga qo'shish yoki mavjud xonani yuklash.
   */
  private async handleJoinRoom(socket: Socket, code: string, user: User): Promise<void> {
    let room = this.rooms.get(code);

    // Agar xona xotirada bo'lmasa, bazadan tekshiramiz
    if (!room) {
      const battleRecord = await storage.getBattleByCode(code);
      if (!battleRecord) {
        socket.emit("error-message", { message: "Xona kodi noto'g'ri" });
        return;
      }

      room = {
        id: battleRecord.id,
        code: battleRecord.code,
        language: battleRecord.language,
        mode: battleRecord.mode,
        adminId: battleRecord.creatorId || user.id,
        players: new Map(),
        status: battleRecord.status as any,
        settings: {
          testDuration: 30,
          totalTime: 5,
          maxAttempts: 10,
        },
        testWords: this.generateTestWords(battleRecord.language, 3000),
      };
      this.rooms.set(code, room);
    }

    if (room.status === "finished") {
      socket.emit("error-message", { message: "Ushbu jang yakunlangan" });
      return;
    }

    const existingPlayer = room.players.get(user.id);

    // Agar jang boshlangan bo'lsa va ishtirokchi qisqa uzilishdan keyin yana qaytsa
    if (existingPlayer && room.status === "playing") {
      existingPlayer.socket = socket;
      existingPlayer.isDisconnected = false;
      
      socket.join(code);
      socket.emit("battle-start", {
        settings: room.settings,
        startTime: room.startTime,
        endTime: room.endTime,
        words: room.testWords,
      });
      this.broadcastRoomUpdate(room);
      return;
    }

    // O'yinchini xonaga qo'shish (Yangi kelgan yoki kutish xonasida bo'lsa almashtirish)
    room.players.set(user.id, {
      socket,
      user,
      progress: existingPlayer ? existingPlayer.progress : 0,
      wpm: existingPlayer ? existingPlayer.wpm : 0,
      accuracy: existingPlayer ? existingPlayer.accuracy : 100,
      bestWpm: existingPlayer ? existingPlayer.bestWpm : 0,
      bestAccuracy: existingPlayer ? existingPlayer.bestAccuracy : 100,
      attempts: existingPlayer ? existingPlayer.attempts : 0,
      isReady: existingPlayer ? existingPlayer.isReady : false,
      isFinished: existingPlayer ? existingPlayer.isFinished : false,
      isDisconnected: false,
    });

    socket.join(code);
    this.broadcastRoomUpdate(room);
  }

  /**
   * Jangni boshlash va taymerni ishga tushirish.
   */
  private async handleStartBattle(code: string, userId: string, settings: RoomSettings): Promise<void> {
    const room = this.rooms.get(code);
    if (!room || room.adminId !== userId) return;

    room.settings = settings;
    room.language = settings.language || room.language;
    room.testWords = this.generateTestWords(room.language, 3000);
    room.status = "playing";
    room.startTime = Date.now();
    room.endTime = room.startTime + settings.totalTime * 60 * 1000;

    await storage.updateBattleStatus(room.id, "playing");

    // Barcha o'yinchilarga Start hodisasini yuborish
    this.io.to(code).emit("battle-start", {
      settings: room.settings,
      startTime: room.startTime,
      endTime: room.endTime,
      words: room.testWords,
    });

    // Avtomatik yakunlash taymeri
    setTimeout(() => this.finishBattle(code), settings.totalTime * 60 * 1000);

    this.broadcastRoomUpdate(room);
  }

  /**
   * Real-vaqtda progress yangilanishini guruhga tarqatish.
   */
  private handleTypingProgress(code: string, userId: string, progress: number, wpm: number): void {
    const room = this.rooms.get(code);
    if (!room || room.status !== "playing") return;

    // ANTI-CHEAT TEKSHIRUVI
    const safeWpm = wpm > 250 ? 0 : wpm; // 250 dan yuqori tezlikni nolga tenglaymiz (yoki cheater deb belgilaymiz)
    const safeProgress = progress > 100 ? 100 : progress;

    const player = room.players.get(userId);
    if (player) {
      player.progress = safeProgress;
      player.wpm = safeWpm;

      this.io.to(code).emit("leaderboard-update", {
        players: this.getFormattedPlayers(room),
        leadingPlayerId: this.calculateLeader(room),
      });
    }
  }

  /**
   * Urinish natijasini qabul qilish va bazaga/peshqadamlarga yozish.
   */
  private async handleResultSubmission(
    code: string,
    userId: string,
    data: { wpm: number; accuracy: number; progress: number }
  ): Promise<void> {
    const room = this.rooms.get(code);
    if (!room || room.status !== "playing") return;

    // ANTI-CHEAT TEKSHIRUVI
    if (data.wpm > 250 || data.accuracy > 100 || data.accuracy < 0) {
      console.warn(`🚨 [ANTI-CHEAT] Foydalanuvchi ${userId} shubhali natija yubordi: ${data.wpm} WPM`);
      data.wpm = 0; // Natijani bekor qilish
    }

    const player = room.players.get(userId);
    if (player) {
      player.attempts++;
      if (data.wpm >= player.bestWpm) {
        player.bestWpm = data.wpm;
        player.bestAccuracy = data.accuracy;
      }

      // Xronologik natijani bazada yangilash (yaxshiroq natija uchun)
      const participants = await storage.getBattleParticipants(room.id);
      const participant = participants.find((p) => p.userId === userId);
      if (participant) {
        await storage.updateBattleParticipant(participant.id, {
          wpm: player.bestWpm,
          accuracy: player.bestAccuracy,
        });
      }

      this.io.to(code).emit("leaderboard-update", {
        players: this.getFormattedPlayers(room),
        leadingPlayerId: this.calculateLeader(room),
      });
    }
  }

  /**
   * Jangni to'liq yakunlash va g'olibni aniqlash.
   */
  private async finishBattle(code: string): Promise<void> {
    const room = this.rooms.get(code);
    if (!room || room.status === "finished") return;

    room.status = "finished";
    await storage.updateBattleStatus(room.id, "finished");

    const winnerId = this.calculateLeader(room);
    if (winnerId) {
      const participants = await storage.getBattleParticipants(room.id);
      const winnerParticipant = participants.find((p) => p.userId === winnerId);
      if (winnerParticipant) {
        await storage.updateBattleParticipant(winnerParticipant.id, { isWinner: true });
      }
    }

    const formattedResults = this.getFormattedPlayers(room);

    this.io.to(code).emit("battle-end", {
      winnerId,
      results: formattedResults,
    });

    // Telegram Adminga natijalarni yuborish
    try {
      let leaderText = `🏁 <b>Jang yakunlandi!</b>\n\n`;
      leaderText += `Xona kodi: <code>${code}</code>\n`;
      leaderText += `Ishtirokchilar: ${formattedResults.length} ta\n\n`;
      
      formattedResults.forEach((p, index) => {
         const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🔸";
         leaderText += `${medal} <b>${p.username}</b> - ${p.bestWpm} WPM (${p.bestAccuracy}% aniqlik)\n`;
      });
      
      sendAdminNotification(leaderText);
    } catch (e) {
      console.error("[BATTLE] Admin botga natijani yuborishda xatolik:", e);
    }
  }

  // ============ HELPERS ============

  private handleLeaveRoom(code: string, userId: string): void {
    const room = this.rooms.get(code);
    if (!room) return;

    if (room.status === "waiting") {
      room.players.delete(userId);
    } else {
      const player = room.players.get(userId);
      if (player) {
        player.isDisconnected = true;
      }
    }

    const activePlayersCount = Array.from(room.players.values()).filter(p => !p.isDisconnected).length;

    if (room.players.size === 0 || activePlayersCount === 0) {
      this.rooms.delete(code);
    } else {
      // FIX: Admin xonadan uzilganda (masalan qisqa network drop) adminlikni 
      // boshqa foydalanuvchiga tortib olib berish funksiyasi olib tashlandi.
      // Admin xonaga qaytganida o'z huquqlarini tiklab oladi.
      this.broadcastRoomUpdate(room);
    }
  }

  private broadcastRoomUpdate(room: Room): void {
    this.io.to(room.code).emit("room-update", {
      room: {
        code: room.code,
        status: room.status,
        adminId: room.adminId,
        settings: room.settings,
        players: this.getFormattedPlayers(room),
      },
    });
  }

  private getFormattedPlayers(room: Room) {
    return Array.from(room.players.values())
      .map((p) => ({
        id: p.user.id,
        username: p.user.firstName || p.user.email?.split("@")[0] || "Unknown",
        avatarUrl: p.user.profileImageUrl,
        progress: p.progress,
        wpm: p.wpm,
        bestWpm: p.bestWpm,
        bestAccuracy: p.bestAccuracy,
        attempts: p.attempts,
        isAdmin: p.user.id === room.adminId,
        isDisconnected: !!p.isDisconnected,
      }))
      .sort((a, b) => b.bestWpm - a.bestWpm);
  }

  private calculateLeader(room: Room): string | null {
    const players = Array.from(room.players.values());
    if (players.length === 0) return null;
    return players.reduce((prev, curr) => (prev.bestWpm > curr.bestWpm ? prev : curr)).user.id;
  }

  private generateTestWords(lang: string, count: number): string[] {
    const list = (words as any)[lang] || words.en;
    return Array.from({ length: count }, () => list[Math.floor(Math.random() * list.length)]);
  }
}
