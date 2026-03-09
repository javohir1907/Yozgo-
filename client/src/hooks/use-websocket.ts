import { useEffect, useRef, useState, useCallback } from "react";
import { type User } from "@shared/schema";

type Message = {
  type: string;
  [key: string]: any;
};

export function useWebsocket(code: string | null, user: User | null) {
  const [room, setRoom] = useState<any>(null);
  const [battleStart, setBattleStart] = useState<any>(null);
  const [battleEnd, setBattleEnd] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!code || !user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/battle`);
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join_room", code, user }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case "room_update":
          setRoom(message.room);
          break;
        case "battle_start":
          setBattleStart(message);
          break;
        case "update_progress":
          setRoom((prev: any) => prev ? { ...prev, players: message.players } : null);
          break;
        case "battle_end":
          setBattleEnd(message);
          break;
        case "error":
          setError(message.message);
          break;
      }
    };

    ws.onclose = () => {
      socketRef.current = null;
    };

    return () => {
      ws.close();
    };
  }, [code, user]);

  const sendReady = useCallback(() => {
    socketRef.current?.send(JSON.stringify({ type: "player_ready" }));
  }, []);

  const sendProgress = useCallback((progress: number, wpm: number) => {
    socketRef.current?.send(JSON.stringify({ type: "typing_progress", progress, wpm }));
  }, []);

  return { room, battleStart, battleEnd, error, sendReady, sendProgress };
}
