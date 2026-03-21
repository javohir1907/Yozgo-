import { type Server } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { storage } from "./storage";
import { words } from "../shared/words";
import { type User } from "@shared/schema";

interface PlayerPerformance {
  wpm: number;
  accuracy: number;
  progress: number;
  timestamp: number;
}

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

interface RoomSettings {
  testDuration: number; // in seconds (e.g. 30)
  totalTime: number;    // in minutes (e.g. 5)
  maxAttempts: number;
  language?: string;
  adminParticipates?: boolean;
}

interface Room {
  id: string; // battle database id
  code: string;
  language: string;
  mode: string;
  adminId: string;
  players: Map<string, Player>; // userId -> Player
  status: 'waiting' | 'playing' | 'finished';
  startTime?: number;
  endTime?: number;
  settings: RoomSettings;
  testWords: string[];
}

export class BattleManager {
  private io: SocketServer;
  private rooms: Map<string, Room> = new Map(); // roomCode -> Room

  constructor(server: Server) {
    this.io = new SocketServer(server, {
      cors: {
        origin: ["https://yozgo-frontend.onrender.com", "http://localhost:5000", "http://localhost:5173", "https://yozgo.uz", "https://www.yozgo.uz"],
        methods: ["GET", "POST"],
        credentials: true
      }
    });
    this.setupSocketIO();
  }

  private setupSocketIO() {
    this.io.on('connection', (socket) => {
      let currentRoomCode: string | null = null;
      let currentUserId: string | null = null;

      socket.on('join-room', async (data: { code: string, user: User }) => {
        const { code, user } = data;
        await this.handleJoinRoom(socket, code, user);
        currentRoomCode = code;
        currentUserId = user.id;
      });

      socket.on('start-battle', (data: { settings: RoomSettings }) => {
        if (currentRoomCode && currentUserId) {
          this.handleStartBattle(currentRoomCode, currentUserId, data.settings);
        }
      });

      socket.on('submit-result', (data: { wpm: number, accuracy: number, progress: number }) => {
        if (currentRoomCode && currentUserId) {
          this.handleResultSubmission(currentRoomCode, currentUserId, data);
        }
      });

      socket.on('typing-progress', (data: { progress: number, wpm: number }) => {
        if (currentRoomCode && currentUserId) {
          this.handleTypingProgress(currentRoomCode, currentUserId, data.progress, data.wpm);
        }
      });

      socket.on('disconnect', () => {
        if (currentRoomCode && currentUserId) {
          this.handleLeaveRoom(currentRoomCode, currentUserId);
        }
      });
    });
  }

  private async handleJoinRoom(socket: Socket, code: string, user: User) {
    let room = this.rooms.get(code);
    
    if (!room) {
      const battle = await storage.getBattleByCode(code);
      if (!battle) {
        socket.emit('error-message', { message: 'Battle not found' });
        return;
      }
      
      room = {
        id: battle.id,
        code: battle.code,
        language: battle.language,
        mode: battle.mode,
        adminId: user.id, // The first person to "join" the room in memory is typically the creator
        players: new Map(),
        status: battle.status as any,
        settings: {
          testDuration: 30,
          totalTime: 5,
          maxAttempts: 10
        },
        testWords: this.generateWords(battle.language, 100) // Generate more words for multiple attempts
      };
      this.rooms.set(code, room);
    }

    if (room.status === 'finished') {
      socket.emit('error-message', { message: 'Battle already finished' });
      return;
    }

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
      isFinished: false
    });

    socket.join(code);

    // Add to DB if not already a participant
    const participants = await storage.getBattleParticipants(room.id);
    if (!participants.find(p => p.userId === user.id)) {
      await storage.addBattleParticipant({
        battleId: room.id,
        userId: user.id,
        wpm: 0,
        accuracy: 0,
        isWinner: false
      });
    }

    this.broadcastRoomUpdate(room);
  }

  private async handleStartBattle(code: string, userId: string, settings: RoomSettings) {
    const room = this.rooms.get(code);
    if (!room || room.adminId !== userId) return;

    room.settings = settings;
    if (settings.language && settings.language !== room.language) {
      room.language = settings.language;
      room.testWords = this.generateWords(settings.language, 100);
    }
    
    room.status = 'playing';
    room.startTime = Date.now();
    room.endTime = room.startTime + (settings.totalTime * 60 * 1000);
    
    await storage.updateBattleStatus(room.id, 'playing');

    this.io.to(code).emit('battle-start', {
      settings: room.settings,
      startTime: room.startTime,
      endTime: room.endTime,
      words: room.testWords
    });

    // Schedule battle end
    setTimeout(() => {
      this.finishBattle(code);
    }, settings.totalTime * 60 * 1000);

    this.broadcastRoomUpdate(room);
  }

  private handleTypingProgress(code: string, userId: string, progress: number, wpm: number) {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'playing') return;

    const player = room.players.get(userId);
    if (player) {
      player.progress = progress;
      player.wpm = wpm;

      this.io.to(code).emit('leaderboard-update', {
        players: this.getPlayersData(room),
        leadingPlayerId: this.getLeadingPlayerId(room)
      });
    }
  }

  private async handleResultSubmission(code: string, userId: string, data: { wpm: number, accuracy: number, progress: number }) {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'playing') return;

    const player = room.players.get(userId);
    if (player) {
      player.attempts++;
      player.accuracy = data.accuracy;
      if (data.wpm >= player.bestWpm) { // >= because accuracy might improve on same WPM
        player.bestWpm = data.wpm;
        player.bestAccuracy = data.accuracy;
      }

      // Update DB for this participant (rolling update of best score)
      const participants = await storage.getBattleParticipants(room.id);
      const participant = participants.find(p => p.userId === userId);
      if (participant) {
        await storage.updateBattleParticipant(participant.id, {
          wpm: player.bestWpm,
          accuracy: data.accuracy
        });
      }

      this.io.to(code).emit('leaderboard-update', {
        players: this.getPlayersData(room),
        leadingPlayerId: this.getLeadingPlayerId(room)
      });
    }
  }

  private async finishBattle(code: string) {
    const room = this.rooms.get(code);
    if (!room || room.status === 'finished') return;

    room.status = 'finished';
    await storage.updateBattleStatus(room.id, 'finished');

    const playersData = this.getPlayersData(room);
    const winnerId = this.getLeadingPlayerId(room);

    if (winnerId) {
      // Mark winner in DB
      const participants = await storage.getBattleParticipants(room.id);
      const winnerParticipant = participants.find(p => p.userId === winnerId);
      if (winnerParticipant) {
        await storage.updateBattleParticipant(winnerParticipant.id, {
          isWinner: true
        });
      }

      try {
        const { db } = await import("./db");
        const { prizeWinners, users } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        
        const existingPrizes = await db.select().from(prizeWinners).where(eq(prizeWinners.userId, winnerId));
        const [winnerUser] = await db.select().from(users).where(eq(users.id, winnerId));

        if (existingPrizes.length > 0) {
          const lastPrizeDate = new Date(existingPrizes[0].prizeGivenAt).toLocaleDateString('uz-UZ');
          const { sendWarningToAdmin } = require("./bot");
          sendWarningToAdmin(`⚠️ Bu foydalanuvchi avval ham sovrin yutgan:\nIsm: ${winnerUser?.firstName || winnerUser?.email}\nSana: ${lastPrizeDate}`);
        }

        // We also show winner to admin bot for 4.1 communication (done later)
        const { sendWinnerToAdmin } = require("./bot");
        sendWinnerToAdmin(winnerId, winnerUser?.firstName || winnerUser?.email || "Noma'lum");
      } catch (e) {
        console.error("Failed to check prize winner:", e);
      }
    }

    this.io.to(code).emit('battle-end', {
      winnerId,
      results: playersData
    });
  }

  private handleLeaveRoom(code: string, userId: string) {
    const room = this.rooms.get(code);
    if (!room) return;

    room.players.delete(userId);
    
    if (room.players.size === 0) {
      this.rooms.delete(code);
    } else {
      // If admin leaves, assign new admin
      if (room.adminId === userId) {
        const nextUserId = room.players.keys().next().value;
        if (nextUserId) {
          room.adminId = nextUserId;
        }
      }
      this.broadcastRoomUpdate(room);
    }
  }

  private broadcastRoomUpdate(room: Room) {
    this.io.to(room.code).emit('room-update', {
      room: {
        code: room.code,
        status: room.status,
        adminId: room.adminId,
        settings: room.settings,
        players: this.getPlayersData(room)
      }
    });
  }

  private getPlayersData(room: Room) {
    return Array.from(room.players.values()).map(p => {
      const isAdmin = p.user.id === room.adminId;
      const adminParticipates = room.settings?.adminParticipates !== undefined ? room.settings.adminParticipates : true;
      const isSpectator = isAdmin && !adminParticipates;
      
      return {
        id: p.user.id,
        username: p.user.firstName || p.user.email?.split('@')[0] || 'Unknown',
        avatarUrl: p.user.profileImageUrl,
        progress: p.progress,
        wpm: p.wpm,
        accuracy: p.accuracy,
        bestWpm: p.bestWpm,
        bestAccuracy: p.bestAccuracy,
        attempts: p.attempts,
        isReady: p.isReady,
        isFinished: p.isFinished,
        isAdmin,
        isSpectator
      };
    }).filter(p => !p.isSpectator).sort((a, b) => b.bestWpm - a.bestWpm);
  }

  private getLeadingPlayerId(room: Room): string | null {
    const players = Array.from(room.players.values());
    if (players.length === 0) return null;
    
    return players.reduce((prev, current) => (prev.bestWpm > current.bestWpm) ? prev : current).user.id;
  }

  private generateWords(lang: string, count: number): string[] {
    const list = words[lang as keyof typeof words] || words.en;
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(list[Math.floor(Math.random() * list.length)]);
    }
    return result;
  }
}
