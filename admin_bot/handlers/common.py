from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message
from aiogram.fsm.context import FSMContext
from keyboards.reply import main_menu_kb

router = Router()

@router.message(Command("start"))
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    await message.answer(
        f"👑 Xush kelibsiz, Boshqaruvchi <b>{message.from_user.full_name}</b>!\nYOZGO Admin panelidasiz.",
        reply_markup=main_menu_kb()
    )

@router.message(F.text == "❌ Bekor qilish")
async def cancel_action(message: Message, state: FSMContext):
    await state.clear()
    await message.answer("Amal bekor qilindi.", reply_markup=main_menu_kb())
