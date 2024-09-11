import asyncio
import logging
import os
import random
import sys
from io import BytesIO
from time import time

import requests
from dotenv import load_dotenv
from mytools import Api, Button, Handler, User
from pyrogram import Client, emoji, filters
from pyrogram.enums import ChatAction
from pyrogram.errors import FloodWait

load_dotenv(sys.argv[1])

logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)


def get_logger(name):
    return logging.getLogger(name)


API_ID = os.getenv("API_ID")
API_HASH = os.getenv("API_HASH")
BOT_TOKEN = os.getenv("BOT_TOKEN")
BOT_NAME = os.getenv("BOT_NAME")
DEV_NAME = os.getenv("DEV_NAME")

app = Client(name=BOT_TOKEN.split(":")[0], api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN)

chatbot_enabled = {}
chat_tagged = []


@app.on_message(filters.command("start"))
async def start(client, message):
    user = message.from_user
    keyboard = [
        {"text": "developer", "url": "https://t.me/NorSodikin"},
        {"text": "channel", "url": "https://t.me/FakeCodeX"},
        {"text": "repository", "url": "https://github.com/SenpaiSeeker/chatbot"},
    ]
    reply_markup = Button.inline(keyboard)

    await message.reply_text(
        f"**👋 Hai {User.mention(user)}! Kenalin nih, gue bot pintar berbasis Python dari mytoolsID. Gue siap bantu jawab semua pertanyaan lo.\n\nMau aktifin bot? Ketik aja /chatbot on**",
        reply_markup=reply_markup,
    )
    get_logger(__name__).info("Mengirim pesan selamat datang")


@app.on_message(filters.command("chatbot"))
async def handle_chatbot(client, message):
    global chatbot_enabled
    command = message.text.split()[1].lower() if len(message.text.split()) > 1 else ""

    if command == "on":
        chatbot_enabled[message.chat.id] = True
        await message.reply_text("🤖 Chatbot telah diaktifkan.")
        get_logger(__name__).info("Chatbot diaktifkan")
    elif command == "off":
        chatbot_enabled[message.chat.id] = False
        await message.reply_text("🚫 Chatbot telah dinonaktifkan.")
        get_logger(__name__).info("Chatbot dinonaktifkan")
    else:
        await message.reply_text("❓ Perintah tidak dikenal. Gunakan /chatbot on atau /chatbot off.")


@app.on_message(filters.command("clear"))
async def handle_clear_message(client, message):
    clear = Api(name=BOT_NAME, dev=DEV_NAME).clear_chat_history(message.from_user.id)
    await message.reply(clear)


@app.on_message(
    filters.text
    & ~filters.bot
    & ~filters.me
    & ~filters.command(["start", "chatbot", "image", "tagall", "cancel", "clear", "khodam"])
)
async def handle_message(client, message):
    global chatbot_enabled
    if not chatbot_enabled.get(message.chat.id, False):
        return

    user_message = Handler.get_text(message, is_chatbot=True)
    get_logger(__name__).info(f"Menerima pesan dari pengguna dengan ID: {message.from_user.id}")

    await client.send_chat_action(chat_id=message.chat.id, action=ChatAction.TYPING)

    try:
        result = Api(name=BOT_NAME, dev=DEV_NAME).ChatBot(user_message, message.from_user.id)
        get_logger(__name__).info("Mengirim output besar ke pengguna")
        await Handler.send_large_output(message, result)
    except Exception as e:
        await Handler.send_large_output(message, f"Terjadi kesalahan: {str(e)}")
        get_logger(__name__).error(f"Terjadi kesalahan: {str(e)}")


@app.on_message(filters.command("khodam"))
async def handle_khodam(client, message):
    msg = await message.reply("**Sedang memproses....**")
    user = await User.get_id(message)

    if not user:
        return await msg.edit("**harap berikan nama atau reply ke pengguna untuk dicek khodam nya**")

    get_name = await client.get_users(user)
    full_name = User.mention(get_name)
    get_logger(__name__).info(f"Permintaan mengecek khodam: {get_name.first_name}")

    try:
        result = Api(name=BOT_NAME, dev=DEV_NAME, is_khodam=True).KhodamCheck(full_name)
        await Handler.send_large_output(message, result)
        await msg.delete()
        get_logger(__name__).info(f"Berhasil mendapatkan info khodam: {get_name.first_name}")
    except Exception as e:
        await Handler.send_large_output(message, f"Terjadi kesalahan: {str(e)}")
        await msg.delete()
        get_logger(__name__).error(f"Terjadi kesalahan: {str(e)}")


@app.on_message(filters.command("image"))
async def handle_image(client, message):
    prompt = Handler.get_arg(message)
    if not prompt:
        return await message.reply("/image (prompt text)")

    get_logger(__name__).info(f"Menerima pesan dari pengguna dengan ID: {message.from_user.id}")
    await client.send_chat_action(chat_id=message.chat.id, action=ChatAction.TYPING)

    url = f"https://widipe.com/v1/text2img?text={prompt}"
    try:
        res = requests.get(url, headers={"accept": "image/jpeg"})
        res.raise_for_status()
    except requests.RequestException as e:
        get_logger(__name__).error(f"Error generating image: {e}")
        return await Handler.send_large_output(message, "Failed to generate image.")

    await client.send_chat_action(chat_id=message.chat.id, action=ChatAction.UPLOAD_PHOTO)
    if res.status_code == 200:
        image = BytesIO(res.content)
        image.name = f"{message.id}_{client.me.id}.jpg"
        await message.reply_photo(image)
        get_logger(__name__).info(f"Mengirim foto ke: {message.chat.id}")
    else:
        await Handler.send_large_output(message, "Failed to generate image.")
        get_logger(__name__).error("Gagal membuat foto")


@app.on_message(filters.command("tagall"))
async def handle_tagall(client, message):
    if not await User.get_admin(message):
        return await Handler.send_large_output(message, "**Maaf, perintah ini hanya untuk admin. 😎**")

    msg = await Handler.send_large_output(message, "Sabar ya, tunggu bentar...", quote=True)

    start_time = time()
    chat_tagged.append(message.chat.id)

    get_logger(__name__).info(f"Tagall started: {message.chat.id}")

    emoji_list = [value for key, value in emoji.__dict__.items() if not key.startswith("__")]
    user_tagged = [
        f"<a href=tg://user?id={user.user.id}>{random.choice(emoji_list)}</a>"
        async for user in message.chat.get_members()
        if not (user.user.is_bot or user.user.is_deleted)
    ]

    m = message.reply_to_message or message
    count = []
    for output in [user_tagged[i : i + 5] for i in range(0, len(user_tagged), 5)]:
        if message.chat.id not in chat_tagged:
            break
        try:
            await m.reply(f"{Handler.get_arg(message)}\n\n{' '.join(output)}", quote=bool(message.reply_to_message))
            await asyncio.sleep(3)
            count.extend(output)
        except FloodWait as e:
            await asyncio.sleep(e.value)
            await m.reply(f"{Handler.get_arg(message)}\n\n{' '.join(output)}", quote=bool(message.reply_to_message))
            await asyncio.sleep(3)
            count.extend(output)

    end_time = round(time() - start_time, 2)
    await msg.delete()
    get_logger(__name__).info(f"Tagall completed: {message.chat.id}")
    await Handler.send_large_output(
        message,
        f"<b>✅ <code>{len(count)}</code> anggota berhasil di-tag\n⌛️ Waktu yang dibutuhkan: <code>{end_time}</code> detik</b>",
    )

    try:
        chat_tagged.remove(message.chat.id)
    except ValueError:
        pass


@app.on_message(filters.command("cancel"))
async def handle_cancel(client, message):
    if not await User.get_admin(message):
        return await message.reply("**Maaf, perintah ini hanya untuk admin. 😎**")

    if message.chat.id not in chat_tagged:
        return await message.delete()
    chat_tagged.remove(message.chat.id)
    get_logger(__name__).info(f"Tagall cancel: {message.chat.id}")
    return await message.reply("**TagAll berhasil dibatalkan**")


app.run()
