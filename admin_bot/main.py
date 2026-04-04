import sys
import os
import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

# --- YANGI QO'SHILGAN QISM: Redis importlari ---
from aiogram.fsm.storage.redis import RedisStorage
from redis.asyncio import Redis

from config import BOT_TOKEN
from handlers import common, stats, ads, comps, users, settings

# 1. Loggingni to'g'ri sozlash (Terminalda hamma jarayon ko'rinishi uchun)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    stream=sys.stdout
)

async def main():
    # 2. Bot ob'ektlarini yaratish
    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    
    # --- YANGI QO'SHILGAN QISM: Redis xotirasini sozlash ---
    # .env dan REDIS_URL ni o'qiymiz, agar topilmasa localhost'dagi Redis'ga ulanadi.
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    redis_client = Redis.from_url(redis_url)
    storage = RedisStorage(redis=redis_client)
    
    # Dispatcher'ga storage (xotira) ni ulash
    dp = Dispatcher(storage=storage)
    
    # Routerlarni botga ulash
    dp.include_router(common.router)
    dp.include_router(stats.router)
    dp.include_router(ads.router)
    dp.include_router(comps.router)
    dp.include_router(users.router)
    dp.include_router(settings.router)

    print("🤖 YOZGO Admin Bot (Redis FSM bilan) ishga tushmoqda...")
    
    # Eski webhook va xabarlarni tozalash
    await bot.delete_webhook(drop_pending_updates=True)
    
    # Pollingni boshlash
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Bot to'xtatildi.")
