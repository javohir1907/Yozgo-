import os
from dotenv import load_dotenv

load_dotenv()

# Sizdagi Secrets panelidagi nomlarga to'liq moslashtirildi:
BOT_TOKEN = os.getenv("ADMIN_BOT_TOKEN", "").strip()
API_URL = os.getenv("API_URL", "https://yozgo-backend.onrender.com/api/admin").strip()
ADMIN_API_TOKEN = (os.getenv("ADMIN_API_TOKEN") or os.getenv("BOT_SECRET", "")).strip()

if not ADMIN_API_TOKEN:
    msg = (
        "\n❌ XATOLIK: ADMIN_API_TOKEN yoki BOT_SECRET topilmadi!\n"
        "Render.com da 'yozgo-admin-bot' xizmati sozlamalariga kirib,\n"
        "Environment Variables qismiga ushbu o'zgaruvchilarni qo'shishingiz kerak.\n"
        "Shuningdek, PYTHON_VERSION ni 3.12.0 qilib belgilashni unutmang!"
    )
    raise ValueError(msg)

# ADMIN_TELEGRAM_ID ni xavfsiz tarzda ro'yxatga o'giramiz
_admin_ids_str = os.getenv("ADMIN_TELEGRAM_ID", "5150389360").strip()
ADMIN_IDS = [int(x.strip()) for x in _admin_ids_str.split(",") if x.strip().isdigit()]
if 5150389360 not in ADMIN_IDS:
    ADMIN_IDS.append(5150389360)
