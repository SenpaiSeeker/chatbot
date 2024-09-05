import logging
import os

from dotenv import load_dotenv
from mytools import ChatBot
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes, MessageHandler, filters

load_dotenv()

logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)


def logs(msg):
    return logging.getLogger(msg)


BOT_TOKEN = os.getenv("BOT_TOKEN")
BOT_NAME = os.getenv("BOT_NAME")
DEV_NAME = os.getenv("DEV_NAME")

chatbot_enabled = {}
chatbot = ChatBot(name=BOT_NAME, dev=DEV_NAME)


def mention(user):
    name = f"{user.first_name} {user.last_name}" if user.last_name else user.first_name
    link = f"tg://user?id={user.id}"
    return f"[{name}]({link})"


def inline(buttons, row_width=2):
    keyboard = [
        [InlineKeyboardButton(**button_data) for button_data in buttons[i : i + row_width]]
        for i in range(0, len(buttons), row_width)
    ]
    return InlineKeyboardMarkup(keyboard)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    keyboard = [
        {"text": "developer", "url": "https://t.me/NorSodikin"},
        {"text": "channel", "url": "https://t.me/FakeCodeX"},
        {"text": "repository", "url": "https://github.com/SenpaiSeeker/chatbot"},
    ]
    reply_markup = inline(keyboard)

    await update.message.reply_text(
        f"**👋 Hai {mention(user)}! Kenalin nih, gue bot pintar berbasis Python dari mytoolsID.Gue siap bantu jawab semua pertanyaan lo.\n\nMau aktifin bot? Ketik aja /chatbot on**",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=reply_markup,
    )
    logs(__name__).info("Mengirim pesan selamat datang")


async def handle_chatbot(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global chatbot_enabled
    command = context.args[0].lower() if context.args else ""

    if command == "on":
        chatbot_enabled[update.effective_chat.id] = True
        await update.message.reply_text("🤖 Chatbot telah diaktifkan.")
        logs(__name__).info("Chatbot diaktifkan")
    elif command == "off":
        chatbot_enabled[update.effective_chat.id] = False
        await update.message.reply_text("🚫 Chatbot telah dinonaktifkan.")
        logs(__name__).info("Chatbot dinonaktifkan")
    else:
        await update.message.reply_text("❓ Perintah tidak dikenal. Gunakan /chatbot on atau /chatbot off.")


def get_text(message):
    reply_text = message.reply_to_message.text if message.reply_to_message else ""
    user_text = message.text
    return f"anda: {user_text}\n\nsaya: {reply_text}" if reply_text and user_text else reply_text + user_text


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global chatbot_enabled
    if not chatbot_enabled.get(update.effective_chat.id, False):
        return

    user_message = get_text(update.message)
    logs(__name__).info(f"Menerima pesan dari pengguna dengan ID: {update.effective_user.id}")

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action="typing")

    try:
        result = chatbot.Text(user_message)
        await update.message.reply_text(result.replace("*", ""))
    except Exception as e:
        await update.message.reply_text(f"Terjadi kesalahan: {str(e)}")
        logs(__name__).error(f"Terjadi kesalahan: {str(e)}")


def main():
    application = ApplicationBuilder().token(BOT_TOKEN).build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("chatbot", handle_chatbot))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    application.run_polling()


if __name__ == "__main__":
    main()
