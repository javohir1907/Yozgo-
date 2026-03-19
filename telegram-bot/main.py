import os
import requests
import json
from datetime import datetime
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Updater,
    CommandHandler,
    MessageHandler,
    Filters,
    CallbackContext,
    ConversationHandler,
    CallbackQueryHandler
)

load_dotenv()

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN") or os.getenv("TELEGRAM_BOT_TOKEN")
ADMIN_ID = os.environ.get("ADMIN_TELEGRAM_ID") or os.getenv("ADMIN_TELEGRAM_ID")
API_BASE_URL = os.environ.get("API_BASE_URL") or os.getenv("API_BASE_URL", "https://yozgo.uz/api")
BOT_SECRET = os.environ.get("BOT_SECRET") or os.getenv("BOT_SECRET", "yozgo-bot-secret")

if TOKEN:
    TOKEN = TOKEN.strip().strip("'").strip('"')

if ADMIN_ID:
    try:
        ADMIN_ID = int(str(ADMIN_ID).strip())
    except ValueError:
        pass

# State definitions for Reklama Conversation
R_TITLE, R_IMAGE, R_LINK, R_DESC, R_CONFIRM = range(5)
# State definitions for Musobaqa Conversation
M_TITLE, M_DATE, M_PRIZE, M_CONFIRM = range(5, 9)

HEADERS = {
    "x-bot-secret": BOT_SECRET,
    "Content-Type": "application/json"
}

def admin_only(func):
    """Decorator to check if user is admin"""
    def wrapper(update: Update, context: CallbackContext, *args, **kwargs):
        user_id = update.effective_user.id
        if user_id != ADMIN_ID:
            update.message.reply_text("⛔️ Ruxsat yo'q!")
            return
        return func(update, context, *args, **kwargs)
    return wrapper

@admin_only
def start(update: Update, context: CallbackContext):
    text = (
        "👑 <b>Xush kelibsiz, Admin!</b>\n\n"
        "Buyruqlar:\n"
        "/stats - Barcha statistikalar\n\n"
        "📢 <b>Reklama:</b>\n"
        "/reklama - Yangi reklama qo'shish\n"
        "/reklama_list - Reklamalar ro'yxati\n\n"
        "🏆 <b>Musobaqa:</b>\n"
        "/musobaqa_yarat - Yangi musobaqa\n"
        "/musobaqa_list - Musobaqalar ro'yxati\n"
    )
    update.message.reply_text(text, parse_mode="HTML")

@admin_only
def stats(update: Update, context: CallbackContext):
    try:
        resp = requests.get(f"{API_BASE_URL}/admin/bot-stats", headers=HEADERS)
        if resp.status_code == 200:
            data = resp.json()
            msg = (
                "📊 <b>Statistika:</b>\n\n"
                f"👤 Jami foydalanuvchilar: <b>{data.get('totalUsers')}</b>\n"
                f"🆕 Bugungi ro'yxatdan o'tganlar: <b>{data.get('todayUsers')}</b>\n"
                f"⚔️ Aktiv jang xonalari: <b>{data.get('activeBattles')}</b>\n"
                f"⌨️ Bugun yechilgan testlar: <b>{data.get('todayTests')}</b>\n"
                f"⚡️ O'rtacha reyting/WPM: <b>{data.get('avgWpm')}</b>"
            )
            update.message.reply_text(msg, parse_mode="HTML")
        else:
            update.message.reply_text(f"Xatolik yuz berdi! Status code: {resp.status_code}")
    except Exception as e:
        update.message.reply_text(f"API ga bog'lanishda xato: {str(e)}")

# --- REKLAMA CONVERSATION ---
@admin_only
def reklama_start(update: Update, context: CallbackContext):
    update.message.reply_text("📢 Yangi reklama qo'shamiz.\n\n1. Homiy nomi yoki sarlavhani kiriting:")
    return R_TITLE

def r_title(update: Update, context: CallbackContext):
    context.user_data['r_title'] = update.message.text
    update.message.reply_text("2. Reklama rasmi (URL yoki rasm linkini tashlang):")
    return R_IMAGE

def r_image(update: Update, context: CallbackContext):
    context.user_data['r_image'] = update.message.text
    update.message.reply_text("3. Havola (Bosganda qayerga o'tsin?):")
    return R_LINK

def r_link(update: Update, context: CallbackContext):
    context.user_data['r_link'] = update.message.text
    update.message.reply_text("4. Qisqa tavsif (1 qator matn, ixtiyoriy. /skip yozsangiz bo'ladi):")
    return R_DESC

def r_desc(update: Update, context: CallbackContext):
    text = update.message.text
    if text == "/skip":
        text = ""
    context.user_data['r_desc'] = text
    
    keyboard = [
        [InlineKeyboardButton("✅ Ha, joylaymiz", callback_data="r_confirm_yes")],
        [InlineKeyboardButton("❌ Bekor qilish", callback_data="r_confirm_no")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    preview = (
        f"<b>Sarlavha:</b> {context.user_data['r_title']}\n"
        f"<b>Rasm:</b> {context.user_data['r_image']}\n"
        f"<b>Link:</b> {context.user_data['r_link']}\n"
        f"<b>Tavsif:</b> {text}\n\n"
        "Shu reklamani saytga joylaymizmi?"
    )
    update.message.reply_text(preview, parse_mode="HTML", reply_markup=reply_markup)
    return R_CONFIRM

def r_confirm(update: Update, context: CallbackContext):
    query = update.callback_query
    query.answer()
    
    if query.data == "r_confirm_yes":
        ad_data = {
            "title": context.user_data['r_title'],
            "imageUrl": context.user_data['r_image'],
            "linkUrl": context.user_data['r_link'],
            "description": context.user_data['r_desc'],
            "startDate": datetime.now().isoformat()[:-3]+'Z', # fake naive equivalent of toISOString JS 
            "endDate": "2030-12-31T23:59:59.000Z"
        }
        try:
            resp = requests.post(f"{API_BASE_URL}/admin/advertisements", json=ad_data, headers=HEADERS)
            if resp.status_code == 201:
                query.edit_message_text("✅ Muvaffaqiyatli saqlandi va saytga qo'shildi!")
            else:
                query.edit_message_text(f"❌ Xatolik yuz berdi: {resp.text}")
        except Exception as e:
            query.edit_message_text(f"API xatosi: {e}")
    else:
        query.edit_message_text("❌ Bekor qilindi.")
    
    context.user_data.clear()
    return ConversationHandler.END

# --- MUSOBAQA CONVERSATION ---
@admin_only
def musobaqa_start(update: Update, context: CallbackContext):
    update.message.reply_text("🏆 Musobaqa e'lonini yaratamiz.\n\n1. Musobaqa nomini kiriting:")
    return M_TITLE

def m_title(update: Update, context: CallbackContext):
    context.user_data['m_title'] = update.message.text
    update.message.reply_text("2. Qachon bo'ladi? (Masalan: 2026-04-01T20:00 yoki faqat 2026-04-01):")
    return M_DATE

def m_date(update: Update, context: CallbackContext):
    try:
        date_str = update.message.text
        if len(date_str) == 10:
            date_str += "T00:00:00.000Z"
        if "T" in date_str and not date_str.endswith("Z"):
            date_str += ":00.000Z" if len(date_str.split(":")) == 2 else ".000Z"
        context.user_data['m_date'] = date_str
        update.message.reply_text("3. Sovrin (Masalan: 1,000,000 so'm):")
        return M_PRIZE
    except:
        update.message.reply_text("Sana formati xato! /cancel qilib boshidan ko'ring.")
        return ConversationHandler.END

def m_prize(update: Update, context: CallbackContext):
    context.user_data['m_prize'] = update.message.text
    
    keyboard = [
        [InlineKeyboardButton("✅ Yaratish", callback_data="m_confirm_yes")],
        [InlineKeyboardButton("❌ Bekor qilish", callback_data="m_confirm_no")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    preview = (
        f"<b>Musobaqa:</b> {context.user_data['m_title']}\n"
        f"<b>Sana/Vaqt:</b> {context.user_data['m_date']}\n"
        f"<b>Sovrin:</b> {context.user_data.get('m_prize', '')}\n\n"
        "Shular to'g'rimi?"
    )
    update.message.reply_text(preview, parse_mode="HTML", reply_markup=reply_markup)
    return M_CONFIRM

def m_confirm(update: Update, context: CallbackContext):
    query = update.callback_query
    query.answer()
    
    if query.data == "m_confirm_yes":
        comp_data = {
            "title": context.user_data['m_title'],
            "date": context.user_data['m_date'],
            "prize": context.user_data['m_prize']
        }
        try:
            resp = requests.post(f"{API_BASE_URL}/competitions", json=comp_data, headers=HEADERS)
            if resp.status_code == 201:
                query.edit_message_text("✅ Musobaqa saytda e'lon qilindi!")
            else:
                query.edit_message_text(f"❌ Xatolik yuz berdi: {resp.text}")
        except Exception as e:
            query.edit_message_text(f"API xatosi: {e}")
    else:
        query.edit_message_text("❌ Bekor qilindi.")
    
    context.user_data.clear()
    return ConversationHandler.END

def cancel(update: Update, context: CallbackContext):
    update.message.reply_text("Bekor qilindi.")
    context.user_data.clear()
    return ConversationHandler.END


# LIST COMMANDS
@admin_only
def reklama_list(update: Update, context: CallbackContext):
    try:
        resp = requests.get(f"{API_BASE_URL}/admin/advertisements", headers=HEADERS)
        if resp.status_code == 200:
            ads = resp.json()
            if not ads:
                update.message.reply_text("Reklamalar mavjud emas.")
                return
            for ad in ads:
                status = "🟢 ON" if ad.get('isActive') else "🔴 OFF"
                msg = f"<b>ID:</b> {ad.get('id')}\n<b>Title:</b> {ad.get('title')}\n<b>Status:</b> {status}\n<b>Clicks:</b> {ad.get('clicks')}\n\n/reklama_on {ad.get('id')}\n/reklama_off {ad.get('id')}"
                update.message.reply_text(msg, parse_mode="HTML")
    except Exception as e:
        update.message.reply_text(f"Xato: {e}")

@admin_only
def musobaqa_list(update: Update, context: CallbackContext):
    try:
        resp = requests.get(f"{API_BASE_URL}/admin/bot-competitions", headers=HEADERS)
        if resp.status_code == 200:
            comps = resp.json()
            if not comps:
                update.message.reply_text("Musobaqalar mavjud emas.")
                return
            for c in comps:
                status = "🟢 AKTIV" if c.get('isActive') else "🔴 TUGATILGAN"
                msg = f"<b>ID:</b> {c.get('id')}\n<b>{c.get('title')}</b>\n<b>Prize:</b> {c.get('prize')}\n<b>Date:</b> {c.get('date')}\n<b>Status:</b> {status}"
                if c.get('winnerName'):
                     msg += f"\n🏆 <b>G'olib:</b> {c.get('winnerName')}"
                if c.get('isActive'):
                    msg += f"\n\nTugatish usuli (g'olib nomi bilan):\n<code>/musobaqa_tugat {c.get('id')} G'olib nomi</code>"
                update.message.reply_text(msg, parse_mode="HTML")
    except Exception as e:
        update.message.reply_text(f"Xato: {e}")

@admin_only
def toggle_ad(update: Update, context: CallbackContext):
    cmd = update.message.text.split()
    if len(cmd) < 2:
        update.message.reply_text("ID kiritilmadi. Format: /reklama_on UUID")
        return
    
    ad_id = cmd[1]
    is_active = cmd[0] == "/reklama_on"
    try:
        resp = requests.put(f"{API_BASE_URL}/admin/advertisements/{ad_id}/toggle", json={"isActive": is_active}, headers=HEADERS)
        if resp.status_code == 200:
            update.message.reply_text(f"✅ Muvaffaqiyatli {'YAQILDI' if is_active else 'O\u0027CHIRILDI'}")
        else:
            update.message.reply_text(f"Xatolik: {resp.status_code} {resp.text}")
    except Exception as e:
        update.message.reply_text(f"API hatosi: {e}")

@admin_only
def musobaqa_tugat(update: Update, context: CallbackContext):
    parts = update.message.text.split(None, 2)
    if len(parts) < 3:
         update.message.reply_text("Format: /musobaqa_tugat [ID] [G'olib nomi]")
         return
    c_id = parts[1]
    winner = parts[2]
    try:
        resp = requests.put(f"{API_BASE_URL}/admin/competitions/{c_id}/tugat", json={"winnerName": winner}, headers=HEADERS)
        if resp.status_code == 200:
             update.message.reply_text(f"✅ Musobaqa yopildi va G'olib belgilandi: {winner}")
             try:
                 requests.post(f"https://api.telegram.org/bot{TOKEN}/sendMessage", json={
                     "chat_id": ADMIN_ID,
                     "text": f"🏆 Musobaqa tugadi!\n\nG'olib: <b>{winner}</b>",
                     "parse_mode": "HTML"
                 })
             except:
                 pass
        else:
            update.message.reply_text(f"Xatolik: {resp.text}")
    except Exception as e:
        update.message.reply_text(f"API xatosi: {e}")

alerted_comps = set()
def alert_upcoming_competitions(context: CallbackContext):
    try:
        resp = requests.get(f"{API_BASE_URL}/admin/bot-competitions", headers=HEADERS)
        if resp.status_code == 200:
            comps = resp.json()
            now = datetime.utcnow()
            for c in comps:
                if c.get('isActive') and c.get('date'):
                    iso = c['date'].replace("Z", "+00:00")
                    try:
                        c_date = datetime.fromisoformat(iso).replace(tzinfo=None)
                        diff_hrs = (c_date - now).total_seconds() / 3600
                        if 0 < diff_hrs <= 1 and c['id'] not in alerted_comps:
                            alerted_comps.add(c['id'])
                            msg = f"⏳ <b>Diqqat!</b>\n\n<b>{c.get('title')}</b> musobaqasi yarim soat / 1 soat ichida boshlanadi!"
                            context.bot.send_message(chat_id=ADMIN_ID, text=msg, parse_mode="HTML")
                    except:
                        pass
    except Exception:
        pass


def main():
    if not TOKEN:
        print("Telegram bot token is not set!")
        print("Available env vars:", [k for k in os.environ.keys() if "TEL" in k or "BOT" in k])
        return

    updater = Updater(TOKEN, use_context=True)
    dp = updater.dispatcher

    reklama_conv = ConversationHandler(
        entry_points=[CommandHandler('reklama', reklama_start)],
        states={
            R_TITLE: [MessageHandler(Filters.text & ~Filters.command, r_title)],
            R_IMAGE: [MessageHandler(Filters.text & ~Filters.command, r_image)],
            R_LINK: [MessageHandler(Filters.text & ~Filters.command, r_link)],
            R_DESC: [MessageHandler(Filters.text & ~Filters.command, r_desc)],
            R_CONFIRM: [CallbackQueryHandler(r_confirm)]
        },
        fallbacks=[CommandHandler('cancel', cancel)]
    )
    
    musobaqa_conv = ConversationHandler(
        entry_points=[CommandHandler('musobaqa_yarat', musobaqa_start)],
        states={
            M_TITLE: [MessageHandler(Filters.text & ~Filters.command, m_title)],
            M_DATE: [MessageHandler(Filters.text & ~Filters.command, m_date)],
            M_PRIZE: [MessageHandler(Filters.text & ~Filters.command, m_prize)],
            M_CONFIRM: [CallbackQueryHandler(m_confirm)]
        },
        fallbacks=[CommandHandler('cancel', cancel)]
    )

    dp.add_handler(CommandHandler("start", start))
    dp.add_handler(CommandHandler("stats", stats))
    dp.add_handler(CommandHandler("reklama_list", reklama_list))
    dp.add_handler(CommandHandler("reklama_on", toggle_ad))
    dp.add_handler(CommandHandler("reklama_off", toggle_ad))
    
    dp.add_handler(CommandHandler("musobaqa_list", musobaqa_list))
    dp.add_handler(CommandHandler("musobaqa_tugat", musobaqa_tugat))

    dp.add_handler(reklama_conv)
    dp.add_handler(musobaqa_conv)

    # Job Queue for 1 hour warning
    jq = updater.job_queue
    if jq:
        jq.run_repeating(alert_upcoming_competitions, interval=600, first=10)

    print("Yozgo Admin Bot Started (v13)...")
    updater.start_polling()
    updater.idle()

if __name__ == '__main__':
    main()
