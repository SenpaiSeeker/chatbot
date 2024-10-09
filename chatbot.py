import os
import sys

from dotenv import load_dotenv
from mytools import Api, Button, Extract, Handler, ImageGen, LoggerHandler
from pyrogram import Client, filters
from pyrogram.enums import ChatAction

load_dotenv(sys.argv[1])

logger = LoggerHandler()
logger.setup_logger()


API_ID = os.getenv("API_ID")
API_HASH = os.getenv("API_HASH")
BOT_TOKEN = os.getenv("BOT_TOKEN")
BOT_NAME = os.getenv("BOT_NAME")
DEV_NAME = os.getenv("DEV_NAME")

app = Client(name=BOT_TOKEN.split(":")[0], api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN)

chatbot_enabled, chat_tagged = {}, []
my_api, genBingAi = Api(name=BOT_NAME, dev=DEV_NAME), ImageGen()


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
    clear = my_api.clear_chat_history(message)
    await message.reply(clear)


@app.on_message(filters.text & ~filters.bot & ~filters.me & ~filters.command(["start", "chatbot", "image", "clear", "khodam"]))
async def handle_message(client, message):
    if not chatbot_enabled.get(message.from_user.id, False):
        return

    logger.get_logger(__name__).info(f"Menerima pesan dari pengguna dengan ID: {message.from_user.id}")

    await client.send_chat_action(chat_id=message.chat.id, action=ChatAction.TYPING)

    try:
        result = my_api.ChatBot(message)
        logger.get_logger(__name__).info("Mengirim output besar ke pengguna")
        await Handler().sendLongPres(message, result)
    except Exception as e:
        await Handler().sendLongPres(message, str(e))
        logger.get_logger(__name__).error(str(e))


@app.on_message(filters.command("khodam"))
async def handle_khodam(client, message):
    msg = await message.reply("**Sedang memproses....**")

    try:
        user = await Extract().getId(message)
        if not user:
            return await msg.edit("**harap berikan username atau reply ke pengguna untuk dicek khodam nya**")
        get_name = await client.get_users(user)
        full_name = Extract().getMention(get_name)
    except Exception:
        full_name = Handler().getArg(message)
    logger.get_logger(__name__).info(f"Permintaan mengecek khodam: {full_name}")

    try:
        result = my_api.KhodamCheck(full_name)
        await Handler().sendLongPres(message, result)
        await msg.delete()
        logger.get_logger(__name__).info(f"Berhasil mendapatkan info khodam: {full_name}")
    except Exception as e:
        await Handler().sendLongPres(message, str(e))
        await msg.delete()
        logger.get_logger(__name__).error(str(e))


@app.on_message(filters.command("image"))
async def handle_image(client, message):
    msg = await message.reply("**Silahkan tunggu sebentar...**")

    prompt = Handler().getArg(message)
    if not prompt:
        return await msg.edit("/image (prompt text)")

    logger.get_logger(__name__).info(f"Memproses permintaan dari pengguna dengan ID: {message.from_user.id}")
    try:
        result = await genBingAi.generate_image(prompt)
    except Exception as error:
        logger.get_logger(__name__).error(str(error))
        return await msg.edit(str(error))

    try:
        await message.reply_media_group(result)
        await msg.delete()
        logger.get_logger(__name__).info(f"Berhasil mengirimkan list genBingAi ke: {message.from_user.id}")
        genBingAi._remove_file(result)
    except Exception as error:
        return await msg.edit(error)


app.run()
