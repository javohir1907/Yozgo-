from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

def delete_ad_kb(ad_id: int):
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="❌ O'chirish", callback_data=f"del_ad_{ad_id}")]
        ]
    )

def delete_comp_kb(comp_id: int):
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="❌ Musobaqani o'chirish", callback_data=f"del_comp_{comp_id}")]
        ]
    )

def user_action_kb(user_id: str, is_banned: bool = False):
    action_text = "🔓 Bandan chiqarish" if is_banned else "🚫 Ban qilish"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=action_text, callback_data=f"ban_{user_id}")]
        ]
    )

def settings_action_kb(is_maintenance: bool = False):
    action_text = "🟢 Saytni ochish" if is_maintenance else "🔴 Ta'mirlash rejimiga o'tkazish"
    mode = "off" if is_maintenance else "on"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=action_text, callback_data=f"maint_{mode}")]
        ]
    )
