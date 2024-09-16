import asyncio
import os
import random
import sys
from time import time

from dotenv import load_dotenv
from mytools import Api, Button, Handler, ImageGen, LoggerHandler, Translate, Extract, BinaryEncryptor
from pyrogram import Client, emoji, filters
from pyrogram.enums import ChatAction
from pyrogram.errors import FloodWait

load_dotenv(sys.argv[1])

logger = LoggerHandler("%(asctime)s - [%(levelname)s] - %(name)s - %(message)s")
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
binary = BinaryEncryptor()


@app.on_message(filters.command("start"))
async def start(client, message):
    user = message.from_user
    keyboard = [
        {"text": "developer", "url": "https://t.me/NorSodikin"},
        {"text": "channel", "url": "https://t.me/FakeCodeX"},
        {"text": "repository", "url": "https://github.com/SenpaiSeeker/chatbot"},
    ]
    reply_markup = Button().generateInlineButtonGrid(keyboard)

    await message.reply_text(
        f"**👋 Hai {Extract().getMention(user)}! Kenalin nih, gue bot pintar berbasis Python dari mytoolsID. Gue siap bantu jawab semua pertanyaan lo.\n\nMau aktifin bot? Ketik aja /chatbot on**",
        reply_markup=reply_markup,
    )
    logger.get_logger(__name__).info("Mengirim pesan selamat datang")


@app.on_message(filters.command(["bencode", "bdecode"]))
async def handle_tts(client, message):
    cmd = message.command[0]
    msg = await message.reply("**Tunggu bentar ya...**")

    text = Handler().getArg(message)
    if not text:
        return await msg.edit(f"{message.text.split()[0]} balas ke text atau ketik sesuatu")

    code = binary.encrypt(text) if cmd == "bencode" else binary.encrypt(text)
    await msg.delete()
    return await  Handler().sendLongPres(message, code)


@app.on_message(filters.command("chatbot"))
async def handle_chatbot(client, message):
    command = message.text.split()[1].lower() if len(message.text.split()) > 1 else ""

    if command == "on":
        chatbot_enabled[message.from_user.id] = True
        await message.reply_text(f"🤖 Chatbot telah diaktifkan untuk {Extract().getMention(message.from_user)}.")
        logger.get_logger(__name__).info(f"Chatbot diaktifkan untuk {Extract().getMention(message.from_user)}")
    elif command == "off":
        chatbot_enabled[message.from_user.id] = False
        await message.reply_text(f"🚫 Chatbot telah dinonaktifkan untuk {Extract().getMention(message.from_user)}.")
        logger.get_logger(__name__).info(f"Chatbot dinonaktifkan untuk {Extract().getMention(message.from_user)}")
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

    user_message = Handler().getMsg(message, is_chatbot=True)
    logger.get_logger(__name__).info(f"Menerima pesan dari pengguna dengan ID: {message.from_user.id}")

    await client.send_chat_action(chat_id=message.chat.id, action=ChatAction.TYPING)

    try:
        result = chatbot.ChatBot(user_message, message.from_user.id)
        logger.get_logger(__name__).info("Mengirim output besar ke pengguna")
        await Handler().sendLongPres(message, result)
    except Exception as e:
        await Handler().sendLongPres(message, f"Terjadi kesalahan: {str(e)}")
        logger.get_logger(__name__).error(f"Terjadi kesalahan: {str(e)}")


@app.on_message(filters.command("tts"))
async def handle_tts(client, message):
    msg = await message.reply("**Tunggu bentar ya...**")

    text = Handler().getArg(message)
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
        user = await Extract().getRid(message)
        if not user:
            return await msg.edit("**harap berikan username atau reply ke pengguna untuk dicek khodam nya**")
        get_name = await client.get_users(user)
        full_name = Extract().getMention(get_name)
    except Exception:
        full_name = Handler().getArg(message)
    logger.get_logger(__name__).info(f"Permintaan mengecek khodam: {full_name}")

    try:
        result = khodam.KhodamCheck(full_name)
        await Handler().sendLongPres(message, result)
        await msg.delete()
        logger.get_logger(__name__).info(f"Berhasil mendapatkan info khodam: {full_name}")
    except Exception as e:
        await Handler().sendLongPres(message, f"Terjadi kesalahan: {str(e)}")
        await msg.delete()
        logger.get_logger(__name__).error(f"Terjadi kesalahan: {str(e)}")


@app.on_message(filters.command("image"))
async def handle_image(client, message):
    msg = await message.reply("**Silahkan tunggu sebentar...**")
    genBingAi = ImageGen()

    prompt = Handler().getArg(message)
    if not prompt:
        return await msg.edit("/image (prompt text)")

    logger.get_logger(__name__).info(f"Memproses permintaan dari pengguna dengan ID: {message.from_user.id}")
    try:
        result = await genBingAi.generate_image(prompt)
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
    if not await Extract.getAdmin(message):
        return await Handler().sendLongPres(message, "**Maaf, perintah ini hanya untuk admin. 😎**")

    msg = await message.reply("Sabar ya, tunggu bentar...", quote=True)

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
            await m.reply(f"{Extract().getArg(message)}\n\n{' '.join(output)}", quote=bool(message.reply_to_message))
            await asyncio.sleep(3)
            count.extend(output)
        except FloodWait as e:
            await asyncio.sleep(e.value)
            await m.reply(f"{Extract().getArg(message)}\n\n{' '.join(output)}", quote=bool(message.reply_to_message))
            await asyncio.sleep(3)
            count.extend(output)

    end_time = Extract().getTime(time() - start_time)
    await msg.delete()
    logger.get_logger(__name__).info(f"Tagall completed: {message.chat.id}")
    await Handler().sendLongPres(
        message,
        f"<b>✅ <code>{len(count)}</code> anggota berhasil di-tag\n⌛️ Waktu yang dibutuhkan: <code>{end_time}</code> detik</b>",
    )

    try:
        chat_tagged.remove(message.chat.id)
    except ValueError:
        pass


@app.on_message(filters.command("cancel"))
async def handle_cancel(client, message):
    if not await Extract().getAdmin(message):
        return await Handler().sendLongPres(message, "**Maaf, perintah ini hanya untuk admin. 😎**")

    if message.chat.id not in chat_tagged:
        return await message.delete()
    chat_tagged.remove(message.chat.id)
    logger.get_logger(__name__).info(f"Tagall cancel: {message.chat.id}")
    return await Handler().sendLongPres(message, "**TagAll berhasil dibatalkan**")


app.run()
