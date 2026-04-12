import math
import base64
import logging
import time
import asyncio
from aiogram import Bot, Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from states.forms import AdState
from keyboards.reply import main_menu_kb, cancel_kb, ads_menu_kb
from keyboards.inline import paginated_kb
from api import api_request
from filters import SuperAdminFilter

logger = logging.getLogger("ads")

router = Router()
router.message.filter(SuperAdminFilter())
router.callback_query.filter(SuperAdminFilter())


@router.message(F.text.contains("Reklamalar"))
async def ads_menu(message: Message):
    await message.answer("📢 Reklama bo'limiga xush kelibsiz. Nima qilamiz?", reply_markup=ads_menu_kb())


@router.message(F.text.contains("Asosiy menyu"))
async def back_to_main(message: Message, state: FSMContext):
    await state.clear()
    await message.answer("Asosiy menyu:", reply_markup=main_menu_kb())


# --- REKLAMA QO'SHISH (FSM) ---
@router.message(F.text.contains("Reklama qo'shish"))
async def ad_start(message: Message, state: FSMContext):
    await state.set_state(AdState.title)
    await message.answer("1️⃣ Reklama sarlavhasi (yoki matnini) kiriting:", reply_markup=cancel_kb())


@router.message(AdState.title)
async def ad_title(message: Message, state: FSMContext):
    if not message.text:
        return await message.answer("Iltimos, matn yuboring.")
    await state.update_data(title=message.text)
    await state.set_state(AdState.image_url)
    await message.answer("2️⃣ REKLAMA RASMINI YUBORING (Rasm yuklang).\n(Agar rasm kerak bo'lmasa, <b>yoq</b> deb yozing)")


@router.message(AdState.image_url, F.photo)
async def ad_image_photo(message: Message, state: FSMContext, bot: Bot):
    try:
        photo = message.photo[-1]
        file = await bot.get_file(photo.file_id)
        file_data = await bot.download_file(file.file_path)
        base64_str = base64.b64encode(file_data.read()).decode('utf-8')
        data_uri = f"data:image/jpeg;base64,{base64_str}"

        await state.update_data(imageUrl=data_uri)
        await state.set_state(AdState.link_url)
        await message.answer("3️⃣ Reklama ustiga bosganda qaysi manzilga (URL) o'tsin?\n(Agar manzil yo'q bo'lsa <b>yoq</b> deb yozing)")
    except Exception as e:
        logger.error(f"Rasm yuklashda xatolik: {e}")
        await message.answer("❌ Rasmni yuklab bo'lmadi. Qaytadan urinib ko'ring yoki 'yoq' deb yozing.")


@router.message(AdState.image_url, F.text)
async def ad_image(message: Message, state: FSMContext):
    img = None if message.text.lower() == 'yoq' else message.text
    await state.update_data(imageUrl=img)
    await state.set_state(AdState.link_url)
    await message.answer("3️⃣ Reklama ustiga bosganda qaysi manzilga (URL) o'tsin?\n(Agar manzil yo'q bo'lsa <b>yoq</b> deb yozing)")


@router.message(AdState.link_url)
async def ad_link(message: Message, state: FSMContext):
    if not message.text:
        return await message.answer("Iltimos, URL yoki 'yoq' deb yozing.")
    link = None if message.text.lower() == 'yoq' else message.text
    await state.update_data(linkUrl=link)
    await state.set_state(AdState.duration)
    await message.answer("4️⃣ Necha kun davomida saytda ko'rinsin? (Faqat raqam yozing, masalan: 7)")


@router.message(AdState.duration)
async def ad_duration(message: Message, state: FSMContext):
    if not message.text or not message.text.isdigit():
        return await message.answer("❌ Iltimos, faqat raqam kiriting (masalan: 7)!")
    await state.update_data(durationDays=int(message.text))
    data = await state.get_data()
    
    msg = await message.answer("🔄 Saytga yuklanmoqda... (0s)\n<i>Render Free Tier serveri uyg'onishi 30-60s olishi mumkin.</i>", reply_markup=main_menu_kb())
    
    # Progress ko'rsatuvchi task
    stop_progress = asyncio.Event()
    
    async def update_progress():
        seconds = 5
        while not stop_progress.is_set():
            await asyncio.sleep(5)
            if stop_progress.is_set():
                break
            try:
                await msg.edit_text(
                    f"🔄 Saytga yuklanmoqda... ({seconds}s)\n"
                    f"<i>Render serveri uyg'onmoqda, kutib turing...</i>"
                )
            except Exception:
                pass
            seconds += 5
    
    progress_task = asyncio.create_task(update_progress())
    
    start = time.monotonic()
    response = await api_request("POST", "/ads", payload=data)
    elapsed = round(time.monotonic() - start, 1)
    
    stop_progress.set()
    progress_task.cancel()
    
    if response:
        await msg.edit_text(f"✅ <b>Reklama muvaffaqiyatli qo'shildi!</b>\n⏱ Vaqt: {elapsed}s")
    else:
        await msg.edit_text(
            f"❌ <b>Reklama qo'shishda xatolik!</b> (⏱ {elapsed}s)\n\n"
            f"<i>Sabablar:\n"
            f"1. Server uxlab yotgan (Render Free Tier)\n"
            f"2. API tokeni noto'g'ri\n"
            f"3. Baza xatoligi</i>"
        )
    await state.clear()


# ==========================================
# 📋 SAHIFALASH (PAGINATION)
# ==========================================
async def render_ads_page(message_or_call, page: int):
    try:
        ads_data = await api_request("GET", "/ads/all")
        if not ads_data:
            text = "📭 Hozircha faol reklamalar yo'q yoki API javob bermadi."
            if isinstance(message_or_call, Message):
                return await message_or_call.answer(text)
            else:
                return await message_or_call.message.edit_text(text)

        PER_PAGE = 5
        total_pages = max(1, math.ceil(len(ads_data) / PER_PAGE))
        page = max(0, min(page, total_pages - 1))

        page_ads = ads_data[page * PER_PAGE: (page + 1) * PER_PAGE]

        text = f"📢 <b>Faol reklamalar (Sahifa {page + 1}/{total_pages})</b>\n\n"
        for i, ad in enumerate(page_ads, start=1):
            link = ad.get('linkUrl') or 'Yoq'
            text += f"<b>{i}. {ad.get('title')}</b>\n🔗 Ssilka: {link} | ⏳ {ad.get('durationDays')} kun\n\n"

        kb = paginated_kb(page_ads, page, total_pages, "ad")

        if isinstance(message_or_call, Message):
            await message_or_call.answer(text, reply_markup=kb, disable_web_page_preview=True)
        else:
            await message_or_call.message.edit_text(text, reply_markup=kb, disable_web_page_preview=True)
    except Exception as e:
        logger.error(f"Reklamalar sahifasini ko'rsatishda xatolik: {e}")


@router.message(F.text.contains("Faol reklamalar"))
async def show_active_ads(message: Message):
    await render_ads_page(message, 0)


@router.callback_query(F.data.startswith("page_ad_"))
async def change_ads_page(call: CallbackQuery):
    page = int(call.data.split("_")[2])
    await render_ads_page(call, page)
    await call.answer()


@router.callback_query(F.data.startswith("del_ad_"))
async def delete_ad_callback(call: CallbackQuery):
    ad_id = call.data.split("_")[2]

    response = await api_request("DELETE", f"/ads/{ad_id}")
    if response:
        await call.answer("✅ Reklama o'chirildi!", show_alert=True)
        await render_ads_page(call, 0)
    else:
        await call.answer("❌ Xatolik yuz berdi!", show_alert=True)


@router.callback_query(F.data == "ignore")
async def ignore_callback(call: CallbackQuery):
    await call.answer("Siz shu sahifadasiz 📖")
