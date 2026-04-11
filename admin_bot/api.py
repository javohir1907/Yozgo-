import asyncio
import aiohttp
import logging
from config import API_URL, ADMIN_API_TOKEN

async def api_request(method: str, endpoint: str, payload: dict = None):
    headers = {
        "X-Admin-Token": ADMIN_API_TOKEN,
        "X-Bot-Secret": ADMIN_API_TOKEN
    }
    url = f"{API_URL}{endpoint}"
    
    timeout = aiohttp.ClientTimeout(total=15)
    
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            if method.upper() == "GET":
                async with session.get(url, headers=headers) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    else:
                        logging.error(f"API Error ({endpoint}): Status {resp.status}")
                        return None
            elif method.upper() == "POST":
                async with session.post(url, headers=headers, json=payload) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    else:
                        logging.error(f"API Error ({endpoint}): Status {resp.status}")
                        return None
            elif method.upper() == "DELETE":
                async with session.delete(url, headers=headers) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    else:
                        logging.error(f"API Error ({endpoint}): Status {resp.status}")
                        return None
    except (asyncio.TimeoutError, TimeoutError):
        logging.error(f"API Timeout ({endpoint})")
        return None
    except Exception as e:
        logging.error(f"API Xatoligi ({endpoint}): {e}")
        return None
