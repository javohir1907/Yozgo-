import request from "supertest";
import { app } from "../index";

// Asosiy sahifalar va muhim API endpointlari testi
describe("General Route and Public API Test", () => {
    
    // Front va Back bog'langanini tekshirish
    it("Asosiy sahifa (home) 200 qaytarishi kerak", async () => {
        const res = await request(app).get("/");
        expect(res.statusCode).toBe(200);
    });

    // Public API endpoint testi (bu biz boya kashf qilgan yangi endpoint)
    it("Public platform info API ma'lumot qaytarishi kerak", async () => {
        const res = await request(app).get("/api/public/info");
        
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("platform", "YOZGO");
        expect(res.body).toHaveProperty("website", "https://yozgo.uz");
    });

    // Leaderboard API (ko'p ishlatiladigan)
    it("Leaderboard API ishlamoqillishi kerak", async () => {
        const res = await request(app).get("/api/leaderboard");
        
        // 200 bo'lishi kerak va agar array bo'lsa (data bor bo'lsa)
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    // Tanlovlar (Competitions) API testi
    it("Musobaqalar ro'yxati API 200 qaytarishi kerak", async () => {
        const res = await request(app).get("/api/competitions");
        
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    // E'lonlar (Advertisements)
    it("Reklamalar API ishlayotganini tekshirish", async () => {
        const res = await request(app).get("/api/advertisements");
        
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});
