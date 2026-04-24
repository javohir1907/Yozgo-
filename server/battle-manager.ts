/**
 * YOZGO - Real-time Battle Manager
 *
 * Ushbu modul Socket.io yordamida real-vaqt rejimida "Battle" (jang)
 * xonalarini boshqaradi. Ishtirokchilarning tezligi, progressi va
 * natijalarini sinxronizatsiya qiladi.
 */

import { type Server } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { storage } from "./storage";
import { type User } from "@shared/schema";
import { sendAdminNotification } from "./utils/notifier";
import { analyzeTyping, resetPlayerSnapshots } from "./utils/anti-cheat";

interface Player {
  socket: Socket;
  user: User;
  progress: number;
  wpm: number;
  isFinished: boolean;
  finishedAt?: number;
}

interface BattleRoom {
  id: number;
  text: string;
  players: Map<string, Player>;
  status: "waiting" | "starting" | "playing" | "finished";
  startTime?: number;
  countdown: number;
}
export class BattleManager {
  private io: SocketServer;
  private rooms: Map<number, BattleRoom> = new Map();
  private readonly WAITING_TIME = 10; // seconds

  constructor(server: Server) {
    this.io = new SocketServer(server, {
      cors: { origin: "*" },
      path: "/socket.io"
    });

    this.setupSocketIO();
    this.cleanupInactiveRooms();
  }
  private setupSocketIO() {
    this.io.on("connection", (socket) => {
      socket.on("joinBattle", (data) => this.handleJoinRoom(socket, data));
      socket.on("startBattle", () => this.handleStartBattle(socket));
      socket.on("typingProgress", (data) => this.handleTypingProgress(socket, data));
      socket.on("disconnect", () => this.handleDisconnect(socket));
    });
  }
  private async handleJoinRoom(socket: Socket, { roomId, userId }: { roomId: number, userId: number }) {
    try {
      const user = await storage.getUser(userId);
      if (!user) return;

      let room = this.rooms.get(roomId);
      if (!room) {
        const battle = await storage.getBattle(roomId);
        if (!battle) return;
        room = {
          id: roomId,
          text: battle.text,
          players: new Map(),
          status: "waiting",
          countdown: this.WAITING_TIME
        };
        this.rooms.set(roomId, room);
      }

      room.players.set(socket.id, {
        socket,
        user,
        progress: 0,
        wpm: 0,
        isFinished: false
      });

      socket.join(`battle_${roomId}`);
      this.broadcastRoomUpdate(roomId);

      if (room.status === "waiting" && room.players.size >= 2) {
        this.startCountdown(roomId);
      }
    } catch (error) {
      console.error("Join room error:", error);
    }
  }
  private handleStartBattle(socket: Socket) {
    const roomId = this.getPlayerRoomId(socket.id);
    if (roomId) this.startBattle(roomId);
  }

  private startCountdown(roomId: number) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== "waiting") return;

    room.status = "starting";
    const interval = setInterval(() => {
      if (!this.rooms.has(roomId)) {
        clearInterval(interval);
        return;
      }
      room.countdown--;
      this.broadcastRoomUpdate(roomId);

      if (room.countdown <= 0) {
        clearInterval(interval);
        this.startBattle(roomId);
      }
    }, 1000);
  }

  private startBattle(roomId: number) {
    const room = this.rooms.get(roomId);
    if (!room || room.status === "playing") return;

    room.status = "playing";
    room.startTime = Date.now();
    this.broadcastRoomUpdate(roomId);
  }
  private async handleTypingProgress(socket: Socket, { progress, wpm }: { progress: number, wpm: number }) {
    const roomId = this.getPlayerRoomId(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    const player = room?.players.get(socket.id);
    if (!room || !player || room.status !== "playing" || player.isFinished) return;

    // Anti-cheat verification
    const analysis = analyzeTyping(socket.id, progress, room.text);
    if (!analysis.isValid) {
      console.warn(`[ANTI-CHEAT] Suspicious activity from user ${player.user.username}`);
      // In a real app, we might flag or kick the user here
    }

    player.progress = progress;
    player.wpm = wpm;

    if (progress >= 100) {
      player.isFinished = true;
      player.finishedAt = Date.now();

      // Notify admin about completion (optional but good for tracking)
      sendAdminNotification(`      sendAdminNotification(`FINISH Battle #${roomId}: ${player.user.username} finished! WPM: ${wpm}`);
    }

    this.broadcastRoomUpdate(roomId);

    if (Array.from(room.players.values()).every(p => p.isFinished)) {
      room.status = "finished";
      this.broadcastRoomUpdate(roomId);

      // Save results to DB
      await this.saveBattleResults(roomId);
    }
  }

  private async saveBattleResults(roomId: number) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    for (const player of room.players.values()) {
      await storage.createBattleResult({
        battleId: roomId,
        userId: player.user.id,
        wpm: player.wpm,
        accuracy: 100, // Simplification
        isWinner: false // Logic to determine winner would go here
      });
    }
  }

  private handleDisconnect(socket: Socket) {
    const roomId = this.getPlayerRoomId(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (room) {
      room.players.delete(socket.id);
      if (room.players.size === 0) {
        this.rooms.delete(roomId);
      } else {
        this.broadcastRoomUpdate(roomId);
      }
    }
  }

  private getPlayerRoomId(socketId: string): number | undefined {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.players.has(socketId)) return roomId;
    }
    return undefined;
  }

  private broadcastRoomUpdate(roomId: number) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const roomData = {
      id: room.id,
      status: room.status,
      countdown: room.countdown,
      players: Array.from(room.players.values()).map(p => ({
        id: p.user.id,
        username: p.user.username,
        progress: p.progress,
        wpm: p.wpm,
        isFinished: p.isFinished
      }))
    };

    this.io.to(`battle_${roomId}`).emit("battleUpdate", roomData);
  }

  private cleanupInactiveRooms() {
    setInterval(() => {
      for (const [roomId, room] of this.rooms.entries()) {
        if (room.players.size === 0) {
          this.rooms.delete(roomId);
        }
      }
    }, 60000);
  }
}
