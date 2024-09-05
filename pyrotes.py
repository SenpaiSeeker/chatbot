import logging
import os
from dotenv import load_dotenv
from mytools import ChatBot
from pyrogram import Client, filters
from pyrogram.types import InlineKeyboardButton, InlineKeyboardMarkup

load_dotenv()

logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)

def logs(msg):
    return logging.getLogger(msg)

API_ID = os.getenv("API_ID")
API_HASH = os.getenv("API_HASH")
BOT_TOKEN = os.getenv("BOT_TOKEN")
BOT_NAME = os.getenv("BOT_NAME")
DEV_NAME = os.getenv("DEV_NAME")

app = Client("my_bot", api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN)

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

@app.on_message(filters.command("start"))
async def start(client, message):
    user = message.from_user
    keyboard = [
        {"text": "developer", "url": "https://t.me/NorSodikin"},
        {"text": "channel", "url": "https://t.me/FakeCodeX"},
        {"text": "repository", "url": "https://github.com/SenpaiSeeker/chatbot"},
    ]
    reply_markup = inline(keyboard)

    await message.reply_text(
        f"**👋 Hai {mention(user)}! Kenalin nih, gue bot pintar berbasis Python dari mytoolsID. Gue siap bantu jawab semua pertanyaan lo.\n\nMau aktifin bot? Ketik aja /chatbot on**",
        reply_markup=reply_markup,
        parse_mode="markdown",
    )
    logs(__name__).info("Mengirim pesan selamat datang")

@app.on_message(filters.command("chatbot"))
async def handle_chatbot(client, message):
    global chatbot_enabled
    command = message.text.split()[1].lower() if len(message.text.split()) > 1 else ""

    if command == "on":
        chatbot_enabled[message.chat.id] = True
        await message.reply_text("🤖 Chatbot telah diaktifkan.")
        logs(__name__).info("Chatbot diaktifkan")
    elif command == "off":
        chatbot_enabled[message.chat.id] = False
        await message.reply_text("🚫 Chatbot telah dinonaktifkan.")
        logs(__name__).info("Chatbot dinonaktifkan")
    else:
        await message.reply_text("❓ Perintah tidak dikenal. Gunakan /chatbot on atau /chatbot off.")

def get_text(message):
    reply_text = message.reply_to_message.text if message.reply_to_message else ""
    user_text = message.text
    return f"anda: {user_text}\n\nsaya: {reply_text}" if reply_text and user_text else reply_text + user_text

@app.on_message(filters.text & ~filters.command)
async def handle_message(client, message):
    global chatbot_enabled
    if not chatbot_enabled.get(message.chat.id, False):
        return

    user_message = get_text(message)
    logs(__name__).info(f"Menerima pesan dari pengguna dengan ID: {message.from_user.id}")

    await client.send_chat_action(chat_id=message.chat.id, action="typing")

    try:
        result = chatbot.Text(user_message)
        await message.reply_text(result.replace("*", ""))
    except Exception as e:
        await message.reply_text(f"Terjadi kesalahan: {str(e)}")
        logs(__name__).error(f"Terjadi kesalahan: {str(e)}")

app.run()
