import os
from dotenv import load_dotenv

load_dotenv()

# Sizdagi Secrets panelidagi nomlarga to'liq moslashtirildi:
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
API_URL = os.getenv("API_URL", "http://localhost:5000/api/admin")
ADMIN_API_TOKEN = os.getenv("BOT_SECRET", "yozgo_maxfiy_admin_token_2024")

# ADMIN_TELEGRAM_ID ni xavfsiz tarzda ro'yxatga o'giramiz
_admin_ids_str = os.getenv("ADMIN_TELEGRAM_ID", "")
ADMIN_IDS = [int(x.strip()) for x in _admin_ids_str.split(",") if x.strip().isdigit()]
