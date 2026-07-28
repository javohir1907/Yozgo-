import { describe, it, expect, beforeEach } from "@jest/globals";
import { readUserSettings } from "@/hooks/use-user-settings";

const KEY = "yozgo-user-settings";

describe("readUserSettings", () => {
  beforeEach(() => localStorage.clear());

  it("returns defaults when nothing is stored", () => {
    expect(readUserSettings()).toEqual({
      typingFont: "jetbrains",
      typingSize: "m",
      defaultTimer: 30,
      defaultLanguage: "en",
    });
  });

  it("does not throw on corrupt JSON — the old bare parse crashed the app", () => {
    localStorage.setItem(KEY, "{not valid json");
    expect(() => readUserSettings()).not.toThrow();
    expect(readUserSettings().typingFont).toBe("jetbrains");
  });

  it("drops unknown/invalid field values back to defaults", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        typingFont: "comic-sans",
        typingSize: "xl",
        defaultTimer: 45,
        defaultLanguage: "fr",
        junk: true,
      }),
    );
    expect(readUserSettings()).toEqual({
      typingFont: "jetbrains",
      typingSize: "m",
      defaultTimer: 30,
      defaultLanguage: "en",
    });
  });

  it("keeps valid values", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        typingFont: "roboto",
        typingSize: "l",
        defaultTimer: 60,
        defaultLanguage: "uz",
      }),
    );
    expect(readUserSettings()).toEqual({
      typingFont: "roboto",
      typingSize: "l",
      defaultTimer: 60,
      defaultLanguage: "uz",
    });
  });
});
