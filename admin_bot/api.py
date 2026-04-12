import asyncio
import time
import aiohttp
import logging
from config import API_URL, ADMIN_API_TOKEN

logger = logging.getLogger("api")


async def api_request(method: str, endpoint: str, payload: dict = None):
    """
    Backend API ga so'rov yuborish.
    Muvaffaqiyatli bo'lsa JSON qaytaradi, aks holda None.
    """
    headers = {
        "Content-Type": "application/json",
        "X-Admin-Token": ADMIN_API_TOKEN,
        "X-Bot-Secret": ADMIN_API_TOKEN
    }

    base_url = API_URL.rstrip('/')
    clean_endpoint = endpoint.lstrip('/')
    url = f"{base_url}/{clean_endpoint}"

    timeout = aiohttp.ClientTimeout(total=20)
    start_time = time.monotonic()

    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            if method.upper() == "GET":
                async with session.get(url, headers=headers) as resp:
                    elapsed = round(time.monotonic() - start_time, 2)
                    return await _handle_response(resp, endpoint, elapsed)

            elif method.upper() == "POST":
                async with session.post(url, headers=headers, json=payload) as resp:
                    elapsed = round(time.monotonic() - start_time, 2)
                    return await _handle_response(resp, endpoint, elapsed)

            elif method.upper() == "DELETE":
                async with session.delete(url, headers=headers) as resp:
                    elapsed = round(time.monotonic() - start_time, 2)
                    return await _handle_response(resp, endpoint, elapsed)

    except (asyncio.TimeoutError, TimeoutError):
        elapsed = round(time.monotonic() - start_time, 2)
        logger.error(f"⏱️ API TIMEOUT ({elapsed}s): {method} {url}")
        return None
    except aiohttp.ClientConnectorError as e:
        elapsed = round(time.monotonic() - start_time, 2)
        logger.error(f"🔌 ULANISH XATOLIGI ({elapsed}s): {method} {url} -> {e}")
        return None
    except Exception as e:
        elapsed = round(time.monotonic() - start_time, 2)
        logger.error(f"❌ API XATOLIGI ({elapsed}s): {method} {url} -> {type(e).__name__}: {e}")
        return None


async def _handle_response(resp: aiohttp.ClientResponse, endpoint: str, elapsed: float):
    """Javobni qayta ishlash va logga yozish."""
    if resp.status == 200:
        logger.info(f"✅ API OK ({elapsed}s): {endpoint}")
        return await resp.json()
    elif resp.status == 403:
        body = await resp.text()
        logger.error(
            f"🔒 API 403 FORBIDDEN ({elapsed}s): {endpoint}\n"
            f"   Sabab: Backend BOT_SECRET yoki ADMIN_API_TOKEN mos kelmaydi!\n"
            f"   Javob: {body[:200]}"
        )
        return None
    elif resp.status == 404:
        logger.error(f"🔍 API 404 NOT FOUND ({elapsed}s): {endpoint}")
        return None
    elif resp.status == 500:
        body = await resp.text()
        logger.error(f"💥 API 500 SERVER ERROR ({elapsed}s): {endpoint} -> {body[:200]}")
        return None
    else:
        body = await resp.text()
        logger.error(f"⚠️ API {resp.status} ({elapsed}s): {endpoint} -> {body[:200]}")
        return None
