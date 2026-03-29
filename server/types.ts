import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

export interface PlayerPerformance {
  wpm: number;
  accuracy: number;
  progress: number;
  timestamp: number;
}
