import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { words } from "../shared/words";
import { type User } from "@shared/schema";

interface Player {
  ws: WebSocket;
  user: User;
  progress: number;
  wpm: number;
  isReady: boolean;
  isFinished: boolean;
}

interface Room {
  id: string; // battle database id
  code: string;
  language: string;
  mode: string;
  players: Map<string, Player>; // userId -> Player
  status: 'waiting' | 'playing' | 'finished';
  startTime?: number;
  testWords: string[];
}

export class BattleManager {
  private wss: WebSocketServer;
  private rooms: Map<string, Room> = new Map(); // roomCode -> Room

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws/battle' });
    this.setupWSS();
  }

  private setupWSS() {
    this.wss.on('connection', (ws) => {
      let currentRoomCode: string | null = null;
      let currentUserId: string | null = null;

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          switch (message.type) {
            case 'join_room':
              await this.handleJoinRoom(ws, message.code, message.user);
              currentRoomCode = message.code;
              currentUserId = message.user.id;
              break;
            case 'player_ready':
              if (currentRoomCode && currentUserId) {
                this.handlePlayerReady(currentRoomCode, currentUserId);
              }
              break;
            case 'typing_progress':
              if (currentRoomCode && currentUserId) {
                this.handleTypingProgress(currentRoomCode, currentUserId, message.progress, message.wpm);
              }
              break;
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        if (currentRoomCode && currentUserId) {
          this.handleLeaveRoom(currentRoomCode, currentUserId);
        }
      });
    });
  }

  private async handleJoinRoom(ws: WebSocket, code: string, user: User) {
    let room = this.rooms.get(code);
    
    if (!room) {
      const battle = await storage.getBattleByCode(code);
      if (!battle) {
        ws.send(JSON.stringify({ type: 'error', message: 'Battle not found' }));
        return;
      }
      
      room = {
        id: battle.id,
        code: battle.code,
        language: battle.language,
        mode: battle.mode,
        players: new Map(),
        status: battle.status as any,
        testWords: this.generateWords(battle.language, parseInt(battle.mode))
      };
      this.rooms.set(code, room);
    }

    if (room.status !== 'waiting') {
      ws.send(JSON.stringify({ type: 'error', message: 'Battle already started' }));
      return;
    }

    room.players.set(user.id, {
      ws,
      user,
      progress: 0,
      wpm: 0,
      isReady: false,
      isFinished: false
    });

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

  private handlePlayerReady(code: string, userId: string) {
    const room = this.rooms.get(code);
    if (!room) return;

    const player = room.players.get(userId);
    if (player) {
      player.isReady = true;
      
      // Check if all players are ready
      const allReady = Array.from(room.players.values()).every(p => p.isReady);
      if (allReady && room.players.size >= 2) {
        this.startBattle(room);
      } else {
        this.broadcastRoomUpdate(room);
      }
    }
  }

  private async startBattle(room: Room) {
    room.status = 'playing';
    room.startTime = Date.now();
    await storage.updateBattleStatus(room.id, 'playing');
    
    this.broadcast(room, {
      type: 'battle_start',
      startTime: room.startTime,
      words: room.testWords
    });
  }

  private handleTypingProgress(code: string, userId: string, progress: number, wpm: number) {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'playing') return;

    const player = room.players.get(userId);
    if (player) {
      player.progress = progress;
      player.wpm = wpm;

      if (progress >= 100 && !player.isFinished) {
        player.isFinished = true;
        this.checkBattleEnd(room);
      }

      this.broadcast(room, {
        type: 'update_progress',
        players: this.getPlayersData(room)
      });
    }
  }

  private async checkBattleEnd(room: Room) {
    const allFinished = Array.from(room.players.values()).every(p => p.isFinished);
    if (allFinished) {
      room.status = 'finished';
      await storage.updateBattleStatus(room.id, 'finished');
      
      // Determine winner
      const players = Array.from(room.players.values());
      const winner = players.reduce((prev, current) => (prev.wpm > current.wpm) ? prev : current);

      // Update DB participants
      for (const p of players) {
        const dbParticipants = await storage.getBattleParticipants(room.id);
        const participant = dbParticipants.find(dp => dp.userId === p.user.id);
        if (participant) {
          await storage.updateBattleParticipant(participant.id, {
            wpm: p.wpm,
            isWinner: p.user.id === winner.user.id
          });
        }
      }

      this.broadcast(room, {
        type: 'battle_end',
        winnerId: winner.user.id,
        results: this.getPlayersData(room)
      });
    }
  }

  private handleLeaveRoom(code: string, userId: string) {
    const room = this.rooms.get(code);
    if (!room) return;

    room.players.delete(userId);
    if (room.players.size === 0) {
      this.rooms.delete(code);
    } else {
      this.broadcastRoomUpdate(room);
    }
  }

  private broadcastRoomUpdate(room: Room) {
    this.broadcast(room, {
      type: 'room_update',
      room: {
        code: room.code,
        status: room.status,
        players: this.getPlayersData(room)
      }
    });
  }

  private getPlayersData(room: Room) {
    return Array.from(room.players.values()).map(p => ({
      id: p.user.id,
      username: p.user.firstName || p.user.email?.split('@')[0] || 'Unknown',
      avatarUrl: p.user.profileImageUrl,
      progress: p.progress,
      wpm: p.wpm,
      isReady: p.isReady,
      isFinished: p.isFinished
    }));
  }

  private broadcast(room: Room, message: any) {
    const data = JSON.stringify(message);
    room.players.forEach(p => {
      if (p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(data);
      }
    });
  }

  private generateWords(lang: string, count: number): string[] {
    const list = words[lang as keyof typeof words] || words.en;
    const result = [];
    for (let i = 0; i < count * 5; i++) { // Rough estimate for words needed
      result.push(list[Math.floor(Math.random() * list.length)]);
    }
    return result;
  }
}
