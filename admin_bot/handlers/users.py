import logging
import aiohttp
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, BufferedInputFile
from aiogram.fsm.context import FSMContext
from states.forms import UserSearchState, BroadcastState
from keyboards.reply import main_menu_kb, cancel_kb, users_menu_kb
from keyboards.inline import user_action_kb
from api import api_request
from config import API_URL, ADMIN_API_TOKEN
from filters import SuperAdminFilter

logger = logging.getLogger("users")

router = Router()
router.message.filter(SuperAdminFilter())
router.callback_query.filter(SuperAdminFilter())


# ==========================================
# 👥 FOYDALANUVCHILAR ASOSIY MENYUSI
# ==========================================
@router.message(F.text.contains("Foydalanuvchilar"))
async def users_menu(message: Message):
    await message.answer("👥 Foydalanuvchilarni boshqarish bo'limi:", reply_markup=users_menu_kb())


# ==========================================
# 🏆 TOP LIDERLARNI KO'RISH
# ==========================================
@router.message(F.text.contains("Top Liderlar"))
async def show_top_users(message: Message):
    msg = await message.answer("🔄 Liderlar yuklanmoqda...")
    data = await api_request("GET", "/users/top")

    if data:
        text = "🏆 <b>TOP Foydalanuvchilar:</b>\n\n"
        for idx, u in enumerate(data, 1):
            status = "🚫" if u.get('isBanned') else "🟢"
            username = u.get('firstName') or u.get('email') or "Noma'lum"
            text += f"{idx}. <b>{username}</b> [ID: {u.get('id')}] - {status}\n"
        await msg.edit_text(text)
    else:
        await msg.edit_text("❌ Liderlarni yuklab bo'lmadi yoki API xatoligi.")


# ==========================================
# 🔍 FOYDALANUVCHINI QIDIRISH VA BAN QILISH
# ==========================================
@router.message(F.text.contains("Foydalanuvchini izlash"))
async def search_user_start(message: Message, state: FSMContext):
    await state.set_state(UserSearchState.user_id)
    await message.answer("🔍 Qidirmoqchi bo'lgan foydalanuvchining <b>ID raqami, ismi yoki emailini</b> yuboring:", reply_markup=cancel_kb())


@router.message(UserSearchState.user_id)
async def search_user_result(message: Message, state: FSMContext):
    if not message.text:
        await state.clear()
        return await message.answer("Iltimos, matn yuboring.", reply_markup=users_menu_kb())

    query = message.text.strip()
    msg = await message.answer("🔄 Izlanmoqda...", reply_markup=users_menu_kb())

    users_data = await api_request("GET", f"/users/search/{query}")

    if users_data and isinstance(users_data, list) and len(users_data) > 0:
        user_data = users_data[0]
        is_banned = user_data.get('isBanned', False)
        status = "🔴 BAN qilingan" if is_banned else "🟢 Faol"
        username = user_data.get('firstName') or user_data.get('email') or "Noma'lum"

        text = (
            f"👤 <b>Foydalanuvchi ma'lumotlari:</b>\n\n"
            f"🆔 ID: {user_data.get('id')}\n"
            f"📧 User: {username}\n"
            f"📊 Holati: <b>{status}</b>\n"
            f"📅 Ro'yxatdan o'tgan: {str(user_data.get('createdAt', ''))[:10]}"
        )
        if len(users_data) > 1:
            text += f"\n\n<i>Qidiruv bo'yicha yana {len(users_data) - 1} ta foydalanuvchi topildi. Aniqroq izlang.</i>"

        await msg.edit_text(text, reply_markup=user_action_kb(user_data['id'], is_banned))
    else:
        await msg.edit_text("❌ Bunday ma'lumotga ega foydalanuvchi topilmadi.")

    await state.clear()


# ==========================================
# 🚫 BAN / UNBAN (Callback)
# ==========================================
@router.callback_query(F.data.startswith("ban_"))
async def toggle_ban_callback(call: CallbackQuery):
    user_id = call.data.split("_")[1]

    msg = await call.message.answer("🔄 Holat o'zgartirilmoqda...")
    resp = await api_request("POST", f"/users/{user_id}/toggle-ban")

    if resp and resp.get("success"):
        updated_user = resp.get("user", {})
        is_banned = updated_user.get("isBanned", False)
        new_status = "🔴 BAN QILINGAN" if is_banned else "🟢 FAOL (Bandan olingan)"

        await msg.edit_text(f"✅ Foydalanuvchi [ID: {user_id}] holati o'zgardi:\nYangi holat: <b>{new_status}</b>")
        try:
            await call.message.delete()
        except Exception:
            pass
    else:
        await msg.edit_text("❌ Xatolik yuz berdi!")

    await call.answer()


# ==========================================
# 📢 OMMAVIY XABAR (BROADCAST) YUBORISH
# ==========================================
@router.message(F.text.contains("Hammaga xabar") | F.text.contains("Xabar yuborish"))
async def broadcast_start(message: Message, state: FSMContext):
    await state.set_state(BroadcastState.content)
    await message.answer(
        "📢 <b>Barcha foydalanuvchilarga xabar yuborish bo'limi.</b>\n\n"
        "Matnni xuddi foydalanuvchilarga qanday borishi kerak bo'lsa shunday yuboring "
        "(Rasm va video ham qo'shishingiz mumkin):",
        reply_markup=cancel_kb()
    )


@router.message(BroadcastState.content)
async def broadcast_content(message: Message, state: FSMContext):
    html_text = message.html_text if message.text else (message.caption or "")

    photo_id = message.photo[-1].file_id if message.photo else None
    video_id = message.video.file_id if message.video else None

    await state.update_data(
        html_text=html_text,
        photo_id=photo_id,
        video_id=video_id
    )

    confirm_kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Hammaga yuborish", callback_data="confirm_broadcast")],
        [InlineKeyboardButton(text="❌ Bekor qilish", callback_data="cancel_broadcast")]
    ])

    await state.set_state(BroadcastState.confirm)

    try:
        await message.send_copy(chat_id=message.chat.id)
    except Exception:
        pass
    await message.answer("👆 Xabar ko'rinishi shunday bo'ladi. Hammaga yuboramizmi?", reply_markup=confirm_kb)


@router.callback_query(F.data == "confirm_broadcast", BroadcastState.confirm)
async def confirm_broadcast(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()

    await call.message.edit_text("🔄 Xabar Node.js orqali hammaga tarqatilmoqda... Bu biroz vaqt olishi mumkin.")

    payload = {
        "text": data.get("html_text"),
        "photoId": data.get("photo_id"),
        "videoId": data.get("video_id")
    }

    response = await api_request("POST", "/broadcast", payload=payload)

    if response:
        await call.message.edit_text("✅ <b>Ommaviy xabar barcha YOZGO foydalanuvchilariga muvaffaqiyatli tarqatildi!</b>")
        await call.message.answer("Asosiy menyu:", reply_markup=main_menu_kb())
    else:
        await call.message.edit_text(
            "❌ Xatolik! Node.js API bilan bog'lanib bo'lmadi.\n"
            "Backend'da <code>/broadcast</code> endpointi tayyor ekanligini tekshiring."
        )

    await state.clear()


@router.callback_query(F.data == "cancel_broadcast", BroadcastState.confirm)
async def cancel_broadcast(call: CallbackQuery, state: FSMContext):
    await call.message.edit_text("❌ Ommaviy xabar yuborish bekor qilindi.")
    await call.message.answer("Asosiy menyu:", reply_markup=main_menu_kb())
    await state.clear()


# ==========================================
# 📊 BAZANI YUKLAB OLISH (CSV EXPORT)
# ==========================================
@router.message(F.text.contains("Bazani yuklash") | F.text.contains("Export"))
async def export_users_db(message: Message):
    msg = await message.answer("🔄 Baza tayyorlanmoqda, kuting...")

    headers = {
        "X-Admin-Token": ADMIN_API_TOKEN,
        "X-Bot-Secret": ADMIN_API_TOKEN
    }

    try:
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            base_url = API_URL.rstrip('/')
            async with session.get(f"{base_url}/users/export", headers=headers) as resp:
                if resp.status == 200:
                    csv_data = await resp.read()

                    file = BufferedInputFile(csv_data, filename="yozgo_foydalanuvchilar.csv")

                    await message.answer_document(
                        document=file,
                        caption="📊 <b>YOZGO - Barcha foydalanuvchilar bazasi</b>\n\nBu faylni bemalol Excel yoki Google Sheets orqali ochishingiz mumkin."
                    )
                    await msg.delete()
                else:
                    await msg.edit_text("❌ Bazani yuklab olishda xatolik yuz berdi (API javob qaytarmadi).")
    except Exception as e:
        logger.error(f"CSV export xatoligi: {e}")
        await msg.edit_text(f"❌ Xatolik yuz berdi: {str(e)[:100]}")
