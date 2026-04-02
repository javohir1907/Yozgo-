from aiogram import Router, F
from aiogram.types import Message
from api import api_request

router = Router()

@router.message(F.text == "📊 Statistikalar")
async def show_stats(message: Message):
    msg = await message.answer("🔄 API dan ma'lumot olinmoqda...")
    data = await api_request("GET", "/stats")
    
    if data:
        text = (
            "📊 <b>Platforma Statistikasi:</b>\n\n"
            f"👥 Jami ro'yxatdan o'tganlar: <b>{data.get('totalUsers', 0)}</b> ta\n"
            f"⚡️ Faol foydalanuvchilar: <b>{data.get('activeToday', 0)}</b> ta\n"
        )
        await msg.edit_text(text)
    else:
        await msg.edit_text("❌ Sayt backendiga ulanib bo'lmadi (API xatoligi yoki Node.js server o'chiq).")
