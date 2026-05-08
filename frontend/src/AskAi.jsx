import { useState, useEffect, useRef } from "react";
import { useWebSocket } from "./hooks/useWebSockets";
import { useTyping } from "./hooks/useTyping";
import { usePolicyData } from "./hooks/usePolicyData";
import { StatusDot } from "./components/StatusDot";
import { Message } from "./components/Message";
import { TypingIndicator } from "./components/TypingIndicator";
import { FloatingChatButton } from "./components/FloatingChatButton";
import { PolicyTab } from "./components/PolicyTab";
import { generateNewSessionId } from "./utils/session";

export default function App() {
  const [sessionId, setSessionId] = useState("");
  const wsUrl = `ws://192.168.0.245:8000/ws/chat?session_id=${sessionId}`;
  const { status, messages, send } = useWebSocket(wsUrl, sessionId);
  const typing = useTyping(sessionId);
  const { policy, versions, loading, fetchPolicy, fetchVersions, resetPolicy } = usePolicyData(sessionId);

  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState("");
  const [userMessages, setUserMessages] = useState([]);
  const [tab, setTab] = useState("chat");
  const bottomRef = useRef(null);

  const allMessages = [...messages, ...userMessages].sort((a, b) => a.id - b.id);

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

  const handleSend = () => {
    const text = input.trim();
    if (!text || status !== "connected") return;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setUserMessages(prev => [...prev, { type: "user", text, timestamp: now, id: Date.now() }]);
    send(text);
    setInput("");
    setTimeout(() => fetchPolicy(), 2000);
  };

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.type === "bot" && tab === "policy") {
      fetchPolicy();
    }
  }, [messages, tab, fetchPolicy]);

  const quickQuestions = [
    "Start my intake form",
    "What is my claim probability?",
    "Which option has the best value?",
    "What does elimination period mean?",
    "How does inflation protection work?",
    "Show all my details",
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@500;600&family=Source+Sans+3:wght@400;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f1f5f9; font-family: 'Source Sans 3', sans-serif; }
        @keyframes msgIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dotB { 0%,80%,100% { opacity:.2; transform:scale(.8); } 40% { opacity:1; transform:scale(1.1); } }
        @keyframes slideDown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .scroll-hide::-webkit-scrollbar { width: 5px; }
        .scroll-hide::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 10px; }
        .tab-btn { flex:1; padding:9px 0; font-size:12.5px; font-family:'Source Sans 3',sans-serif; border:none; background:transparent; cursor:pointer; color:#64748b; font-weight:500; border-bottom:2px solid transparent; transition:all .15s; }
        .tab-btn.active { color:#1a4a7a; border-bottom-color:#1a4a7a; background:#fff; }
        .tab-btn:hover:not(.active) { color:#334155; background:#f8fafc; }
      `}</style>

      <FloatingChatButton onClick={() => setChatOpen(prev => !prev)} isOpen={chatOpen} />

      {chatOpen && (
        <div style={{
          position: "fixed", bottom: 90, right: 24,
          width: 420, height: "85vh",
          zIndex: 9997,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)",
          animation: "fabPop 0.25s ease-out",
        }}>
          <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ width: "100%", maxWidth: 420, height: "85vh", display: "flex", flexDirection: "column", borderRadius: 12, overflow: "hidden", background: "#ffffff", boxShadow: "0 25px 50px -12px rgba(0,0,0,.15)", border: "1px solid #e2e8f0" }}>

              <div style={{ padding: "16px 20px", background: "linear-gradient(135deg, #0f3460 0%, #1a4a7a 100%)", borderBottom: "3px solid #d4af37", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 4, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📈</div>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 600, fontSize: "15px", fontFamily: "Lora, serif", letterSpacing: "0.2px" }}>Tell Us The Odds℠</div>
                    <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px" }}>Valuation Services</div>
                  </div>
                </div>
                <StatusDot status={status} />
              </div>

              <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", flexShrink: 0, background: "#f8fafc" }}>
                <button className={`tab-btn ${tab === "chat" ? "active" : ""}`} onClick={() => setTab("chat")}>💬 Chat</button>
                <button className={`tab-btn ${tab === "policy" ? "active" : ""}`} onClick={() => setTab("policy")}>📋 My Policy</button>
              </div>

              {tab === "chat" && (
                <>
                  <div style={{ background: "#f0f9ff", borderBottom: "1px solid #e0f2fe", padding: "5px 16px", fontSize: "10.5px", color: "#0369a1", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                    ℹ️ Educational guidance only — not financial or legal advice.
                  </div>
                  
                  {allMessages.length === 0 && (
                    <div style={{ padding: "10px 16px 0", display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0, background: "#f8fafc" }}>
                      {quickQuestions.map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                            setUserMessages(p => [...p, { type: "user", text: q, timestamp: now, id: Date.now() }]);
                            send(q);
                          }}
                          style={{
                            fontSize: 11,
                            padding: "5px 10px",
                            border: "1px solid #bfdbfe",
                            borderRadius: 20,
                            background: "#fff",
                            color: "#1d4ed8",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <div className="scroll-hide" style={{ flex: 1, overflowY: "auto", padding: "24px 16px", color: "#334155", background: "#f8fafc" }}>
                    {allMessages.length === 0 && (
                      <div style={{ textAlign: "center", color: "#64748b", marginTop: "30%" }}>
                        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>📝</div>
                        <p style={{ fontSize: 14, fontWeight: 500 }}>How can we help with your policy analysis today?</p>
                      </div>
                    )}
                    {allMessages.map((msg) => <Message key={msg.id} msg={msg} isUser={msg.type === "user"} />)}
                    {typing && <TypingIndicator />}
                    <div ref={bottomRef} />
                  </div>
                  
                  <div style={{ padding: "16px", background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", gap: 10, alignItems: "center" }}>
                    <textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                      placeholder="Type your message..." disabled={status !== "connected"}
                      style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1px solid #cbd5e0", background: "#fdfdfd", fontSize: "14px", resize: "none", outline: "none", fontFamily: "inherit", color: "#1a202c" }}
                    />
                    <button onClick={handleSend} disabled={!input.trim() || status !== "connected"}
                      style={{ width: 44, height: 44, borderRadius: 8, border: "none", background: input.trim() && status === "connected" ? "#1a4a7a" : "#cbd5e0", color: "#fff", cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      ➤
                    </button>
                  </div>
                </>
              )}

              {tab === "policy" && (
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
              )}

              <div style={{ padding: "8px", textAlign: "center", fontSize: "10px", color: "#94a3b8", background: "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
                Sutter's Mill Valuation Services
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
