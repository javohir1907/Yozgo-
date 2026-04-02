from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from states.forms import UserSearchState
from keyboards.reply import main_menu_kb, cancel_kb, users_menu_kb
from keyboards.inline import user_action_kb
from api import api_request

router = Router()

# ==========================================
# 👥 FOYDALANUVCHILAR ASOSIY MENYUSI
# ==========================================
@router.message(F.text == "👥 Foydalanuvchilar")
async def users_menu(message: Message):
    await message.answer("👥 Foydalanuvchilarni boshqarish bo'limi:", reply_markup=users_menu_kb())

# ==========================================
# 🏆 TOP LIDERLARNI KO'RISH
# ==========================================
@router.message(F.text == "🏆 Top Liderlar")
async def show_top_users(message: Message):
    msg = await message.answer("🔄 Liderlar yuklanmoqda...")
    data = await api_request("GET", "/users/top")
    
    if data:
        text = "🏆 <b>TOP Foydalanuvchilar:</b>\n\n"
        for idx, u in enumerate(data, 1):
            status = "🚫" if u.get('isBanned') else "🟢"
            username = u.get('firstName') or u.get('email') or 'Noma\'lum'
            text += f"{idx}. <b>{username}</b> [ID: {u.get('id')}] - {status}\n"
        await msg.edit_text(text)
    else:
        await msg.edit_text("❌ Liderlarni yuklab bo'lmadi yoki API xatoligi.")

# ==========================================
# 🔍 FOYDALANUVCHINI QIDIRISH VA BAN QILISH
# ==========================================
@router.message(F.text == "🔍 Foydalanuvchini izlash")
async def search_user_start(message: Message, state: FSMContext):
    await state.set_state(UserSearchState.user_id)
    await message.answer("🔍 Qidirmoqchi bo'lgan foydalanuvchining <b>ID raqamini / UUID</b> yuboring:", reply_markup=cancel_kb())

@router.message(UserSearchState.user_id)
async def search_user_result(message: Message, state: FSMContext):
    user_id = message.text
    msg = await message.answer("🔄 Izlanmoqda...", reply_markup=users_menu_kb())
    
    user_data = await api_request("GET", f"/users/{user_id}")
    
    if user_data:
        is_banned = user_data.get('isBanned', False)
        status = "🔴 BAN qilingan" if is_banned else "🟢 Faol"
        username = user_data.get('firstName') or user_data.get('email') or 'Noma\'lum'
        
        text = (
            f"👤 <b>Foydalanuvchi ma'lumotlari:</b>\n\n"
            f"🆔 ID: {user_data.get('id')}\n"
            f"📧 User: {username}\n"
            f"📊 Holati: <b>{status}</b>\n"
            f"📅 Ro'yxatdan o'tgan: {user_data.get('createdAt', '')[:10]}"
        )
        await msg.edit_text(text, reply_markup=user_action_kb(user_data['id'], is_banned))
    else:
        await msg.edit_text("❌ Bunday ID ga ega foydalanuvchi topilmadi.")
        
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
        await call.message.delete()
    else:
        await msg.edit_text("❌ Xatolik yuz berdi!")
    
    await call.answer()
