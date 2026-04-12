import sys
import os
import asyncio
import logging

# 1. Loggingni eng birinchi ishga tushirish
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    stream=sys.stdout
)
logger = logging.getLogger("admin_bot")

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

from config import BOT_TOKEN, ADMIN_IDS
from filters import SuperAdminFilter
from handlers import common, stats, ads, comps, users, settings, paid_rooms


async def main():
    logger.info("🚀 Bot ishga tushishni boshladi...")

    if not BOT_TOKEN:
        logger.error("❌ ADMIN_BOT_TOKEN topilmadi! Render Environment Variables ni tekshiring.")
        return

    # Bot yaratish — DefaultBotProperties bilan parse_mode o'rnatiladi
    try:
        bot = Bot(
            token=BOT_TOKEN,
            default=DefaultBotProperties(parse_mode=ParseMode.HTML)
        )
        logger.info("✅ Bot obyekti yaratildi")
    except Exception as e:
        logger.error(f"❌ Bot obyektini yaratishda xatolik: {e}", exc_info=True)
        return

    # Dispatcher
    dp = Dispatcher(storage=MemoryStorage())

    # Routerlarni ulash
    dp.include_router(common.router)
    dp.include_router(stats.router)
    dp.include_router(ads.router)
    dp.include_router(comps.router)
    dp.include_router(users.router)
    dp.include_router(settings.router)
    dp.include_router(paid_rooms.router)

    logger.info(f"✅ {7} ta router ulandi")

    # Webhook tozalash va polling boshlash
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        logger.info("✅ Webhook tozalandi, pending updates tashlab yuborildi")
    except Exception as e:
        logger.warning(f"Webhook tozalashda muammo (davom etilmoqda): {e}")

    # Adminlarga diagnostika xabarini yuborish
    for admin_id in ADMIN_IDS:
        try:
            await bot.send_message(
                admin_id,
                "✅ <b>YOZGO Admin Bot muvaffaqiyatli ishga tushdi!</b>\n"
                "Barcha routerlar faol, polling boshlandi."
            )
        except Exception as e:
            logger.warning(f"Admin {admin_id} ga xabar yuborib bo'lmadi: {e}")

    # Polling — bu cheksiz (infinite) loop, shuning uchun try/except ichida
    logger.info("🤖 Polling boshlanmoqda...")
    try:
        await dp.start_polling(bot)
    except Exception as e:
        logger.critical(f"Polling to'xtadi: {e}", exc_info=True)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Bot foydalanuvchi tomonidan to'xtatildi.")
    except Exception as e:
        logging.error(f"KRITIK XATOLIK: {e}", exc_info=True)
