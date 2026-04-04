from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder

def paginated_kb(items: list, current_page: int, total_pages: int, item_type: str):
    """
    item_type: 'ad' (reklama) yoki 'comp' (musobaqa)
    """
    builder = InlineKeyboardBuilder()
    
    # 1-qator: O'chirish tugmalari: [❌ 1] [❌ 2] [❌ 3]
    delete_btns = []
    for i, item in enumerate(items, start=1):
        delete_btns.append(InlineKeyboardButton(text=f"❌ {i}", callback_data=f"del_{item_type}_{item['id']}"))
    if delete_btns:
        builder.row(*delete_btns)

    # 2-qator: Sahifalash tugmalari: [⬅️] [1/5] [➡️]
    nav_btns = []
    if current_page > 0:
        nav_btns.append(InlineKeyboardButton(text="⬅️ Oldingi", callback_data=f"page_{item_type}_{current_page - 1}"))
    
    nav_btns.append(InlineKeyboardButton(text=f"📄 {current_page + 1}/{total_pages}", callback_data="ignore"))
    
    if current_page < total_pages - 1:
        nav_btns.append(InlineKeyboardButton(text="Keyingi ➡️", callback_data=f"page_{item_type}_{current_page + 1}"))
        
    builder.row(*nav_btns)
    return builder.as_markup()

def user_action_kb(user_id: str, is_banned: bool = False):
    action_text = "🔓 Bandan chiqarish" if is_banned else "🚫 Ban qilish"
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text=action_text, callback_data=f"ban_{user_id}")]]
    )

def settings_action_kb(is_maintenance: bool = False):
    action_text = "🟢 Saytni ochish" if is_maintenance else "🔴 Ta'mirlash rejimiga o'tkazish"
    mode = "off" if is_maintenance else "on"
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text=action_text, callback_data=f"maint_{mode}")]]
    )
