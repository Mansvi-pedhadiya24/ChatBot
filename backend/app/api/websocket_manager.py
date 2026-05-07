import json
import asyncio
import concurrent.futures
from typing import List, Dict
from datetime import datetime

from fastapi import WebSocket
import firebase_admin
from firebase_admin import credentials, db as firebase_db

if not firebase_admin._apps:
    KEY_PATH = r"C:\Users\LENOVO\Desktop\chatbot\backend\app\serviceAccountKey.json"
    cred = credentials.Certificate(KEY_PATH)
    firebase_admin.initialize_app(cred, {
        "databaseURL": "https://tellustheodd-default-rtdb.firebaseio.com", 
    })

_executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)

# Firebase is ONLY used for real-time  (typing + online status)
_status_ref = firebase_db.reference("status")

class ConnectionManager:

    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._session_map: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, session_id: str) -> str:
        await websocket.accept()
        self.active_connections.append(websocket)
        self._session_map[websocket] = session_id

        # Firebase: only set online presence
        asyncio.create_task(self._firebase_set_status(session_id, connected=True))
        return session_id

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

        sid = self._session_map.pop(websocket, None)
        if sid:
            # Firebase: mark offline — do synchronously since we're disconnecting
            try:
                _status_ref.child(sid).set({
                    "connected": False,
                    "typing": False,
                    "disconnected_at": datetime.now().isoformat(),
                })
            except Exception as e:
                print(f"[Firebase] Disconnect update failed: {e}")

    async def set_typing(self, websocket: WebSocket, is_typing: bool):
        sid = self._session_map.get(websocket)
        if sid:
            # Firebase: only typing status, fire-and-forget
            asyncio.create_task(self._firebase_update(sid, {"typing": is_typing}))

    async def send_personal_message(self, data: dict, websocket: WebSocket):
        await websocket.send_text(json.dumps(data))

    # ── Firebase helpers (presence only) ──────────────────────
    async def _firebase_set_status(self, session_id: str, connected: bool):
        loop = asyncio.get_running_loop()
        try:
            await asyncio.wait_for(
                loop.run_in_executor(
                    _executor,
                    _status_ref.child(session_id).set,
                    {
                        "connected": connected,
                        "typing": False,
                        "connected_at": datetime.now().isoformat(),
                    }
                ),
                timeout=5.0,
            )
        except Exception as e:
            print(f"[Firebase] Status set failed: {e}")

    async def _firebase_update(self, session_id: str, data: dict):
        loop = asyncio.get_running_loop()
        try:
            await asyncio.wait_for(
                loop.run_in_executor(
                    _executor,
                    _status_ref.child(session_id).update,
                    data,
                ),
                timeout=5.0,
            )
        except Exception as e:
            print(f"[Firebase] Update failed: {e}")

manager = ConnectionManager()

