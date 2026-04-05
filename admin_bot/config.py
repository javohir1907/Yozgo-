import os
from dotenv import load_dotenv

load_dotenv()

# Sizdagi Secrets panelidagi nomlarga to'liq moslashtirildi:
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
API_URL = os.getenv("API_URL", "https://yozgo.uz/api/admin")
ADMIN_API_TOKEN = os.getenv("ADMIN_API_TOKEN")
if not ADMIN_API_TOKEN:
    raise ValueError("ADMIN_API_TOKEN muhit o'zgaruvchisi topilmadi! Tizim xavfsizligi doirasida bot ishlashdan to'xtatildi.")

# ADMIN_TELEGRAM_ID ni xavfsiz tarzda ro'yxatga o'giramiz
_admin_ids_str = os.getenv("ADMIN_TELEGRAM_ID", "")
ADMIN_IDS = [int(x.strip()) for x in _admin_ids_str.split(",") if x.strip().isdigit()]
