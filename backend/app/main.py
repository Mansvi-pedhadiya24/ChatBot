# from dotenv import load_dotenv
# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware

# from app.api.websocket_manager import manager
# from app.api.router import api_router
# import os

# # Force load from exact path
# load_dotenv(dotenv_path=r"C:/Users/LENOVO/Desktop/chatbot/backend/.env")

# print("GROQ KEY:", os.getenv("GROQ_API_KEY"))  # must print the key

# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
# from app.api.router import api_router

# app = FastAPI()

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# app.include_router(api_router)

from dotenv import load_dotenv
import os

# Load .env from the same directory as this file (works on any machine)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

print("GROQ KEY:", os.getenv("GROQ_API_KEY"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)