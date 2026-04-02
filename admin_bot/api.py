import aiohttp
import logging
from config import API_URL, ADMIN_API_TOKEN

async def api_request(method: str, endpoint: str, payload: dict = None):
    """YOZGO backendiga so'rov yuborish (GET, POST)"""
    headers = {"X-Admin-Token": ADMIN_API_TOKEN}
    url = f"{API_URL}{endpoint}"
    
    try:
        async with aiohttp.ClientSession() as session:
            if method.upper() == "GET":
                async with session.get(url, headers=headers) as resp:
                    return await resp.json() if resp.status == 200 else None
            elif method.upper() == "POST":
                async with session.post(url, headers=headers, json=payload) as resp:
                    return await resp.json() if resp.status == 200 else None
    except Exception as e:
        logging.error(f"API Xatoligi ({endpoint}): {e}")
        return None
