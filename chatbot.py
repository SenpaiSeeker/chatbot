import asyncio
import logging
import os
import sys
from io import BytesIO
from time import time

import requests
from dotenv import load_dotenv
from mytools import ChatBot
from pyrogram import Client, filters
from pyrogram.enums import ChatAction, ChatMemberStatus
from pyrogram.errors import FloodWait
from pyrogram.types import InlineKeyboardButton, InlineKeyboardMarkup

load_dotenv(sys.argv[1])

logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)


def logs(msg):
    return logging.getLogger(msg)


API_ID = os.getenv("API_ID")
API_HASH = os.getenv("API_HASH")
BOT_TOKEN = os.getenv("BOT_TOKEN")
BOT_NAME = os.getenv("BOT_NAME")
DEV_NAME = os.getenv("DEV_NAME")

app = Client(name=BOT_TOKEN.split(":")[0], api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN)

chatbot_enabled = {}
chatbot = ChatBot(name=BOT_NAME, dev=DEV_NAME)

chat_tagged = []


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
    )
    logs(__name__).info("Mengirim pesan selamat datang")


@app.on_message(filters.command("chatbot"))
async def handle_chatbot(client, message):
    global chatbot_enabled
    command = message.text.split()[1].lower() if len(message.text.split()) > 1 else ""

    if not await is_admin(client, message):
        return await message.reply("Maaf, perintah ini hanya untuk admin. 😎")

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


def get_arg(message):
    if message.reply_to_message and len(message.command) < 2:
        return message.reply_to_message.text or message.reply_to_message.caption or ""
    return message.text.split(None, 1)[1] if len(message.command) > 1 else ""


async def send_large_output(message, output):
    logs(__name__).info("Mengirim output besar ke pengguna")
    if len(output) <= 4000:
        await message.reply(output)
    else:
        with BytesIO(str.encode(str(output))) as out_file:
            out_file.name = "result.txt"
            await message.reply_document(document=out_file)


async def is_admin(client, message):
    member = await client.get_chat_member(message.chat.id, message.from_user.id)
    return member.status in (ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.OWNER)


@app.on_message(filters.command("image"))
async def handle_image(client, message):
    prompt = get_arg(message)
    if not prompt:
        return await message.reply("/image (prompt text)")

    logs(__name__).info(f"Menerima pesan dari pengguna dengan ID: {message.from_user.id}")
    await client.send_chat_action(chat_id=message.chat.id, action=ChatAction.TYPING)

    url = f"https://widipe.com/v1/text2img?text={prompt}"
    res = requests.get(url, headers={"accept": "image/jpeg"})

    await client.send_chat_action(chat_id=message.chat.id, action=ChatAction.UPLOAD_PHOTO)
    if res.status_code == 200:
        image = BytesIO(res.content)
        image.name = f"{message.id}_{client.me.id}.jpg"
        await message.reply_photo(image)
        logs(__name__).info(f"Mengirim foto ke: {message.chat.id}")
    else:
        await message.reply("Failed to generate image.")
        logs(__name__).error("gagal membuat foto")


@app.on_message(filters.text & ~filters.command(["start", "chatbot", "image"]))
async def handle_message(client, message):
    global chatbot_enabled
    if not chatbot_enabled.get(message.chat.id, False):
        return

    user_message = get_text(message)
    logs(__name__).info(f"Menerima pesan dari pengguna dengan ID: {message.from_user.id}")

    await client.send_chat_action(chat_id=message.chat.id, action=ChatAction.TYPING)

    try:
        result = chatbot.Text(user_message)
        await send_large_output(message, result)
    except Exception as e:
        await message.reply_text(f"Terjadi kesalahan: {str(e)}")
        logs(__name__).error(f"Terjadi kesalahan: {str(e)}")


@app.on_message(filters.command("tagall"))
async def handle_tagall(client, message):
    if not await is_admin(client, message):
        return await message.reply("**Maaf, perintah ini hanya untuk admin. 😎**")

    msg = await message.reply("Sabar ya, tunggu bentar...", quote=True)

    start_time = time()
    chat_tagged.append(message.chat.id)

    logs(__name__).info(f"tagall started: {message.chat.id}")

    user_tagged = [
        mention(user.user) async for user in message.chat.get_members() if not (user.user.is_bot or user.user.is_deleted)
    ]

    m = message.reply_to_message or message
    count = []
    for output in [user_tagged[i : i + 5] for i in range(0, len(user_tagged), 5)]:
        if message.chat.id not in chat_tagged:
            break
        try:
            await m.reply(
                f"{get_arg(message)}\n\n{' '.join(output)}",
                quote=bool(message.reply_to_message),
            )
            await asyncio.sleep(3)
            count.extend(output)
        except FloodWait as e:
            await asyncio.sleep(e.value)
            await m.reply(
                f"{get_arg(message)}\n\n{' '.join(output)}",
                quote=bool(message.reply_to_message),
            )
            await asyncio.sleep(3)
            count.extend(output)

    end_time = round(time() - start_time, 2)
    await msg.delete()
    logs(__name__).info(f"tagall all completed: {message.chat.id}")
    await message.reply(
        f"<b>✅ <code>{len(count)}</code> anggota berhasil di-tag\n⌛️ Waktu yang dibutuhkan: <code>{end_time}</code> detik</b>"
    )

    try:
        chat_tagged.remove(message.chat.id)
    except ValueError:
        pass


@app.on_message(filters.command("cancel"))
async def handle_cancel(client, message):
    if not await is_admin(client, message):
        return await message.reply("**Maaf, perintah ini hanya untuk admin. 😎**")

    if message.chat.id not in chat_tagged:
        return await message.delete()
    chat_tagged.remove(message.chat.id)
    logs(__name__).info(f"tagall cancel: {message.chat.id}")
    return await message.reply("**TagAll berhasil dibatalkan**")


app.run()
