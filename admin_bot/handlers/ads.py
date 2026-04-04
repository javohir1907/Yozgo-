import math
import aiohttp
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from states.forms import AdState
from keyboards.reply import main_menu_kb, cancel_kb, ads_menu_kb
from keyboards.inline import paginated_kb
from api import api_request
from config import API_URL, ADMIN_API_TOKEN

router = Router()

@router.message(F.text.contains("Reklamalar"))
async def ads_menu(message: Message):
    await message.answer("📢 Reklama bo'limiga xush kelibsiz. Nima qilamiz?", reply_markup=ads_menu_kb())

@router.message(F.text.contains("Asosiy menyu"))
async def back_to_main(message: Message, state: FSMContext):
    await state.clear()
    await message.answer("Asosiy menyu:", reply_markup=main_menu_kb())

# --- REKLAMA QO'SHISH (FSM) QISMI O'ZGARISHSIZ QOLDI ---
@router.message(F.text.contains("Reklama qo'shish"))
async def ad_start(message: Message, state: FSMContext):
    await state.set_state(AdState.title)
    await message.answer("1️⃣ Reklama sarlavhasi (yoki matnini) kiriting:", reply_markup=cancel_kb())

@router.message(AdState.title)
async def ad_title(message: Message, state: FSMContext):
    await state.update_data(title=message.text)
    await state.set_state(AdState.image_url)
    await message.answer("2️⃣ Rasm ssilkasini (URL) yuboring.\n(Agar rasm kerak bo'lmasa, <b>yoq</b> deb yozing)")

@router.message(AdState.image_url)
async def ad_image(message: Message, state: FSMContext):
    img = None if message.text.lower() == 'yoq' else message.text
    await state.update_data(imageUrl=img)
    await state.set_state(AdState.link_url)
    await message.answer("3️⃣ Reklama ustiga bosganda qaysi manzilga (URL) o'tsin?\n(Agar manzil yo'q bo'lsa <b>yoq</b> deb yozing)")

@router.message(AdState.link_url)
async def ad_link(message: Message, state: FSMContext):
    link = None if message.text.lower() == 'yoq' else message.text
    await state.update_data(linkUrl=link)
    await state.set_state(AdState.duration)
    await message.answer("4️⃣ Necha kun davomida saytda ko'rinsin? (Faqat raqam yozing, masalan: 7)")

@router.message(AdState.duration)
async def ad_duration(message: Message, state: FSMContext):
    if not message.text.isdigit():
        return await message.answer("❌ Iltimos, faqat raqam kiriting (masalan: 7)!")
    await state.update_data(durationDays=int(message.text))
    data = await state.get_data()
    msg = await message.answer("🔄 Saytga yuklanmoqda...", reply_markup=main_menu_kb())
    response = await api_request("POST", "/ads", payload=data)
    if response:
        await msg.edit_text("✅ <b>Reklama muvaffaqiyatli qo'shildi!</b>")
    else:
        await msg.edit_text("❌ Reklama qo'shishda xatolik yuz berdi.")
    await state.clear()

# ==========================================
# 📋 SAHIFALASH (PAGINATION) MANTIQI
# ==========================================
async def render_ads_page(message_or_call, page: int):
    ads_data = await api_request("GET", "/ads/all")
    if not ads_data:
        text = "📭 Hozircha faol reklamalar yo'q."
        if isinstance(message_or_call, Message): return await message_or_call.answer(text)
        else: return await message_or_call.message.edit_text(text)

    PER_PAGE = 5
    total_pages = math.ceil(len(ads_data) / PER_PAGE)
    if page >= total_pages: page = total_pages - 1
    if page < 0: page = 0

    page_ads = ads_data[page * PER_PAGE : (page + 1) * PER_PAGE]
    
    text = f"📢 <b>Faol reklamalar (Sahifa {page + 1}/{total_pages})</b>\n\n"
    for i, ad in enumerate(page_ads, start=1):
        link = ad.get('linkUrl') or 'Yoq'
        text += f"<b>{i}. {ad.get('title')}</b>\n🔗 Ssilka: {link} | ⏳ {ad.get('durationDays')} kun\n\n"

    kb = paginated_kb(page_ads, page, total_pages, "ad")

    if isinstance(message_or_call, Message):
        await message_or_call.answer(text, reply_markup=kb, disable_web_page_preview=True)
    else:
        await message_or_call.message.edit_text(text, reply_markup=kb, disable_web_page_preview=True)

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
    headers = {"X-Admin-Token": ADMIN_API_TOKEN}
    async with aiohttp.ClientSession() as session:
        async with session.delete(f"{API_URL}/ads/{ad_id}", headers=headers) as resp:
            if resp.status == 200:
                await call.answer("✅ Reklama o'chirildi!", show_alert=True)
                await render_ads_page(call, 0) # O'chgandan keyin 1-sahifani yangilaymiz
            else:
                await call.answer("❌ Xatolik yuz berdi!", show_alert=True)

@router.callback_query(F.data == "ignore")
async def ignore_callback(call: CallbackQuery):
    await call.answer() # O'rtadagi bet raqami bosilsa hech narsa qilmaydi
