import { useState, useEffect, useRef } from "react";
import { useWebSocket } from "./hooks/useWebSockets";
import { useTyping } from "./hooks/useTyping";
import { StatusDot } from "./components/statusDot";
import { Message } from "./components/Message";
import { TypingIndicator } from "./components/TypingIndicator";
import { FloatingChatButton } from "./components/FloatingChatButton";
import { generateNewSessionId } from "./utils/session";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const QUICK_QUESTIONS = [
  "Start my intake form",
  "What is my claim probability?",
  "Which option has the best value?",
  "What does elimination period mean?",
  "How does inflation protection work?",
  "Show all my details",
];

export default function App() {
  const [sessionId, setSessionId] = useState("");
  const wsUrl = `ws://192.168.0.245:8001/ws/chat?session_id=${sessionId}`;
  const { status, messages, send } = useWebSocket(wsUrl, sessionId);
  const typing = useTyping(sessionId);

  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState("");
  // Local counter for user messages so IDs are always numeric and sortable
  const localIdRef = useRef(0);
  const [userMessages, setUserMessages] = useState([]);
  const bottomRef = useRef(null);

  // Merge WebSocket history + locally-added user messages.
  // History messages have numeric-prefixed string IDs (hist_N_ts) — we parse
  // the timestamp portion so sorting works correctly with local numeric IDs.
  const allMessages = [...messages, ...userMessages].sort((a, b) => {
    const numA = typeof a.id === "number" ? a.id : parseInt(String(a.id).split("_").pop(), 10);
    const numB = typeof b.id === "number" ? b.id : parseInt(String(b.id).split("_").pop(), 10);
    return numA - numB;
  });

  useEffect(() => {
    let id = localStorage.getItem("tuto_session_id");
    if (!id) id = generateNewSessionId();
    setSessionId(id);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages, typing]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || status !== "connected") return;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    // Use a stable numeric ID so sorting with history works
    const id = Date.now() + (++localIdRef.current);
    setUserMessages((prev) => [...prev, { type: "user", text, timestamp: now, id }]);
    send(text);
    setInput("");
  };

  const handleQuickSend = (q) => {
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const id = Date.now() + (++localIdRef.current);
    setUserMessages((p) => [...p, { type: "user", text: q, timestamp: now, id }]);
    send(q);
  };

  if (!chatOpen)
    return <FloatingChatButton onClick={() => setChatOpen(true)} isOpen={false} />;

  return (
    <>
      <style>{`
        :root {
          --brand-navy: #4886ff;
          --brand-gold: #f4f1e6;
        }
        * { box-sizing: border-box; }
        body { font-family: 'Open Sans', sans-serif; background: #f0f2f5; }
        @keyframes msgIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fabPop {
          from { transform: scale(0.85); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        .tuto-widget { animation: fabPop 0.25s ease-out; }
        .tuto-msg    { animation: msgIn 0.3s ease-out; }
      `}</style>

      <FloatingChatButton onClick={() => setChatOpen(false)} isOpen />

      <div
        className="tuto-widget"
        style={{
          position: "fixed",
          bottom: 90,
          right: 24,
          width: 420,
          height: "85vh",
          maxHeight: 680,
          zIndex: 9997,
          display: "flex",
          flexDirection: "column",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(15,52,96,0.22), 0 4px 16px rgba(15,52,96,0.1)",
          border: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "var(--brand-navy)",
            borderBottom: "2.5px solid var(--brand-gold)",
            padding: "13px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: 8,
                background: "var(--brand-gold)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 17, color: "var(--brand-navy)", fontWeight: 700,
              }}
            >
              T
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 15, fontFamily: "'Open Sans', sans-serif" }}>
                Tell Us The Odds℠
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1.2px" }}>
                Valuation Services
              </div>
            </div>
          </div>
          <StatusDot status={status} />
        </div>

        {/* Info bar */}
        <div
          style={{
            background: "#eff6ff",
            borderBottom: "1px solid #bfdbfe",
            padding: "5px 16px",
            fontSize: 11,
            color: "#1d4ed8",
            display: "flex",
            alignItems: "center",
            gap: 5,
            flexShrink: 0,
            fontFamily: "'Open Sans', sans-serif",
          }}
        >
          ℹ️ Educational guidance only — not financial or legal advice.
        </div>

        {/* Quick chips — only before any message */}
        {allMessages.length === 0 && (
          <div
            style={{
              padding: "10px 14px",
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              background: "#fafbfc",
              borderBottom: "1px solid #f0f2f5",
              flexShrink: 0,
            }}
          >
            {QUICK_QUESTIONS.map((q) => (
              <Badge
                key={q}
                variant="outline"
                onClick={() => handleQuickSend(q)}
                style={{
                  cursor: "pointer",
                  fontSize: 11,
                  padding: "5px 11px",
                  border: "1px solid #c7d2fe",
                  background: "#fff",
                  color: "#3730a3",
                  borderRadius: 20,
                  fontWeight: 500,
                  fontFamily: "'Open Sans', sans-serif",
                }}
              >
                {q}
              </Badge>
            ))}
          </div>
        )}

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px 14px",
            background: "#f8fafc",
            minHeight: 0,
          }}
        >
          {allMessages.length === 0 && (
            <div style={{ textAlign: "center", color: "#64748b", paddingTop: "30%" }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📝</div>
              <p style={{ fontSize: 14, fontWeight: 500, fontFamily: "'Open Sans', sans-serif" }}>
                How can we help with your policy analysis today?
              </p>
            </div>
          )}
          {allMessages.map((msg) => (
            <Message key={msg.id} msg={msg} isUser={msg.type === "user"} />
          ))}
          {typing && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          style={{
            padding: "12px 14px",
            background: "#fff",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            flexShrink: 0,
          }}
        >
          <Textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())
            }
            placeholder="Type your message…"
            disabled={status !== "connected"}
            style={{
              flex: 1,
              resize: "none",
              borderRadius: 10,
              fontSize: 13.5,
              fontFamily: "'Open Sans', sans-serif",
              minHeight: 40,
              maxHeight: 100,
              padding: "10px 13px",
              border: "1px solid #e2e8f0",
              background: "#fafbfc",
              color: "#1e293b",
              outline: "none",
            }}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || status !== "connected"}
            style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: input.trim() && status === "connected" ? "var(--brand-navy)" : "#cbd5e0",
              border: "none", color: "#fff", fontSize: 16, padding: 0,
            }}
          >
            ➤
          </Button>
        </div>

        {/* Disconnected warning banner */}
        {status === "disconnected" || status === "error" ? (
          <div
            style={{
              padding: "7px 14px",
              background: "#fef2f2",
              borderTop: "1px solid #fecaca",
              fontSize: 11,
              color: "#b91c1c",
              textAlign: "center",
              fontFamily: "'Open Sans', sans-serif",
              flexShrink: 0,
            }}
          >
            ⚠️ Disconnected — reconnecting automatically…
          </div>
        ) : (
          /* Footer */
          <div
            style={{
              padding: "7px",
              textAlign: "center",
              fontSize: 10,
              color: "#94a3b8",
              background: "#fafbfc",
              borderTop: "1px solid #f1f5f9",
              flexShrink: 0,
              fontFamily: "'Open Sans', sans-serif",
            }}
          >
            Sutter's Mill Valuation Services
          </div>
        )}
      </div>
    </>
  );
}