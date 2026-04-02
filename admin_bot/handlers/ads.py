from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from states.forms import AdState
from keyboards.reply import main_menu_kb, cancel_kb, ads_menu_kb
from keyboards.inline import delete_ad_kb
from api import api_request

router = Router()

# ==========================================
# 📢 REKLAMA ASOSIY MENYUSI
# ==========================================
@router.message(F.text == "📢 Reklamalar")
async def ads_menu(message: Message):
    await message.answer("📢 Reklama bo'limiga xush kelibsiz. Nima qilamiz?", reply_markup=ads_menu_kb())

@router.message(F.text == "🔙 Asosiy menyu")
async def back_to_main(message: Message, state: FSMContext):
    await state.clear()
    await message.answer("Asosiy menyu:", reply_markup=main_menu_kb())

# ==========================================
# ➕ REKLAMA QO'SHISH (FSM QADAMLARI)
# ==========================================
@router.message(F.text == "➕ Reklama qo'shish")
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
    
    # API orqali Node.js ga yuborish
    response = await api_request("POST", "/ads", payload=data)
    
    if response:
        await msg.edit_text("✅ <b>Reklama muvaffaqiyatli qo'shildi va saytda aktivlashdi!</b>")
    else:
        await msg.edit_text("❌ Reklama qo'shishda xatolik yuz berdi (API ishlamadi yoki xato ketdi).")
    
    await state.clear()

# ==========================================
# 📋 FAOL REKLAMALARNI KO'RISH
# ==========================================
@router.message(F.text == "📋 Faol reklamalar")
async def show_active_ads(message: Message):
    msg = await message.answer("🔄 Reklamalar yuklanmoqda...")
    ads_data = await api_request("GET", "/ads/all")
    
    if ads_data is None:
        return await msg.edit_text("❌ API bilan bog'lanishda xatolik!")
        
    if not ads_data:
        return await msg.edit_text("📭 Hozircha faol reklamalar yo'q.")
        
    await msg.delete()
    
    # Har bir reklamani alohida xabar qilib, tagida o'chirish tugmasi bilan yuboramiz
    for ad in ads_data:
        text = (
            f"📢 <b>{ad.get('title')}</b>\n"
            f"🔗 Ssilka: {ad.get('linkUrl') or 'Yoq'}\n"
            f"⏳ Davomiyligi: {ad.get('durationDays')} kun"
        )
        # Agar rasm bo'lsa rasm bilan, bo'lmasa oddiy matn
        if ad.get('imageUrl'):
            await message.answer_photo(
                photo=ad['imageUrl'], 
                caption=text, 
                reply_markup=delete_ad_kb(ad['id'])
            )
        else:
            await message.answer(text, reply_markup=delete_ad_kb(ad['id']))

# ==========================================
# ❌ REKLAMANI O'CHIRISH (Callback)
# ==========================================
@router.callback_query(F.data.startswith("del_ad_"))
async def delete_ad_callback(call: CallbackQuery):
    ad_id = call.data.split("_")[2] # del_ad_12 kabi kelsa, 12 ni ajratib oladi
    
    # Node.js backendga DELETE so'rov yuborish
    import aiohttp
    from config import API_URL, ADMIN_API_TOKEN
    
    headers = {"X-Admin-Token": ADMIN_API_TOKEN}
    async with aiohttp.ClientSession() as session:
        async with session.delete(f"{API_URL}/ads/{ad_id}", headers=headers) as resp:
            if resp.status == 200:
                await call.answer("✅ Reklama o'chirildi!", show_alert=True)
                await call.message.delete()
            else:
                await call.answer("❌ Xatolik yuz berdi!", show_alert=True)
