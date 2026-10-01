import { useCallback, useEffect, useRef, useState } from "react";
import type { BattleAttemptData, BattleAttemptResponse, BattleWordsResponse } from "@shared/battle-attempt";

interface LocalAttempt extends BattleAttemptData {
  localStartTime: number;
  localEndTime: number;
}

interface BattleAttemptOptions {
  battleKey: string | null;
  snapshot?: BattleAttemptData;
  snapshotIndex?: number;
  currentWordIndex: number;
  requestAttempt: (previousIndex: number) => Promise<BattleAttemptResponse>;
  requestWords: (index: number, offset: number) => Promise<BattleWordsResponse>;
  onError: (message: string) => void;
}

function anchorAttempt(data: BattleAttemptData): LocalAttempt {
  const localNow = Date.now();
  return {
    ...data,
    localStartTime: localNow - (data.serverNow - data.startTime),
    localEndTime: localNow + (data.endTime - data.serverNow),
  };
}

/** Requests each round and extends its text before the typist reaches the end. */
export function useBattleAttempt({
  battleKey, snapshot, snapshotIndex = -1, currentWordIndex,
  requestAttempt, requestWords, onError,
}: BattleAttemptOptions) {
  const [attempt, setAttempt] = useState<LocalAttempt | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [appendRetry, setAppendRetry] = useState(0);
  const scopeRef = useRef(battleKey);
  const attemptRef = useRef<LocalAttempt | null>(null);
  const previousIndexRef = useRef(-1);
  const pendingRef = useRef(false);
  const appendRequestRef = useRef<object | null>(null);
  const appendRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appendErrorReportedRef = useRef(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Invalidate promises immediately when a new room/battle renders.
  if (scopeRef.current !== battleKey) {
    scopeRef.current = battleKey;
    attemptRef.current = null;
    previousIndexRef.current = -1;
    pendingRef.current = false;
    appendRequestRef.current = null;
  }

  useEffect(() => {
    scopeRef.current = battleKey;
    setAttempt(null);
    setIsPending(false);
    setRemainingSeconds(null);
    appendErrorReportedRef.current = false;
    return () => {
      if (appendRetryTimerRef.current) clearTimeout(appendRetryTimerRef.current);
      if (scopeRef.current === battleKey) scopeRef.current = null;
    };
  }, [battleKey]);

  useEffect(() => {
    if (!battleKey) return;
    previousIndexRef.current = Math.max(previousIndexRef.current, snapshotIndex);
    if (!snapshot || snapshot.words.length === 0 || snapshot.index < previousIndexRef.current) return;
    const restored = anchorAttempt(snapshot);
    const current = attemptRef.current;
    if (current?.index !== restored.index) appendRequestRef.current = null;
    if (current?.index === restored.index && current.words.length > restored.words.length) {
      restored.words = current.words;
    }
    attemptRef.current = restored;
    previousIndexRef.current = restored.index;
    setAttempt(restored);
  }, [battleKey, snapshot, snapshotIndex]);

  useEffect(() => {
    if (!attempt || !battleKey) return;
    const tick = () => setRemainingSeconds(Math.max(0, Math.ceil((attempt.localEndTime - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [battleKey, attempt?.index, attempt?.localEndTime]);

  const startNext = useCallback(async () => {
    if (!battleKey || pendingRef.current) return;
    const scope = battleKey;
    pendingRef.current = true;
    setIsPending(true);
    try {
      const response = await requestAttempt(previousIndexRef.current);
      if (scopeRef.current !== scope) return;
      if (response.error) throw new Error(response.error);
      const data = response.attempt;
      if (!data || data.words.length === 0) throw new Error("Test matni kelmadi. Qayta urinib ko‘ring.");
      if (data.index < previousIndexRef.current) return;
      const accepted = anchorAttempt(data);
      const current = attemptRef.current;
      if (current?.index !== accepted.index) appendRequestRef.current = null;
      if (current?.index === accepted.index && current.words.length > accepted.words.length) accepted.words = current.words;
      attemptRef.current = accepted;
      previousIndexRef.current = data.index;
      setAttempt(accepted);
      setRemainingSeconds(Math.max(0, Math.ceil((accepted.localEndTime - Date.now()) / 1000)));
    } catch (error) {
      if (scopeRef.current === scope) onErrorRef.current(error instanceof Error ? error.message : "Testni boshlashda xato yuz berdi.");
    } finally {
      if (scopeRef.current === scope) {
        pendingRef.current = false;
        setIsPending(false);
      }
    }
  }, [battleKey, requestAttempt]);

  useEffect(() => {
    const current = attemptRef.current;
    if (!battleKey || !current || Date.now() >= current.localEndTime || appendRequestRef.current ||
      current.words.length - currentWordIndex > 200) return;
    const scope = battleKey;
    const request = {};
    appendRequestRef.current = request;
    const index = current.index;
    const offset = current.words.length;

    void requestWords(index, offset).then((response) => {
      if (scopeRef.current !== scope || attemptRef.current?.index !== index) return;
      if (response.error) throw new Error(response.error);
      if (response.index !== index || response.offset !== offset || !response.words?.length) {
        throw new Error("Qo‘shimcha test matni kelmadi.");
      }
      const latest = attemptRef.current;
      // Reconnect may already have restored this block; never duplicate it.
      if (latest.words.length !== offset) return;
      const extended = { ...latest, words: [...latest.words, ...response.words] };
      attemptRef.current = extended;
      setAttempt(extended);
      appendErrorReportedRef.current = false;
    }).catch((error) => {
      if (scopeRef.current !== scope || attemptRef.current?.index !== index) return;
      if (!appendErrorReportedRef.current) {
        appendErrorReportedRef.current = true;
        onErrorRef.current(error instanceof Error ? error.message : "Test matnini davom ettirishda xato yuz berdi.");
      }
      appendRetryTimerRef.current = setTimeout(() => setAppendRetry(value => value + 1), 1000);
    }).finally(() => {
      if (appendRequestRef.current === request) appendRequestRef.current = null;
    });
  }, [battleKey, attempt?.index, attempt?.words.length, currentWordIndex, requestWords, appendRetry]);

  return {
    attempt: attemptRef.current ? attempt : null,
    isPending,
    remainingSeconds: attemptRef.current ? remainingSeconds : null,
    startNext,
  };
}
