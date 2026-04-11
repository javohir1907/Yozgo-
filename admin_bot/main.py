import sys
import os
import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

from config import BOT_TOKEN
from filters import SuperAdminFilter
from handlers import common, stats, ads, comps, users, settings, paid_rooms

# 1. Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    stream=sys.stdout
)

async def main():
    if not BOT_TOKEN:
        print("XATOLIK: .env orqali TELEGRAM_BOT_TOKEN topilmadi!!!")
        return
        
    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    
    # Redis o'rniga kompyuterning oddiy xotirasini ishlatamiz!
    dp = Dispatcher(storage=MemoryStorage())
    
    # GLOBAL FILTER: Faqat ADMIN_IDS dagi odamlarga javob beradi
    dp.message.filter(SuperAdminFilter())
    dp.callback_query.filter(SuperAdminFilter())
    
    # Routerlarni ulash
    dp.include_router(common.router)
    dp.include_router(stats.router)
    dp.include_router(ads.router)
    dp.include_router(comps.router)
    dp.include_router(users.router)
    dp.include_router(settings.router)
    dp.include_router(paid_rooms.router)

    print("🤖 YOZGO Admin Bot (MemoryStorage bilan) ishga tushmoqda...")
    
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Bot to'xtatildi.")
