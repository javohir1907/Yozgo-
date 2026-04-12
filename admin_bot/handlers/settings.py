import time
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from keyboards.inline import settings_action_kb
from api import api_request
from filters import SuperAdminFilter

router = Router()
router.message.filter(SuperAdminFilter())
router.callback_query.filter(SuperAdminFilter())


@router.message(F.text.contains("Sozlamalar"))
async def settings_menu(message: Message):
    start = time.monotonic()
    msg = await message.answer("🔄 Sozlamalar yuklanmoqda...")

    settings_data = await api_request("GET", "/settings")
    elapsed = round(time.monotonic() - start, 1)

    if settings_data is not None:
        is_maintenance = False
        if isinstance(settings_data, list):
            for s in settings_data:
                if s.get("key") == "maintenance_mode" and s.get("value") == "true":
                    is_maintenance = True

        status = "🔴 TA'MIRLASH REJIMIDA (Yopiq)" if is_maintenance else "🟢 ISHLAMOQDA (Ochiq)"

        text = (
            f"⚙️ <b>Tizim Sozlamalari</b>\n\n"
            f"🌐 Sayt holati: <b>{status}</b>\n\n"
            f"<i>Saytni vaqtincha yopib qo'yishingiz mumkin.</i>\n"
            f"⏱ {elapsed}s"
        )
        await msg.edit_text(text, reply_markup=settings_action_kb(is_maintenance))
    else:
        await msg.edit_text(
            f"❌ <b>Sozlamalarni yuklashda xatolik!</b> (⏱ {elapsed}s)\n\n"
            f"<i>Ehtimoliy sabablar:\n"
            f"• API_URL noto'g'ri (hozirgi endpoint: /settings)\n"
            f"• BOT_SECRET yoki ADMIN_API_TOKEN mos kelmaydi\n"
            f"• Render serveri uxlab yotgan bo'lishi mumkin</i>"
        )


@router.callback_query(F.data.startswith("maint_"))
async def toggle_maintenance(call: CallbackQuery):
    mode = call.data.split("_")[1]
    value = "true" if mode == "on" else "false"

    resp = await api_request("POST", "/settings", payload={"key": "maintenance_mode", "value": value})

    if resp and resp.get("success"):
        new_status = "🔴 TA'MIRLASH REJIMIDA" if mode == "on" else "🟢 ISHLAMOQDA"
        is_maint = mode == "on"

        text = (
            f"⚙️ <b>Tizim Sozlamalari</b>\n\n"
            f"🌐 Sayt holati: <b>{new_status}</b>\n\n"
            f"<i>✅ Sozlama muvaffaqiyatli saqlandi!</i>"
        )
        try:
            await call.message.edit_text(text, reply_markup=settings_action_kb(is_maint))
        except Exception:
            pass
        await call.answer("✅ Sozlama saqlandi!", show_alert=True)
    else:
        await call.answer("❌ Xatolik yuz berdi!", show_alert=True)
