import logging
import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes, MessageHandler, filters
from dotenv import load_dotenv

from mytools import ChatBot 

load_dotenv()

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

def logs(msg):
    return logging.getLogger(msg)

BOT_TOKEN = os.getenv('BOT_TOKEN')

chatbot_enabled = {}

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    keyboard = [[InlineKeyboardButton("developer", url="https://t.me/NorSodikin")]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        f"**👋 Hai [{user.first_name}](tg://user?id={user.id})!** "
        "**Kenalin nih, gue bot pintar berbasis Python dari mytoolsID.** "
        "**Gue siap bantu jawab semua pertanyaan lo.** "
        "\n**Mau aktifin bot? Ketik aja /chatbot on**",
        parse_mode='Markdown',
        reply_markup=reply_markup
    )
    logs(__name__).info('Mengirim pesan selamat datang')

async def handle_chatbot(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global chatbot_enabled
    command = context.args[0].lower() if context.args else ''
    
    if command == 'on':
        chatbot_enabled[update.effective_chat.id] = True
        await update.message.reply_text("🤖 Chatbot telah diaktifkan.")
        logs(__name__).info('Chatbot diaktifkan')
    elif command == 'off':
        chatbot_enabled[update.effective_chat.id] = False
        await update.message.reply_text("🚫 Chatbot telah dinonaktifkan.")
        logs(__name__).info('Chatbot dinonaktifkan')
    else:
        await update.message.reply_text("❓ Perintah tidak dikenal. Gunakan /chatbot on atau /chatbot off.")

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global chatbot_enabled
    if not chatbot_enabled.get(update.effective_chat.id, False):
        return
    
    user_message = update.message.text
    logs(__name__).info(f"Menerima pesan dari pengguna dengan ID: {update.effective_user.id}")
    
    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action='typing')
    
    try:
        result = ChatBot(name="tomi", dev="@NorSodikin").Text(user_message)
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

if __name__ == '__main__':
    main()
