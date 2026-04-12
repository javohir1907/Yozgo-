import math
import logging
from datetime import datetime
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from states.forms import CompState
from keyboards.reply import main_menu_kb, cancel_kb, comps_menu_kb
from keyboards.inline import paginated_kb
from api import api_request
from filters import SuperAdminFilter

logger = logging.getLogger("comps")

router = Router()
router.message.filter(SuperAdminFilter())
router.callback_query.filter(SuperAdminFilter())


@router.message(F.text.contains("Musobaqalar"))
async def comps_menu(message: Message):
    await message.answer("🏆 Musobaqalar bo'limiga xush kelibsiz. Nima qilamiz?", reply_markup=comps_menu_kb())


# --- MUSOBAQA YARATISH (FSM) ---
@router.message(F.text.contains("Musobaqa yaratish"))
async def comp_start(message: Message, state: FSMContext):
    await state.set_state(CompState.title)
    await message.answer("1️⃣ Musobaqa sarlavhasini kiriting:", reply_markup=cancel_kb())


@router.message(CompState.title)
async def comp_title(message: Message, state: FSMContext):
    if not message.text:
        return await message.answer("Iltimos, matn yuboring.")
    await state.update_data(title=message.text)
    await state.set_state(CompState.desc)
    await message.answer("2️⃣ Musobaqa haqida batafsil ma'lumot (shartlari, qoidalari) kiriting:")


@router.message(CompState.desc)
async def comp_desc(message: Message, state: FSMContext):
    if not message.text:
        return await message.answer("Iltimos, matn yuboring.")
    await state.update_data(description=message.text)
    await state.set_state(CompState.reward)
    await message.answer("3️⃣ Yutuq (Mukofot) nima?")


@router.message(CompState.reward)
async def comp_reward(message: Message, state: FSMContext):
    if not message.text:
        return await message.answer("Iltimos, matn yuboring.")
    await state.update_data(reward=message.text)
    await state.set_state(CompState.start_time)
    await message.answer("4️⃣ Boshlanish vaqtini kiriting.\n❗️ <b>QAT'IY FORMAT:</b> YYYY-MM-DD HH:MM\nMasalan: <b>2024-12-01 14:00</b>")


@router.message(CompState.start_time)
async def comp_start_time(message: Message, state: FSMContext):
    if not message.text:
        return await message.answer("Iltimos, matn yuboring.")
    try:
        dt = datetime.strptime(message.text, "%Y-%m-%d %H:%M")
        await state.update_data(startTime=dt.isoformat())
        await state.set_state(CompState.end_time)
        await message.answer("5️⃣ Tugash vaqtini kiriting.\n❗️ <b>QAT'IY FORMAT:</b> YYYY-MM-DD HH:MM\nMasalan: <b>2024-12-10 18:00</b>")
    except ValueError:
        await message.answer("❌ Noto'g'ri format! YYYY-MM-DD HH:MM shaklida yozing.")


@router.message(CompState.end_time)
async def comp_end_time(message: Message, state: FSMContext):
    if not message.text:
        return await message.answer("Iltimos, matn yuboring.")
    try:
        dt = datetime.strptime(message.text, "%Y-%m-%d %H:%M")
        await state.update_data(endTime=dt.isoformat())
        data = await state.get_data()
        msg = await message.answer("🔄 Musobaqa saytga yuklanmoqda...", reply_markup=main_menu_kb())
        response = await api_request("POST", "/competitions", payload=data)
        if response:
            await msg.edit_text("✅ <b>Musobaqa e'lon qilindi!</b>")
        else:
            await msg.edit_text("❌ Musobaqa yaratishda xatolik.")
        await state.clear()
    except ValueError:
        await message.answer("❌ Noto'g'ri format!")


# ==========================================
# 📋 SAHIFALASH (PAGINATION)
# ==========================================
async def render_comps_page(message_or_call, page: int):
    try:
        comps_data = await api_request("GET", "/competitions")
        if not comps_data:
            text = "📭 Hozircha faol musobaqalar yo'q."
            if isinstance(message_or_call, Message):
                return await message_or_call.answer(text)
            else:
                return await message_or_call.message.edit_text(text)

        PER_PAGE = 5
        total_pages = max(1, math.ceil(len(comps_data) / PER_PAGE))
        page = max(0, min(page, total_pages - 1))

        page_comps = comps_data[page * PER_PAGE: (page + 1) * PER_PAGE]

        text = f"🏆 <b>Faol Musobaqalar (Sahifa {page + 1}/{total_pages})</b>\n\n"
        for i, comp in enumerate(page_comps, start=1):
            text += f"<b>{i}. {comp.get('title')}</b>\n🎁 Mukofot: {comp.get('reward')}\n"
            start_time = comp.get('startTime', '')
            if start_time and len(start_time) >= 16:
                text += f"🟢 Boshlanish: {start_time[:16].replace('T', ' ')}\n\n"
            else:
                text += f"🟢 Boshlanish: Noma'lum\n\n"

        kb = paginated_kb(page_comps, page, total_pages, "comp")

        if isinstance(message_or_call, Message):
            await message_or_call.answer(text, reply_markup=kb)
        else:
            await message_or_call.message.edit_text(text, reply_markup=kb)
    except Exception as e:
        logger.error(f"Musobaqalar sahifasini ko'rsatishda xatolik: {e}")


@router.message(F.text.contains("Faol musobaqalar"))
async def show_active_comps(message: Message):
    await render_comps_page(message, 0)


@router.callback_query(F.data.startswith("page_comp_"))
async def change_comps_page(call: CallbackQuery):
    page = int(call.data.split("_")[2])
    await render_comps_page(call, page)
    await call.answer()


@router.callback_query(F.data.startswith("del_comp_"))
async def delete_comp_callback(call: CallbackQuery):
    comp_id = call.data.split("_")[2]

    response = await api_request("DELETE", f"/competitions/{comp_id}")
    if response:
        await call.answer("✅ Musobaqa o'chirildi!", show_alert=True)
        await render_comps_page(call, 0)
    else:
        await call.answer("❌ Xatolik yuz berdi!", show_alert=True)
