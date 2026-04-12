from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from keyboards.reply import main_menu_kb
from config import ADMIN_IDS
from filters import SuperAdminFilter

router = Router()

@router.callback_query(F.data.startswith("send_channel_"), SuperAdminFilter())
async def handle_forward_battle(callback: CallbackQuery):
    battle_code = callback.data.split("_")[2]
    invite_code = f"BTL-{battle_code}"
    
    channel_msg = (
        f"⚡️ <b>JANG XONASIGA KIRISH OCHILDI!</b>\n\n"
        f"🚀 Asl Xona Kodi: <code>{battle_code}</code>\n\n"
        f"👆 <i>Xona kodining ustiga bosib nusxalab oling va </i>@yozgo_bot<i> ga yuborib individual (bir martalik) kodingizni oling. Jangga kirish uchun o'sha koddan foydalanasiz. Omad!</i>"
    )
    
    try:
        await callback.message.bot.send_message("@yozgo_uz", channel_msg)
        await callback.answer("✅ Muvaffaqiyatli kanalga jo'natildi!", show_alert=True)
    except Exception as e:
        await callback.answer(f"❌ Xatolik yuz berdi: {str(e)[:50]}", show_alert=True)

@router.message(F.text.startswith("BTL-"))
async def handle_battle_invite_code(message: Message):
    real_code = message.text.replace("BTL-", "").strip()
    await message.answer(
        f"✅ <b>Mana sizning individual xonangizga kirish kodi:</b>\n\n"
        f"<code>{real_code}</code>\n\n"
        f"👆 <i>Ustiga bir marta bosish orqali nusxalab oling va YOZGO saytidagi «Jang» qismiga kirib, kodni tering!</i>"
    )

@router.message(Command("start"))
async def cmd_start(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        await message.answer(
            f"❌ <b>Siz YOZGO adminga ruxsat berilgan ro'yxatda yo'qsiz!</b>\n\n"
            f"Sizning Telegram ID: <code>{message.from_user.id}</code>\n\n"
            f"Ushbu ID raqamni Render panelidagi <b>ADMIN_TELEGRAM_ID</b> qismiga qo'shib, saqlang (SAVE) va boti qayta yuklanishini kuting."
        )
        return

    await state.clear()
    await message.answer(
        f"👑 Xush kelibsiz, Boshqaruvchi <b>{message.from_user.full_name}</b>!\nYOZGO Admin panelidasiz.",
        reply_markup=main_menu_kb()
    )

@router.message(F.text == "❌ Bekor qilish", SuperAdminFilter())
async def cancel_action(message: Message, state: FSMContext):
    await state.clear()
    await message.answer("Amal bekor qilindi.", reply_markup=main_menu_kb())
