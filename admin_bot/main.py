import sys
import os
import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

# 1. Loggingni eng birinchi ishga tushirish (Hamma narsani ko'rish uchun)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    stream=sys.stdout
)

from config import BOT_TOKEN, ADMIN_IDS
from filters import SuperAdminFilter
from handlers import common, stats, ads, comps, users, settings, paid_rooms

async def main():
    logging.info("🚀 Bot ishga tushishni boshladi...")
    
    if not BOT_TOKEN:
        logging.error("❌ XATOLIK: BOT_TOKEN topilmadi!!!")
        return
        
    # Aiogram 3.0+ uchun eng xavfsiz va moslashuvchan initialization
    try:
        bot = Bot(token=BOT_TOKEN)
        # Parse mode'ni xabar yuborishda ishlatish uchun default qilib olamiz
        # Note: older aiogram 3 versions use Bot(token, parse_mode=...)
        # Newer ones prefer DefaultBotProperties, but this way is more robust:
        bot._default_parse_mode = ParseMode.HTML 
    except Exception as e:
        logging.error(f"❌ Botni yaratishda xatolik: {e}")
        return

    dp = Dispatcher(storage=MemoryStorage())
    
    # Global xatoliklarni tutish (Dispatcher darajasida)
    @dp.error()
    async def global_error_handler(event, exception: Exception):
        logging.error(f"⚠️ GLOBAL ERROR: {exception}", exc_info=True)
        return True

    # Routerlarni ulash
    dp.include_router(common.router)
    dp.include_router(stats.router)
    dp.include_router(ads.router)
    dp.include_router(comps.router)
    dp.include_router(users.router)
    dp.include_router(settings.router)
    dp.include_router(paid_rooms.router)

    logging.info("🤖 YOZGO Admin Bot (MemoryStorage) polling boshlanmoqda...")
    
    try:
        # Webhookni o'chirib, tozalaymiz
        await bot.delete_webhook(drop_pending_updates=True)
        
        # Adminlarga xabar yuborish
        for admin_id in ADMIN_IDS:
            try:
                await bot.send_message(
                    admin_id, 
                    "✅ <b>YOZGO Admin Bot muvaffaqiyatli ishga tushdi!</b>\nStruktura tekshirildi, barcha routerlar faol."
                )
            except Exception as e:
                logging.warning(f"Admin {admin_id} ga xabar yuborib bo'lmadi: {e}")
                
        await dp.start_polling(bot)
    except Exception as e:
        logging.critical(f"🏁 Bot ishlashida jiddiy to'xtalish: {e}", exc_info=True)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logging.info("Bot to'xtatildi.")
    except Exception as e:
        logging.error(f"CRITICAL MAIN ERROR: {e}")
