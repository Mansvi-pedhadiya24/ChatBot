import { useState, useEffect, useRef } from "react";
import { useWebSocket } from "./hooks/useWebSockets";
import { useTyping } from "./hooks/useTyping";
import { usePolicyData } from "./hooks/usePolicyData";
import { StatusDot } from "./components/statusDot";
import { Message } from "./components/Message";
import { TypingIndicator } from "./components/TypingIndicator";
import { FloatingChatButton } from "./components/FloatingChatButton";
import { PolicyTab } from "./components/PolicyTab";
import { generateNewSessionId } from "./utils/session";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
  const { policy, versions, loading, fetchPolicy, fetchVersions, resetPolicy } =
    usePolicyData(sessionId);

  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState("");
  const [userMessages, setUserMessages] = useState([]);
  const [tab, setTab] = useState("chat");
  const bottomRef = useRef(null);

  const allMessages = [...messages, ...userMessages].sort((a, b) => a.id - b.id);

  useEffect(() => {
    let id = localStorage.getItem("tuto_session_id");
    if (!id) id = generateNewSessionId();
    setSessionId(id);
  }, []);

  useEffect(() => {
    if (tab === "policy") {
      fetchPolicy();
      fetchVersions();
    }
  }, [tab, fetchPolicy, fetchVersions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages, typing]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.type === "bot" && tab === "policy") fetchPolicy();
  }, [messages, tab, fetchPolicy]);

  const handleFullReset = async () => {
    if (window.confirm("Start a new blank form? Your current data stays saved in history.")) {
      await resetPolicy();
      const newId = generateNewSessionId();
      setSessionId(newId);
      setUserMessages([]);
      setTab("chat");
      window.location.reload();
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || status !== "connected") return;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setUserMessages((prev) => [...prev, { type: "user", text, timestamp: now, id: Date.now() }]);
    send(text);
    setInput("");
    setTimeout(() => fetchPolicy(), 2000);
  };

  const handleQuickSend = (q) => {
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setUserMessages((p) => [...p, { type: "user", text: q, timestamp: now, id: Date.now() }]);
    send(q);
  };

  if (!chatOpen) return <FloatingChatButton onClick={() => setChatOpen(true)} isOpen={false} />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@500;600&family=DM+Sans:wght@400;500;600&display=swap');

        :root {
          --brand-navy: #0f3460;
          --brand-navy-mid: #1a4a7a;
          --brand-gold: #c9a227;
          --brand-gold-light: #f5e9c0;
        }

        * { box-sizing: border-box; }
        body { font-family: 'DM Sans', sans-serif; background: #f0f2f5; }

        .font-lora { font-family: 'Lora', serif; }

        @keyframes msgIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotBounce {
          0%,80%,100% { transform: scale(0.75); opacity: 0.3; }
          40%          { transform: scale(1.1);  opacity: 1; }
        }
        @keyframes fabPop {
          from { transform: scale(0.85); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .tuto-widget {
          animation: fabPop 0.25s ease-out;
        }
        .tuto-msg { animation: msgIn 0.3s ease-out; }
        .tuto-slide { animation: slideDown 0.18s ease-out; }
      `}</style>

      <FloatingChatButton onClick={() => setChatOpen(false)} isOpen />

      {/* Widget */}
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
        {/* ── Header ── */}
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
              <div className="font-lora" style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>
                Tell Us The Odds℠
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1.2px" }}>
                Valuation Services
              </div>
            </div>
          </div>
          <StatusDot status={status} />
        </div>

        {/* ── Tabs ── */}
        <Tabs value={tab} onValueChange={setTab} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
          <TabsList
            style={{
              borderRadius: 0,
              borderBottom: "1px solid #e2e8f0",
              background: "#fafbfc",
              height: 40,
              gap: 0,
              padding: 0,
              flexShrink: 0,
            }}
          >
            <TabsTrigger
              value="chat"
              style={{
                flex: 1, borderRadius: 0, height: "100%",
                fontSize: 12.5, fontFamily: "'DM Sans', sans-serif",
                borderBottom: tab === "chat" ? "2px solid var(--brand-navy)" : "2px solid transparent",
                color: tab === "chat" ? "var(--brand-navy)" : "#64748b",
                fontWeight: tab === "chat" ? 600 : 500,
              }}
            >
              💬 Chat
            </TabsTrigger>
            <TabsTrigger
              value="policy"
              style={{
                flex: 1, borderRadius: 0, height: "100%",
                fontSize: 12.5, fontFamily: "'DM Sans', sans-serif",
                borderBottom: tab === "policy" ? "2px solid var(--brand-navy)" : "2px solid transparent",
                color: tab === "policy" ? "var(--brand-navy)" : "#64748b",
                fontWeight: tab === "policy" ? 600 : 500,
              }}
            >
              📋 My Policy
            </TabsTrigger>
          </TabsList>

          {/* ── CHAT TAB ── */}
          <TabsContent value="chat" style={{ margin: 0, display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
            {/* Info bar */}
            <div style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe", padding: "5px 16px", fontSize: 11, color: "#1d4ed8", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              ℹ️ Educational guidance only — not financial or legal advice.
            </div>

            {/* Quick chips */}
            {allMessages.length === 0 && (
              <div style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 6, background: "#fafbfc", borderBottom: "1px solid #f0f2f5", flexShrink: 0 }}>
                {QUICK_QUESTIONS.map((q) => (
                  <Badge
                    key={q}
                    variant="outline"
                    onClick={() => handleQuickSend(q)}
                    style={{
                      cursor: "pointer", fontSize: 11, padding: "5px 11px",
                      border: "1px solid #c7d2fe", background: "#fff",
                      color: "#3730a3", borderRadius: 20,
                      fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
                      transition: "all 0.15s",
                    }}
                  >
                    {q}
                  </Badge>
                ))}
              </div>
            )}

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 14px", background: "#f8fafc", minHeight: 0 }}>
              {allMessages.length === 0 && (
                <div style={{ textAlign: "center", color: "#64748b", paddingTop: "30%" }}>
                  <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📝</div>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>How can we help with your policy analysis today?</p>
                </div>
              )}
              {allMessages.map((msg) => (
                <Message key={msg.id} msg={msg} isUser={msg.type === "user"} />
              ))}
              {typing && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "12px 14px", background: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
              <Textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="Type your message…"
                disabled={status !== "connected"}
                style={{
                  flex: 1, resize: "none", borderRadius: 10, fontSize: 13.5,
                  fontFamily: "'DM Sans', sans-serif", minHeight: 40, maxHeight: 100,
                  padding: "10px 13px", border: "1px solid #e2e8f0",
                  background: "#fafbfc", color: "#1e293b",
                  outline: "none", transition: "border-color 0.15s",
                }}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || status !== "connected"}
                style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: input.trim() && status === "connected" ? "var(--brand-navy)" : "#cbd5e0",
                  border: "none", color: "#fff", fontSize: 16, padding: 0,
                  transition: "background 0.15s",
                }}
              >
                ➤
              </Button>
            </div>
          </TabsContent>

          {/* ── POLICY TAB ── */}
          <TabsContent value="policy" style={{ margin: 0, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <PolicyTab
              sessionID={sessionId}
              policy={policy}
              versions={versions}
              loading={loading}
              fetchPolicy={fetchPolicy}
              fetchVersions={fetchVersions}
              resetPolicy={handleFullReset}
              onGoToChat={() => setTab("chat")}
            />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div style={{ padding: "7px", textAlign: "center", fontSize: 10, color: "#94a3b8", background: "#fafbfc", borderTop: "1px solid #f1f5f9", flexShrink: 0 }}>
          Sutter's Mill Valuation Services
        </div>
      </div>
    </>
  );
}