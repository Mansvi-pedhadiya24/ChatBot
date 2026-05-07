# test_firebase.py
import firebase_admin
from firebase_admin import credentials, db
import time

KEY_PATH = "C:/users/LENOVO/Desktop/chatbot/backend/app/serviceAccountKey.json"

cred = credentials.Certificate(KEY_PATH)
firebase_admin.initialize_app(cred, {
    "databaseURL": "https://tellustheodds-chat-default-rtdb.firebaseio.com"
})

print("Trying to write...")
ref = db.reference("test")
ref.set({"hello": "world", "ts": time.time()})
print("Write successful!")

val = ref.get()
print("Read:", val)