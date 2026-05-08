import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { ref, onValue, off } from "firebase/database";

export function useTyping(sessionId) {
  const [typing, setTyping] = useState(false);
  
  useEffect(() => {
    if (!sessionId) return;
    const statRef = ref(db, `status/${sessionId}`);
    const unsub = onValue(statRef, (snap) => {
      const s = snap.val();
      if (s?.typing !== undefined) setTyping(s.typing);
    });
    return () => off(statRef, "value", unsub);
  }, [sessionId]);
  
  return typing;
}