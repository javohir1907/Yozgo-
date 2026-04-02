from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from keyboards.inline import settings_action_kb
from api import api_request

router = Router()

@router.message(F.text.contains("Sozlamalar"))
async def settings_menu(message: Message):
    msg = await message.answer("🔄 Sozlamalar yuklanmoqda...")
    
    # Barcha sozlamalarni API dan olish
    settings_data = await api_request("GET", "/settings")
    
    if settings_data is not None:
        # Maintenance rejimini qidiramiz
        is_maintenance = False
        for s in settings_data:
            if s.get("key") == "maintenance_mode" and s.get("value") == "true":
                is_maintenance = True
        
        status = "🔴 TA'MIRLASH REJIMIDA (Yopiq)" if is_maintenance else "🟢 ISHLAMOQDA (Ochiq)"
        
        text = (
            f"⚙️ <b>Tizim Sozlamalari</b>\n\n"
            f"🌐 Sayt holati: <b>{status}</b>\n\n"
            f"<i>Bu yerdan saytni vaqtincha yopib qo'yishingiz mumkin (masalan, yangilanishlar vaqtida).</i>"
        )
        await msg.edit_text(text, reply_markup=settings_action_kb(is_maintenance))
    else:
        await msg.edit_text("❌ Sozlamalarni yuklashda xatolik yuz berdi.")

@router.callback_query(F.data.startswith("maint_"))
async def toggle_maintenance(call: CallbackQuery):
    mode = call.data.split("_")[1]
    value = "true" if mode == "on" else "false"
    
    resp = await api_request("POST", "/settings", payload={"key": "maintenance_mode", "value": value})
    
    if resp and resp.get("success"):
        await call.answer("✅ Sozlama saqlandi!", show_alert=True)
        # Ekranni yangilash uchun o'zimizni o'zimiz chaqiramiz
        # Note: calling as an ordinary async function with a modified message
        await settings_menu(call.message)
        await call.message.delete()
    else:
        await call.answer("❌ Xatolik yuz berdi!", show_alert=True)
