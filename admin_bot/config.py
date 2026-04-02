import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("ADMIN_BOT_TOKEN")
API_URL = os.getenv("API_URL", "http://localhost:5000/api/admin")
ADMIN_API_TOKEN = os.getenv("ADMIN_API_TOKEN")

# Admin ID larni xavfsiz tarzda ro'yxatga o'giramiz
_admin_ids_str = os.getenv("ADMIN_IDS", "")
ADMIN_IDS = [int(x.strip()) for x in _admin_ids_str.split(",") if x.strip().isdigit()]
