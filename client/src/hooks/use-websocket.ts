import { useEffect, useRef, useState, useCallback } from "react";
import { type User } from "@shared/schema";
import { io, Socket } from "socket.io-client";
import type { BattleAttemptResponse, BattleWordsResponse } from "@shared/battle-attempt";

export function useWebsocket(code: string | null, user: User | null) {
  const [room, setRoom] = useState<any>(null);
  const [battleStart, setBattleStart] = useState<any>(null);
  const [battleEnd, setBattleEnd] = useState<any>(null);
  const [leadingPlayerId, setLeadingPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    setRoom(null);
    setBattleStart(null);
    setBattleEnd(null);
    setError(null);
    setIsConnected(false);
    if (!code || !user) return;

    const socketUrl = import.meta.env.VITE_API_URL || undefined;
    const token = localStorage.getItem("yozgo_session");
    
    const socket = io(socketUrl, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ["websocket", "polling"],
      withCredentials: true,
      extraHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      auth: { token }
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
      if (socketRef.current === socket) socketRef.current = null;
      socket.disconnect();
    };
  // Profile query refreshes must not tear down an active attempt's connection.
  }, [code, user?.id]);

  const startBattle = useCallback((settings: any) => {
    socketRef.current?.emit("start-battle", { settings });
  }, []);

  const submitResult = useCallback((wpm: number, accuracy: number, progress: number, extraData: any = {}) => {
    socketRef.current?.emit("submit-result", { wpm, accuracy, progress, ...extraData });
  }, []);

  const sendProgress = useCallback((progress: number, wpm: number, extraData: any = {}) => {
    socketRef.current?.emit("typing-progress", { progress, wpm, ...extraData });
  }, []);

  const requestWithAck = useCallback(<T,>(event: string, payload: object): Promise<T> => {
    const socket = socketRef.current;
    if (!socket?.connected) return Promise.reject(new Error("Server bilan aloqa uzilgan. Qayta ulanishni kuting."));

    return new Promise((resolve, reject) => {
      socket.timeout(10000).emit(event, payload, (timeoutError: Error | null, response: T) => {
        if (socketRef.current !== socket || !socket.connected) {
          reject(new Error("Server bilan aloqa uzilgan. Qayta ulanishni kuting."));
        } else if (timeoutError) {
          reject(new Error("Server javob bermadi. Qayta urinib ko‘ring."));
        } else {
          resolve(response);
        }
      });
    });
  }, []);

  const requestAttempt = useCallback((previousIndex: number) =>
    requestWithAck<BattleAttemptResponse>("request-attempt", { previousIndex }), [requestWithAck]);

  const requestAttemptWords = useCallback((index: number, offset: number) =>
    requestWithAck<BattleWordsResponse>("request-attempt-words", { index, offset }), [requestWithAck]);

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
    requestAttempt,
    requestAttemptWords,
  };
}
