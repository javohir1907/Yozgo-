from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from keyboards.reply import main_menu_kb

router = Router()

@router.callback_query(F.data.startswith("forward_battle_"))
async def handle_forward_battle(callback: CallbackQuery):
    battle_code = callback.data.split("_")[2]
    invite_code = f"BTL-{battle_code}"
    
    channel_msg = (
        f"⚔️ <b>YOZGO Platformasida Yozish Tezligi bo'yicha Jang Xonasi ochildi!</b>\n\n"
        f"Bizga qo'shiling va o'z tezligingizni sinab ko'ring!\n\n"
        f"1️⃣ <i>Ushbu xona kodini ustiga bosib nusxalab oling:</i>\n"
        f"<code>{invite_code}</code>\n\n"
        f"2️⃣ <i>Kodni ushbu botga yuboring:</i> @yozgo_bot\n"
        f"3️⃣ Bot sizga Xonaga kirish huquqini beruvchi individual o'qish kodini beradi."
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
    await state.clear()
    await message.answer(
        f"👑 Xush kelibsiz, Boshqaruvchi <b>{message.from_user.full_name}</b>!\nYOZGO Admin panelidasiz.",
        reply_markup=main_menu_kb()
    )

@router.message(F.text == "❌ Bekor qilish")
async def cancel_action(message: Message, state: FSMContext):
    await state.clear()
    await message.answer("Amal bekor qilindi.", reply_markup=main_menu_kb())
