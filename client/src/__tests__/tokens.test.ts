import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const raw = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

/** Comments discuss tokens by name; only declarations should be analysed. */
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * `:root` and `.dark` have identical specificity (0,1,0), so whichever block
 * comes LAST in source order wins. Writing the dark block first silently
 * makes every dark-mode token resolve to its light value — which is exactly
 * what happened, and it typechecks and builds cleanly.
 */
describe("theme token cascade", () => {
  const lightAt = css.indexOf(":root,\n  .light {");
  const darkAt = css.indexOf(".dark {");

  it("declares both a light and a dark block", () => {
    expect(lightAt).toBeGreaterThan(-1);
    expect(darkAt).toBeGreaterThan(-1);
  });

  it("declares .dark AFTER :root/.light so dark wins the cascade", () => {
    expect(darkAt).toBeGreaterThan(lightAt);
  });
});

describe("token completeness", () => {
  const block = (marker: string) => {
    const start = css.indexOf(marker);
    const open = css.indexOf("{", start);
    let depth = 0;
    let i = open;
    for (; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    return css.slice(open, i);
  };

  const light = block(":root,\n  .light {");
  const dark = block(".dark {");
  const names = (s: string) =>
    new Set([...s.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]));

  it("defines the same token set in both themes", () => {
    const l = names(light);
    const d = names(dark);
    expect([...l].filter((n) => !d.has(n))).toEqual([]);
    expect([...d].filter((n) => !l.has(n))).toEqual([]);
  });

  it("never references a custom property that is not defined", () => {
    const defined = new Set([
      ...[...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]),
      // Set at runtime by Radix, not by us.
      "--radix-accordion-content-height",
      "--radix-select-content-available-height",
      "--radix-select-content-transform-origin",
    ]);
    const used = [...css.matchAll(/var\((--[a-z0-9-]+)/gi)].map((m) => m[1]);
    const dangling = [...new Set(used)].filter((n) => !defined.has(n));
    expect(dangling).toEqual([]);
  });

  it("keeps --accent distinct from --primary in both themes", () => {
    const get = (s: string, k: string) =>
      s.match(new RegExp(`${k}\\s*:\\s*([^;]+);`))?.[1].trim();
    expect(get(light, "--accent")).not.toBe(get(light, "--primary"));
    expect(get(dark, "--accent")).not.toBe(get(dark, "--primary"));
  });
});
