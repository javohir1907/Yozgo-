import asyncio
import time
import aiohttp
import logging
from config import API_URL, ADMIN_API_TOKEN

logger = logging.getLogger("api")

# Render Free Tier cold start 30-60s olishi mumkin
API_TIMEOUT = 60


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

    timeout = aiohttp.ClientTimeout(total=API_TIMEOUT)
    start_time = time.monotonic()

    logger.info(f"🔄 API so'rov: {method} {url}")

    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            if method.upper() == "GET":
                async with session.get(url, headers=headers) as resp:
                    elapsed = round(time.monotonic() - start_time, 2)
                    return await _handle_response(resp, endpoint, elapsed, url)

            elif method.upper() == "POST":
                async with session.post(url, headers=headers, json=payload) as resp:
                    elapsed = round(time.monotonic() - start_time, 2)
                    return await _handle_response(resp, endpoint, elapsed, url)

            elif method.upper() == "DELETE":
                async with session.delete(url, headers=headers) as resp:
                    elapsed = round(time.monotonic() - start_time, 2)
                    return await _handle_response(resp, endpoint, elapsed, url)

    except (asyncio.TimeoutError, TimeoutError):
        elapsed = round(time.monotonic() - start_time, 2)
        logger.error(f"⏱️ TIMEOUT ({elapsed}s): {method} {url} — Server {API_TIMEOUT}s ichida javob bermadi")
        return None
    except aiohttp.ClientConnectorError as e:
        elapsed = round(time.monotonic() - start_time, 2)
        logger.error(f"🔌 ULANISH XATOLIGI ({elapsed}s): {url} -> {e}")
        return None
    except Exception as e:
        elapsed = round(time.monotonic() - start_time, 2)
        logger.error(f"❌ XATOLIK ({elapsed}s): {url} -> {type(e).__name__}: {e}")
        return None


async def _handle_response(resp: aiohttp.ClientResponse, endpoint: str, elapsed: float, url: str):
    """Javobni qayta ishlash va logga yozish."""
    if resp.status == 200:
        logger.info(f"✅ OK ({elapsed}s): {endpoint}")
        return await resp.json()
    elif resp.status == 403:
        body = await resp.text()
        logger.error(
            f"🔒 403 FORBIDDEN ({elapsed}s): {url}\n"
            f"   TOKEN MOS KELMAYDI! Render'da BOT_SECRET/ADMIN_API_TOKEN ni tekshiring.\n"
            f"   Javob: {body[:200]}"
        )
        return None
    elif resp.status == 404:
        logger.error(f"🔍 404 ({elapsed}s): {url} — endpoint mavjud emas")
        return None
    elif resp.status == 500:
        body = await resp.text()
        logger.error(f"💥 500 ({elapsed}s): {url} -> {body[:200]}")
        return None
    else:
        body = await resp.text()
        logger.error(f"⚠️ {resp.status} ({elapsed}s): {url} -> {body[:200]}")
        return None
