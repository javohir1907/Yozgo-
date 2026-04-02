from datetime import datetime
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from states.forms import CompState
from keyboards.reply import main_menu_kb, cancel_kb, comps_menu_kb
from keyboards.inline import delete_comp_kb
from api import api_request

router = Router()

# ==========================================
# 🏆 MUSOBAQALAR ASOSIY MENYUSI
# ==========================================
@router.message(F.text == "🏆 Musobaqalar")
async def comps_menu(message: Message):
    await message.answer("🏆 Musobaqalar bo'limiga xush kelibsiz. Nima qilamiz?", reply_markup=comps_menu_kb())

# ==========================================
# ➕ MUSOBAQA YARATISH (FSM QADAMLARI)
# ==========================================
@router.message(F.text == "➕ Musobaqa yaratish")
async def comp_start(message: Message, state: FSMContext):
    await state.set_state(CompState.title)
    await message.answer("1️⃣ Musobaqa sarlavhasini kiriting:", reply_markup=cancel_kb())

@router.message(CompState.title)
async def comp_title(message: Message, state: FSMContext):
    await state.update_data(title=message.text)
    await state.set_state(CompState.desc)
    await message.answer("2️⃣ Musobaqa haqida batafsil ma'lumot (shartlari, qoidalari) kiriting:")

@router.message(CompState.desc)
async def comp_desc(message: Message, state: FSMContext):
    await state.update_data(description=message.text)
    await state.set_state(CompState.reward)
    await message.answer("3️⃣ Yutuq (Mukofot) nima? (Masalan: <i>1 oylik Premium</i> yoki <i>100,000 so'm</i>)")

@router.message(CompState.reward)
async def comp_reward(message: Message, state: FSMContext):
    await state.update_data(reward=message.text)
    await state.set_state(CompState.start_time)
    await message.answer(
        "4️⃣ Boshlanish vaqtini kiriting.\n"
        "❗️ <b>QAT'IY FORMAT:</b> YYYY-MM-DD HH:MM\n"
        "Masalan: <b>2024-12-01 14:00</b>"
    )

@router.message(CompState.start_time)
async def comp_start_time(message: Message, state: FSMContext):
    try:
        # Vaqt to'g'ri kiritilganini tekshiramiz
        dt = datetime.strptime(message.text, "%Y-%m-%d %H:%M")
        await state.update_data(startTime=dt.isoformat())
        await state.set_state(CompState.end_time)
        await message.answer(
            "5️⃣ Tugash vaqtini kiriting.\n"
            "❗️ <b>QAT'IY FORMAT:</b> YYYY-MM-DD HH:MM\n"
            "Masalan: <b>2024-12-10 18:00</b>"
        )
    except ValueError:
        # Noto'g'ri format yozilsa, qadam o'zgarmaydi va qayta so'raladi
        await message.answer("❌ Noto'g'ri format! Iltimos, aynan <b>YYYY-MM-DD HH:MM</b> formatida yozing.")

@router.message(CompState.end_time)
async def comp_end_time(message: Message, state: FSMContext):
    try:
        dt = datetime.strptime(message.text, "%Y-%m-%d %H:%M")
        await state.update_data(endTime=dt.isoformat())
        
        data = await state.get_data()
        msg = await message.answer("🔄 Musobaqa saytga yuklanmoqda...", reply_markup=main_menu_kb())
        
        # API orqali Node.js ga yuborish
        response = await api_request("POST", "/competitions", payload=data)
        
        if response:
            await msg.edit_text("✅ <b>Musobaqa muvaffaqiyatli yaratildi va e'lon qilindi!</b>")
        else:
            await msg.edit_text("❌ Musobaqa yaratishda xatolik yuz berdi (API ishlamadi yoki xato ketdi).")
        
        await state.clear()
    except ValueError:
        await message.answer("❌ Noto'g'ri format! Iltimos, aynan <b>YYYY-MM-DD HH:MM</b> formatida yozing.")

# ==========================================
# 📋 FAOL MUSOBAQALAR
# ==========================================
@router.message(F.text == "📋 Faol musobaqalar")
async def show_active_comps(message: Message):
    msg = await message.answer("🔄 Musobaqalar yuklanmoqda...")
    comps_data = await api_request("GET", "/competitions")
    
    if comps_data is None:
        return await msg.edit_text("❌ API bilan bog'lanishda xatolik!")
        
    if not comps_data:
        return await msg.edit_text("📭 Hozircha faol musobaqalar yo'q.")
        
    await msg.delete()
    
    for comp in comps_data:
        text = (
            f"🏆 <b>{comp.get('title')}</b>\n\n"
            f"📝 <b>Shartlar:</b> {comp.get('description')}\n"
            f"🎁 <b>Mukofot:</b> {comp.get('reward')}\n"
            f"🟢 <b>Boshlanish:</b> {comp.get('startTime')[:16].replace('T', ' ')}\n"
            f"🔴 <b>Tugash:</b> {comp.get('endTime')[:16].replace('T', ' ')}"
        )
        await message.answer(text, reply_markup=delete_comp_kb(comp['id']))

# ==========================================
# ❌ MUSOBAQANI O'CHIRISH (Callback)
# ==========================================
@router.callback_query(F.data.startswith("del_comp_"))
async def delete_comp_callback(call: CallbackQuery):
    comp_id = call.data.split("_")[2]
    
    import aiohttp
    from config import API_URL, ADMIN_API_TOKEN
    
    headers = {"X-Admin-Token": ADMIN_API_TOKEN}
    async with aiohttp.ClientSession() as session:
        async with session.delete(f"{API_URL}/competitions/{comp_id}", headers=headers) as resp:
            if resp.status == 200:
                await call.answer("✅ Musobaqa muvaffaqiyatli o'chirildi!", show_alert=True)
                await call.message.delete()
            else:
                await call.answer("❌ Xatolik yuz berdi!", show_alert=True)
