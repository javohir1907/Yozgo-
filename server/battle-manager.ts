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
    });
    this.setupSocketIO();
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
        const { code, user } = data;
        await this.handleJoinRoom(socket, code, user);
        currentRoomCode = code;
        currentUserId = user.id;
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

      // Yozish progressini real-vaqtda kuzatish
      socket.on("typing-progress", (data: { progress: number; wpm: number }) => {
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
        testWords: this.generateTestWords(battleRecord.language, 200),
      };
      this.rooms.set(code, room);
    }

    if (room.status === "finished") {
      socket.emit("error-message", { message: "Ushbu jang yakunlangan" });
      return;
    }

    // O'yinchini xonaga qo'shish
    room.players.set(user.id, {
      socket,
      user,
      progress: 0,
      wpm: 0,
      accuracy: 100,
      bestWpm: 0,
      bestAccuracy: 100,
      attempts: 0,
      isReady: false,
      isFinished: false,
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
    room.testWords = this.generateTestWords(room.language, 200);
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

    const player = room.players.get(userId);
    if (player) {
      player.progress = progress;
      player.wpm = wpm;

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

    this.io.to(code).emit("battle-end", {
      winnerId,
      results: this.getFormattedPlayers(room),
    });
  }

  // ============ HELPERS ============

  private handleLeaveRoom(code: string, userId: string): void {
    const room = this.rooms.get(code);
    if (!room) return;

    room.players.delete(userId);
    if (room.players.size === 0) {
      this.rooms.delete(code);
    } else {
      if (room.adminId === userId) {
        room.adminId = (room.players.keys().next().value as string) || "";
      }
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
