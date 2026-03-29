import request from "supertest";
import { app } from "../index";
import { db } from "../db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

// Auth testlari
describe("Authentication API", () => {
  const testEmail = `test_${Date.now()}@yozgo.uz`;
  const testPassword = "testPassword123";
  const testNickname = `user_${Math.floor(Math.random() * 100000)}`;

  // Testdan so'ng ma'lumotlarni tozalash
  afterAll(async () => {
    try {
      await db.delete(users).where(eq(users.email, testEmail));
    } catch (e) {
      console.error("Cleanup xatosi:", e);
    }
  });

  // Ro'yxatdan o'tish testi
  it("Foydalanuvchi muvaffaqiyatli ro'yxatdan o'tishi kerak", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: testEmail,
        password: testPassword,
        firstName: testNickname
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty("email", testEmail);
    expect(res.body).toHaveProperty("firstName", testNickname);
  });

  // Login testi
  it("Foydalanuvchi login qila olishi kerak", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: testEmail,
        password: testPassword
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("email", testEmail);
  });

  // Profilni olish testi (session bilan)
  it("Login qilgan foydalanuvchi o'z ma'lumotlarini olishi kerak", async () => {
    const agent = request.agent(app);
    
    // Avval login qilish (cookie saqlash uchun)
    await agent
      .post("/api/auth/login")
      .send({
        email: testEmail,
        password: testPassword
      });

    const res = await agent.get("/api/auth/user");
    expect(res.statusCode).toEqual(200);
    expect(res.body.email).toEqual(testEmail);
  });

  // Logout testi
  it("Foydalanuvchi tizimdan chiqa olishi kerak", async () => {
    const agent = request.agent(app);
    
    await agent
      .post("/api/auth/login")
      .send({
        email: testEmail,
        password: testPassword
      });

    const res = await agent.post("/api/auth/logout");
    expect(res.statusCode).toEqual(200);
    
    // Logoutdan so'ng profilga kirib bo'lmasligi kerak
    const userRes = await agent.get("/api/auth/user");
    expect(userRes.statusCode).toEqual(401);
  });
});
