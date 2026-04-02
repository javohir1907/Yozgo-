import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from config import BOT_TOKEN
# Yaratilgan handlerlarni ulash
from handlers import common, stats, ads, comps, users, settings

logging.basicConfig(level=logging.INFO)

async def main():
    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    
    # Routerlarni botga ulash
    dp.include_router(common.router)
    dp.include_router(stats.router)
    dp.include_router(ads.router)
    dp.include_router(comps.router)
    dp.include_router(users.router)
    dp.include_router(settings.router)

    print("🤖 YOZGO Admin Bot ishga tushmoqda...")
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
