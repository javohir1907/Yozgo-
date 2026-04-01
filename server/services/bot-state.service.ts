import { db } from "../db";
import { botStates } from "@shared/schema";
import { eq } from "drizzle-orm";

export class BotStateService {
  /**
   * Foydalanuvchining botdagi holatini bazadan oladi
   */
  static async getState(telegramId: string | number): Promise<any> {
    const id = String(telegramId);
    const [record] = await db.select().from(botStates).where(eq(botStates.telegramId, id));
    return record ? record.stateData : null;
  }

  /**
   * Foydalanuvchi holatini bazaga yozadi yoki yangilaydi
   */
  static async setState(telegramId: string | number, data: any): Promise<void> {
    const id = String(telegramId);
    await db.insert(botStates)
      .values({ telegramId: id, stateData: data, lastActivity: new Date() })
      .onConflictDoUpdate({ 
        target: botStates.telegramId, 
        set: { stateData: data, lastActivity: new Date() } 
      });
  }

  /**
   * Foydalanuvchi jarayonni tugatgach holatni o'chiradi
   */
  static async clearState(telegramId: string | number): Promise<void> {
    const id = String(telegramId);
    await db.delete(botStates).where(eq(botStates.telegramId, id));
  }
}
