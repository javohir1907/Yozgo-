import { jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useBattleAttempt } from "@/hooks/use-battle-attempt";
import type { BattleAttemptData, BattleAttemptResponse, BattleWordsResponse } from "@shared/battle-attempt";

function makeAttempt(index: number, count = 1000): BattleAttemptData {
  const now = Date.now();
  return {
    index,
    words: Array.from({ length: count }, (_, offset) => `round-${index}-word-${offset}`),
    startTime: now,
    endTime: now + 30000,
    serverNow: now,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function makeOptions() {
  return {
    battleKey: "ROOM:100",
    currentWordIndex: 0,
    requestAttempt: jest.fn<(previousIndex: number) => Promise<BattleAttemptResponse>>()
      .mockImplementation(async previousIndex => ({ attempt: makeAttempt(previousIndex + 1) })),
    requestWords: jest.fn<(index: number, offset: number) => Promise<BattleWordsResponse>>()
      .mockImplementation(async (index, offset) => ({
        index, offset,
        words: Array.from({ length: 1000 }, (_, position) => `round-${index}-word-${offset + position}`),
      })),
    onError: jest.fn<(message: string) => void>(),
  };
}

describe("continuous battle attempts", () => {
  it("starts 100 nonempty rounds without an attempt or word budget ceiling", async () => {
    const options = makeOptions();
    const { result } = renderHook(() => useBattleAttempt(options));

    for (let index = 0; index < 100; index++) {
      await act(async () => { await result.current.startNext(); });
      expect(result.current.attempt?.index).toBe(index);
      expect(result.current.attempt?.words[0]).toBe(`round-${index}-word-0`);
      expect(result.current.remainingSeconds).toBe(30);
    }
    expect(options.requestAttempt).toHaveBeenCalledTimes(100);
    expect(options.requestAttempt).toHaveBeenLastCalledWith(98);
    expect(options.onError).not.toHaveBeenCalled();
  });

  it("waits for text and combines repeated start presses into one pending request", async () => {
    const options = makeOptions();
    const response = deferred<BattleAttemptResponse>();
    options.requestAttempt.mockReturnValue(response.promise);
    const { result } = renderHook(() => useBattleAttempt(options));
    let start!: Promise<void>;

    act(() => {
      start = result.current.startNext();
      void result.current.startNext();
      void result.current.startNext();
    });
    expect(options.requestAttempt).toHaveBeenCalledTimes(1);
    expect(result.current.isPending).toBe(true);
    expect(result.current.attempt).toBeNull();
    expect(result.current.remainingSeconds).toBeNull();

    await act(async () => {
      response.resolve({ attempt: makeAttempt(0) });
      await start;
    });
    expect(result.current.attempt?.words.length).toBe(1000);
    expect(result.current.remainingSeconds).toBe(30);
    expect(result.current.isPending).toBe(false);
  });

  it("extends one round beyond 6000 words while retaining its original text and clock", async () => {
    const options = makeOptions();
    const { result, rerender } = renderHook(({ currentWordIndex }) =>
      useBattleAttempt({ ...options, currentWordIndex }), { initialProps: { currentWordIndex: 0 } });
    await act(async () => { await result.current.startNext(); });
    const original = result.current.attempt!;

    for (let block = 0; block < 7; block++) {
      const loaded = result.current.attempt!.words.length;
      rerender({ currentWordIndex: loaded - 200 });
      await waitFor(() => expect(result.current.attempt?.words.length).toBe(loaded + 1000));
      expect(result.current.attempt?.localStartTime).toBe(original.localStartTime);
      expect(result.current.attempt?.localEndTime).toBe(original.localEndTime);
    }
    expect(result.current.attempt?.words.length).toBe(8000);
    expect(result.current.attempt?.words.slice(0, 1000)).toEqual(original.words);
    expect(result.current.attempt?.words[7999]).toBe("round-0-word-7999");
    expect(options.requestWords).toHaveBeenCalledTimes(7);
  });

  it("anchors a reconnect to server time and requests the round after the restored index", async () => {
    const options = makeOptions();
    const snapshot = {
      ...makeAttempt(27), startTime: 10000, endTime: 70000, serverNow: 20000,
    };
    const { result, rerender } = renderHook(({ snapshot }) =>
      useBattleAttempt({ ...options, snapshot, snapshotIndex: snapshot.index }), { initialProps: { snapshot } });
    expect(result.current.attempt?.index).toBe(27);
    expect(result.current.remainingSeconds).toBe(50);
    expect(result.current.attempt?.localStartTime).toBeGreaterThan(10000);

    rerender({ snapshot: { ...snapshot, serverNow: 71000 } });
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.attempt?.words.length).toBe(1000);
    await act(async () => { await result.current.startNext(); });
    expect(options.requestAttempt).toHaveBeenLastCalledWith(27);
    expect(result.current.attempt?.index).toBe(28);
  });

  it("ignores an old room's delayed response without releasing a new room's pending request", async () => {
    const options = makeOptions();
    const oldResponse = deferred<BattleAttemptResponse>();
    const newResponse = deferred<BattleAttemptResponse>();
    options.requestAttempt.mockReturnValueOnce(oldResponse.promise).mockReturnValueOnce(newResponse.promise);
    const { result, rerender } = renderHook(({ battleKey }) =>
      useBattleAttempt({ ...options, battleKey }), { initialProps: { battleKey: "OLD:1" } });
    let oldStart!: Promise<void>;
    act(() => { oldStart = result.current.startNext(); });
    rerender({ battleKey: "NEW:2" });
    let newStart!: Promise<void>;
    act(() => { newStart = result.current.startNext(); });

    await act(async () => {
      oldResponse.resolve({ attempt: makeAttempt(0) });
      await oldStart;
    });
    expect(result.current.attempt).toBeNull();
    expect(result.current.isPending).toBe(true);
    await act(async () => {
      newResponse.resolve({ attempt: makeAttempt(0) });
      await newStart;
    });
    expect(result.current.attempt?.index).toBe(0);
    expect(result.current.isPending).toBe(false);
  });

  it("rejects empty text without starting the clock or advancing the previous index", async () => {
    const options = makeOptions();
    options.requestAttempt.mockResolvedValueOnce({ attempt: makeAttempt(0, 0) });
    const { result } = renderHook(() => useBattleAttempt(options));
    await act(async () => { await result.current.startNext(); });
    expect(result.current.attempt).toBeNull();
    expect(result.current.remainingSeconds).toBeNull();
    expect(options.onError).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.startNext(); });
    expect(options.requestAttempt).toHaveBeenLastCalledWith(-1);
    expect(result.current.attempt?.index).toBe(0);
  });
});
