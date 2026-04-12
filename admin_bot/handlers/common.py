from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from keyboards.reply import main_menu_kb
from config import ADMIN_IDS

router = Router()


@router.callback_query(F.data.startswith("send_channel_"))
async def handle_forward_battle(callback: CallbackQuery):
    if not callback.from_user or callback.from_user.id not in ADMIN_IDS:
        await callback.answer("Siz admin emassiz!", show_alert=True)
        return

    battle_code = callback.data.split("_")[2]

    channel_msg = (
        f"⚡️ <b>JANG XONASIGA KIRISH OCHILDI!</b>\n\n"
        f"🚀 Asl Xona Kodi: <code>{battle_code}</code>\n\n"
        f"👆 <i>Xona kodining ustiga bosib nusxalab oling va </i>@yozgo_bot<i> ga yuborib individual (bir martalik) kodingizni oling.</i>"
    )

    try:
        await callback.message.bot.send_message("@yozgo_uz", channel_msg)
        await callback.answer("✅ Muvaffaqiyatli kanalga jo'natildi!", show_alert=True)
    except Exception as e:
        await callback.answer(f"❌ Xatolik: {str(e)[:50]}", show_alert=True)


@router.message(Command("start"))
async def cmd_start(message: Message, state: FSMContext):
    if not message.from_user:
        return

    if message.from_user.id not in ADMIN_IDS:
        await message.answer(
            f"❌ <b>Siz admin emassiz!</b>\n\n"
            f"Sizning Telegram ID: <code>{message.from_user.id}</code>\n\n"
            f"Render panelidagi <b>ADMIN_TELEGRAM_ID</b> ga qo'shing."
        )
        return

    await state.clear()
    await message.answer(
        f"👑 Xush kelibsiz, <b>{message.from_user.full_name}</b>!\nYOZGO Admin panelidasiz.",
        reply_markup=main_menu_kb()
    )


@router.message(F.text == "❌ Bekor qilish")
async def cancel_action(message: Message, state: FSMContext):
    await state.clear()
    await message.answer("Amal bekor qilindi.", reply_markup=main_menu_kb())
