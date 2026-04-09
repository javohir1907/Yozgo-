#!/bin/bash
# Python paketlarini o'rnatish va Admin botni orqa fonda (background) ishga tushirish
pip install -r admin_bot/requirements.txt
python3 admin_bot/main.py &

# Asosiy Node.js backend serverini ishga tushirish
npm start
