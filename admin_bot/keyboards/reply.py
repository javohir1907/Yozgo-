from aiogram.types import ReplyKeyboardMarkup, KeyboardButton

def main_menu_kb():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📊 Statistikalar"), KeyboardButton(text="👥 Foydalanuvchilar")],
            [KeyboardButton(text="📢 Reklamalar"), KeyboardButton(text="🏆 Musobaqalar")],
            [KeyboardButton(text="🎟️ Pullik xonalar"), KeyboardButton(text="⚙️ Sozlamalar")]
        ],
        resize_keyboard=True
    )

def cancel_kb():
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="❌ Bekor qilish")]],
        resize_keyboard=True
    )

def ads_menu_kb():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="➕ Reklama qo'shish"), KeyboardButton(text="📋 Faol reklamalar")],
            [KeyboardButton(text="🔙 Asosiy menyu")]
        ],
        resize_keyboard=True
    )

def comps_menu_kb():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="➕ Musobaqa yaratish"), KeyboardButton(text="📋 Faol musobaqalar")],
            [KeyboardButton(text="🔙 Asosiy menyu")]
        ],
        resize_keyboard=True
    )

def users_menu_kb():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="🏆 Top Liderlar"), KeyboardButton(text="🔍 Foydalanuvchini izlash")],
            [KeyboardButton(text="📊 Bazani yuklash")],
            [KeyboardButton(text="🔙 Asosiy menyu")]
        ],
        resize_keyboard=True
    )
def paid_rooms_menu_kb():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="🆕 Kod yaratish"), KeyboardButton(text="ℹ️ Kod xolati")],
            [KeyboardButton(text="🚫 Kodni o'chirish")],
            [KeyboardButton(text="🔙 Asosiy menyu")]
        ],
        resize_keyboard=True
    )
