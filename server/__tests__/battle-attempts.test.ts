import { jest } from "@jest/globals";
import { BattleWordSource } from "../utils/battle-word-source";

// Authentication is enforced before these handlers. Isolate its middleware so
// this lifecycle test needs neither credentials nor a PostgreSQL connection.
jest.unstable_mockModule("../auth", () => ({ sessionMiddleware: null }));
const { BattleManager } = await import("../battle-manager");

function setup() {
  // Exercise the real request handlers without starting timers or a database
  // lifecycle. Room membership and the text source are the production objects.
  const manager = Object.create(BattleManager.prototype) as any;
  const socket = { id: "player-one" };
  const otherSocket = { id: "player-two" };
  const makePlayer = (playerSocket: typeof socket) => ({
    socket: playerSocket,
    currentAttemptIndex: -1,
    loadedWordCount: 0,
    progress: 0,
    wpm: 0,
  });
  const first = makePlayer(socket);
  const second = makePlayer(otherSocket);
  const room = {
    code: "TEST",
    status: "playing",
    startTime: Date.now(),
    endTime: Date.now() + 300_000,
    settings: { testDuration: 30, totalTime: 5 },
    players: new Map([["one", first], ["two", second]]),
    wordSource: new BattleWordSource("en"),
  };
  manager.rooms = new Map([[room.code, room]]);
  return { manager, room, socket, otherSocket, first, second };
}

describe("battle attempts", () => {
  it("serves 100 fresh attempts while the room still has time", () => {
    const { manager, room, socket } = setup();
    const orders = new Set<string>();

    for (let previousIndex = -1; previousIndex < 99; previousIndex += 1) {
      const response = manager.handleAttemptRequest(socket, room.code, "one", previousIndex);
      expect(response.error).toBeUndefined();
      expect(response.attempt.index).toBe(previousIndex + 1);
      expect(response.attempt.words).toHaveLength(1000);
      orders.add(response.attempt.words.join(" "));
    }
    expect(orders.size).toBe(100);
  });

  it("does not advance twice when an acknowledgement is retried", () => {
    const { manager, room, socket } = setup();
    const accepted = manager.handleAttemptRequest(socket, room.code, "one", -1).attempt;
    const retry = manager.handleAttemptRequest(socket, room.code, "one", -1).attempt;

    expect(retry.index).toBe(accepted.index);
    expect(retry.endTime).toBe(accepted.endTime);
    expect(retry.words).toEqual(accepted.words);
  });

  it("gives two participants the same words for the same numbered attempt", () => {
    const { manager, room, socket, otherSocket } = setup();
    const first = manager.handleAttemptRequest(socket, room.code, "one", -1).attempt;
    const second = manager.handleAttemptRequest(otherSocket, room.code, "two", -1).attempt;
    expect(second.words).toEqual(first.words);
  });

  it("extends a single attempt past 6000 words and restores it on reconnect", () => {
    const { manager, room, socket, first } = setup();
    const initial = manager.handleAttemptRequest(socket, room.code, "one", -1).attempt;
    const text = [...initial.words];

    while (text.length < 8000) {
      const response = manager.handleWordsRequest(socket, room.code, "one", 0, text.length);
      expect(response.error).toBeUndefined();
      expect(response.offset).toBe(text.length);
      text.push(...response.words);
    }
    const restored = manager.getBattleStartData(room, first).attempt;
    expect(restored.words).toEqual(text);
    expect(restored.index).toBe(0);
    expect(restored.endTime).toBe(initial.endTime);
  });

  it("rejects stale extensions and skipped cursors without consuming an attempt", () => {
    const { manager, room, socket, first } = setup();
    manager.handleAttemptRequest(socket, room.code, "one", -1);

    expect(manager.handleWordsRequest(socket, room.code, "one", 1, 1000).error).toBeTruthy();
    expect(manager.handleWordsRequest(socket, room.code, "one", 0, 2000).error).toBeTruthy();
    expect(manager.handleAttemptRequest(socket, room.code, "one", 100).error).toBeTruthy();
    expect(first.currentAttemptIndex).toBe(0);
  });

  it("ends generation when the room timer expires", () => {
    const { manager, room, socket } = setup();
    room.endTime = Date.now() - 1;
    expect(manager.handleAttemptRequest(socket, room.code, "one", -1).error).toBeTruthy();
  });
});
