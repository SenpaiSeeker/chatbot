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

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    keyboard = [[InlineKeyboardButton("developer", url="https://t.me/NorSodikin")]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        f"👋 Hai [{user.first_name}](tg://user?id={user.id})! "
        "Perkenalkan saya ai telegram bot berbasis program python. "
        "Dan saya adalah robot kecerdasan buatan dari api nolimit-next, "
        "dan saya siap menjawab pertanyaan yang Anda berikan.",
        parse_mode='Markdown',
        reply_markup=reply_markup
    )
    logs(__name__).info('Mengirim pesan selamat datang')

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_message = update.message.text
    logs(__name__).info(f"Menerima pesan dari pengguna dengan ID: {update.effective_user.id}")
    
    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action='typing')
    
    try:
        result = ChatBot("gaul").Text(user_message, name="tomi")
        await send_large_output(update, result, context)
    except Exception as e:
        await update.message.reply_text(f"Terjadi kesalahan: {str(e)}")
        logs(__name__).error(f"Terjadi kesalahan: {str(e)}")

async def send_large_output(update, output, context):
    logs(__name__).info('Mengirim output besar ke pengguna')
    if len(output) <= 4000:
        await update.message.reply_text(output)
    else:
        with open('result.txt', 'w') as file:
            file.write(output)
        
        await context.bot.send_document(chat_id=update.effective_chat.id, document=open('result.txt', 'rb'))
        os.remove('result.txt')

def main():
    application = ApplicationBuilder().token(BOT_TOKEN).build()
    
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    application.run_polling()

if __name__ == '__main__':
    main()
