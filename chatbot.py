import asyncio
import os
import random
import sys
from time import time

from dotenv import load_dotenv
from mytools import Api, Button, Handler, ImageGen, LoggerHandler, Translate, User
from pyrogram import Client, emoji, filters
from pyrogram.enums import ChatAction
from pyrogram.errors import FloodWait

load_dotenv(sys.argv[1])

logger = LoggerHandler("%(asctime)s - %(levelname)s - %(name)s - %(message)s")
logger.setup_logger()


API_ID = os.getenv("API_ID")
API_HASH = os.getenv("API_HASH")
BOT_TOKEN = os.getenv("BOT_TOKEN")
BOT_NAME = os.getenv("BOT_NAME")
DEV_NAME = os.getenv("DEV_NAME")

app = Client(name=BOT_TOKEN.split(":")[0], api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN)

chatbot_enabled, chat_tagged = {}, []
chatbot = Api(name=BOT_NAME, dev=DEV_NAME)
trans = Translate()
khodam = Api(name=BOT_NAME, dev=DEV_NAME, is_khodam=True)


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
    logger.get_logger(__name__).info("Mengirim pesan selamat datang")


@app.on_message(filters.command("chatbot"))
async def handle_chatbot(client, message):
    command = message.text.split()[1].lower() if len(message.text.split()) > 1 else ""

    if command == "on":
        chatbot_enabled[message.from_user.id] = True
        await message.reply_text(f"🤖 Chatbot telah diaktifkan untuk {User.mention(message.from_user)}.")
        logger.get_logger(__name__).info(f"Chatbot diaktifkan untuk {User.mention(message.from_user)}")
    elif command == "off":
        chatbot_enabled[message.from_user.id] = False
        await message.reply_text(f"🚫 Chatbot telah dinonaktifkan untuk {User.mention(message.from_user)}.")
        logger.get_logger(__name__).info(f"Chatbot dinonaktifkan untuk {User.mention(message.from_user)}")
    else:
        await message.reply_text("❓ Perintah tidak dikenal. Gunakan /chatbot on atau /chatbot off.")


@app.on_message(filters.command("clear"))
async def handle_clear_message(client, message):
    clear = chatbot.clear_chat_history(message.from_user.id)
    await message.reply(clear)


@app.on_message(
    filters.text
    & ~filters.bot
    & ~filters.me
    & ~filters.command(["start", "chatbot", "image", "tagall", "cancel", "clear", "khodam", "tts"])
)
async def handle_message(client, message):
    if not chatbot_enabled.get(message.from_user.id, False):
        return

    user_message = Handler.get_text(message, is_chatbot=True)
    logger.get_logger(__name__).info(f"Menerima pesan dari pengguna dengan ID: {message.from_user.id}")

    await client.send_chat_action(chat_id=message.chat.id, action=ChatAction.TYPING)

    try:
        result = chatbot.ChatBot(user_message, message.from_user.id)
        logger.get_logger(__name__).info("Mengirim output besar ke pengguna")
        await Handler.send_large_output(message, result)
    except Exception as e:
        await Handler.send_large_output(message, f"Terjadi kesalahan: {str(e)}")
        logger.get_logger(__name__).error(f"Terjadi kesalahan: {str(e)}")


@app.on_message(filters.command("tts"))
async def handle_tts(client, message):
    msg = await message.reply("**Tunggu bentar ya...**")

    text = Handler.get_arg(message)
    if not text:
        return await msg.edit("/tts (replyText/typingText)")

    logger.get_logger(__name__).info(f"Menerima permintaan TTS dari user ID {message.from_user.id}")

    try:
        tts = trans.TextToSpeech(text)
        await message.reply_voice(tts)
        os.remove(tts)
        logger.get_logger(__name__).info(f"Berhasil mengirimkan TTS ke user ID {message.from_user.id}")
        await msg.delete()
    except Exception as e:
        logger.get_logger(__name__).error(f"Error generating TTS: {e}")
        return await msg.edit(f"Error: {str(e)}")


@app.on_message(filters.command("khodam"))
async def handle_khodam(client, message):
    msg = await message.reply("**Sedang memproses....**")

    try:
        user = await User.get_id(message)
        if not user:
            return await msg.edit("**harap berikan username atau reply ke pengguna untuk dicek khodam nya**")
        get_name = await client.get_users(user)
        full_name = User.mention(get_name)
    except Exception:
        full_name = Handler.get_arg(message)
    logger.get_logger(__name__).info(f"Permintaan mengecek khodam: {full_name}")

    try:
        result = khodam.KhodamCheck(full_name)
        await Handler.send_large_output(message, result)
        await msg.delete()
        logger.get_logger(__name__).info(f"Berhasil mendapatkan info khodam: {full_name}")
    except Exception as e:
        await Handler.send_large_output(message, f"Terjadi kesalahan: {str(e)}")
        await msg.delete()
        logger.get_logger(__name__).error(f"Terjadi kesalahan: {str(e)}")


@app.on_message(filters.command("image"))
async def handle_image(client, message):
    msg = await message.reply("**Silahkan tunggu sebentar...**")
    genBingAi = ImageGen()

    prompt = Handler.get_arg(message)
    if not prompt:
        return await msg.edit("/image (prompt text)")

    logger.get_logger(__name__).info(f"Memproses permintaan dari pengguna dengan ID: {message.from_user.id}")
    try:
        result = await genBingAi.generate_image(prompt, f"**🖼 ImageGen By: @{app.me.username}**")
    except Exception as error:
        logger.get_logger(__name__).error(f"Terjadi kesalahan: {str(error)}")
        return await msg.edit(f"Error: {str(error)}")

    try:
        await message.reply_media_group(result)
        await msg.delete()
        logger.get_logger(__name__).info(f"Berhasil mengirimkan list genBingAi ke: {message.from_user.id}")
        genBingAi._remove_file(result)
    except Exception as error:
        return await msg.edit(error)


@app.on_message(filters.command("tagall"))
async def handle_tagall(client, message):
    if not await User.get_admin(message):
        return await Handler.send_large_output(message, "**Maaf, perintah ini hanya untuk admin. 😎**")

    msg = await Handler.send_large_output(message, "Sabar ya, tunggu bentar...", quote=True)

    start_time = time()
    chat_tagged.append(message.chat.id)

    logger.get_logger(__name__).info(f"Tagall started: {message.chat.id}")

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
    logger.get_logger(__name__).info(f"Tagall completed: {message.chat.id}")
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
        return await Handler.send_large_output(message, "**Maaf, perintah ini hanya untuk admin. 😎**")

    if message.chat.id not in chat_tagged:
        return await message.delete()
    chat_tagged.remove(message.chat.id)
    logger.get_logger(__name__).info(f"Tagall cancel: {message.chat.id}")
    return await Handler.send_large_output(message, "**TagAll berhasil dibatalkan**")


app.run()
