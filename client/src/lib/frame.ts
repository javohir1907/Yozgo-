import type { CSSProperties } from "react";

/**
 * Cosmetic avatar frame (shop `frame_*` items).
 *
 * The server sends `frameMeta: { ring: "#facc15" }`. This lived inline in
 * profile.tsx, which is why a bought frame was invisible everywhere else — the
 * leaderboard, friends, league, battle and the header each render their own
 * avatar. One helper so every render site draws the ring identically.
 */
export interface FrameMeta {
  ring?: string;
}

const HEX = /^#[0-9a-fA-F]{3,8}$/;

/**
 * Style for the ring, or undefined when there is no frame / the value is not a
 * plain hex colour. Never interpolate an unvalidated string into a style.
 *
 * box-shadow is used rather than `border`, so the ring costs no layout space
 * and cannot shift the avatar or the row around it.
 */
export function frameRingStyle(
  frameMeta: FrameMeta | null | undefined,
  width = 3,
): CSSProperties | undefined {
  const ring = frameMeta?.ring;
  if (typeof ring !== "string" || !HEX.test(ring)) return undefined;
  return { boxShadow: `0 0 0 ${width}px ${ring}` };
}
