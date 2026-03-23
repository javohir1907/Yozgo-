import { useEffect, useRef, useState, useCallback } from "react";
import { type User } from "@shared/schema";
import { io, Socket } from "socket.io-client";

export function useWebsocket(code: string | null, user: User | null) {
  const [room, setRoom] = useState<any>(null);
  const [battleStart, setBattleStart] = useState<any>(null);
  const [battleEnd, setBattleEnd] = useState<any>(null);
  const [leadingPlayerId, setLeadingPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!code || !user) return;

    const socketUrl = import.meta.env.VITE_API_URL || undefined;
    const socket = io(socketUrl, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join-room", { code, user });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("room-update", (data) => {
      setRoom(data.room);
    });

    socket.on("battle-start", (data) => {
      setBattleStart(data);
      setBattleEnd(null);
    });

    socket.on("leaderboard-update", (data) => {
      setRoom((prev: any) => (prev ? { ...prev, players: data.players } : null));
      setLeadingPlayerId(data.leadingPlayerId);
    });

    socket.on("battle-end", (data) => {
      setBattleEnd(data);
      setBattleStart(null);
    });

    socket.on("error-message", (data) => {
      setError(data.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [code, user]);

  const startBattle = useCallback((settings: any) => {
    socketRef.current?.emit("start-battle", { settings });
  }, []);

  const submitResult = useCallback((wpm: number, accuracy: number, progress: number) => {
    socketRef.current?.emit("submit-result", { wpm, accuracy, progress });
  }, []);

  const sendProgress = useCallback((progress: number, wpm: number) => {
    socketRef.current?.emit("typing-progress", { progress, wpm });
  }, []);

  return {
    room,
    battleStart,
    battleEnd,
    leadingPlayerId,
    error,
    isConnected,
    startBattle,
    submitResult,
    sendProgress,
  };
}
