import secrets
import string
from aiogram import Router, F
from aiogram.types import Message
from aiogram.fsm.context import FSMContext

from api import api_request
from keyboards.reply import paid_rooms_menu_kb, main_menu_kb, cancel_kb
from states.forms import PaidRoomState

router = Router()

def generate_random_code(length=8):
    chars = string.ascii_uppercase + string.digits
    return "YOZGO-" + "".join(secrets.choice(chars) for _ in range(length))

@router.message(F.text == "🎟️ Pullik xonalar")
async def paid_rooms_menu(message: Message):
    await message.answer("🎟️ Pullik xonalar bo'limi", reply_markup=paid_rooms_menu_kb())

@router.message(F.text == "🆕 Kod yaratish")
async def start_code_creation(message: Message, state: FSMContext):
    await state.set_state(PaidRoomState.max_participants)
    await message.answer("Ishtirokchilar sonini kiriting (Masalan: 20, 50, 100):", reply_markup=cancel_kb())

@router.message(PaidRoomState.max_participants, F.text != "❌ Bekor qilish")
async def create_code(message: Message, state: FSMContext):
    if not message.text.isdigit():
        return await message.answer("Faqat raqam kiriting!")
    
    max_p = int(message.text)
    code = generate_random_code()
    
    payload = {
        "code": code,
        "maxParticipants": max_p,
        "createdBy": str(message.from_user.id)
    }
    
    result = await api_request("POST", "/api/admin/creation-codes", payload)
    
    if result:
        await state.clear()
        msg = (
            f"✅ <b>Yangi kod yaratildi!</b>\n\n"
            f"🎟️ Kod: <code>{code}</code>\n"
            f"👥 Ishtirokchilar: {max_p} ta\n"
            f"⏳ Amal qilish muddati: 5 kun\n\n"
            f"<i>Ushbu kodni foydalanuvchiga bering. U 'Qo'shilish' bo'limida ishlatishi mumkin.</i>"
        )
        await message.answer(msg, reply_markup=paid_rooms_menu_kb())
    else:
        await message.answer("❌ Kod yaratishda xatolik yuz berdi.", reply_markup=paid_rooms_menu_kb())

@router.message(F.text == "ℹ️ Kod xolati")
async def start_code_status(message: Message, state: FSMContext):
    await state.set_state(PaidRoomState.code_status)
    await message.answer("Tekshirmoqchi bo'lgan kodni kiriting:", reply_markup=cancel_kb())

@router.message(PaidRoomState.code_status, F.text != "❌ Bekor qilish")
async def check_code_status(message: Message, state: FSMContext):
    code = message.text.strip().toUpperCase() if hasattr(message.text.strip(), 'toUpperCase') else message.text.strip().upper()
    
    result = await api_request("GET", f"/api/admin/creation-codes/status/{code}")
    
    if result:
        await state.clear()
        status_emoji = "✅" if not result.get('isUsed') else "⚠️"
        if result.get('isExpired'): status_emoji = "❌"
        
        msg = (
            f"📊 <b>Kod ma'lumotlari:</b>\n"
            f"🎟️ Kod: <code>{code}</code>\n"
            f"🔢 Holati: {status_emoji} {'Ishlatilmagan' if not result.get('isUsed') else 'Ishlatilgan'}\n"
            f"🏁 Xona holati: <code>{result.get('roomStatus', 'Noma\'lum')}</code>\n"
            f"👥 Limit: {result.get('maxParticipants')} ta\n"
            f"📅 Muddati: {result.get('expiresAt')}\n"
            f"🚫 Expired: {'Ha' if result.get('isExpired') else 'Yo\'q'}"
        )
        await message.answer(msg, reply_markup=paid_rooms_menu_kb())
    else:
        await message.answer("❌ Kod topilmadi yoki ma'lumot olishda xatolik.", reply_markup=paid_rooms_menu_kb())

@router.message(F.text == "🚫 Kodni o'chirish")
async def start_code_deactivate(message: Message, state: FSMContext):
    await state.set_state(PaidRoomState.deactivate_code)
    await message.answer("O'chirmoqchi bo'lgan kodni kiriting:", reply_markup=cancel_kb())

@router.message(PaidRoomState.deactivate_code, F.text != "❌ Bekor qilish")
async def deactivate_code(message: Message, state: FSMContext):
    code = message.text.strip().upper()
    
    result = await api_request("POST", "/api/admin/creation-codes/deactivate", {"code": code})
    
    if result and result.get('success'):
        await state.clear()
        await message.answer(f"✅ Kod <code>{code}</code> muvaffaqiyatli o'chirildi (muddati tugatildi).", reply_markup=paid_rooms_menu_kb())
    else:
        await message.answer("❌ Kodni o'chirishda xatolik yuz berdi.", reply_markup=paid_rooms_menu_kb())
