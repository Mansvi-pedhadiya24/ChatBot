(function (window, document) {
  "use strict";

  /* ── 0. Guard against double-init ─────────────────────────────── */
  if (window.__TutoWidgetLoaded) return;
  window.__TutoWidgetLoaded = true;

  /* ── 1. Config (merge user settings with defaults) ────────────── */
  var cfg = Object.assign(
    {
      wsUrl:    "ws://192.168.0.245:8001",
      apiUrl:   "http://192.168.0.245:8001",
      position: "right",
      theme:    "navy",
      label:    "Free to Ask",
    },
    window.TutoConfig || {}
  );

  /* ── 2. Theme palettes ─────────────────────────────────────────── */
  var THEMES = {
    navy: { primary: "#4886ff", gold: "#f4f1e6", goldText: "#0f3460", bg: "#0f3460" },
    dark: { primary: "#1e293b", gold: "#c9a227", goldText: "#f5e9c0", bg: "#0f172a" },
    gold: { primary: "#c9a227", gold: "#0f3460", goldText: "#fff",    bg: "#92400e" },
  };
  var T = THEMES[cfg.theme] || THEMES.navy;

  /* ── 3. Session ID (persisted in localStorage) ────────────────── */
  function getSessionId() {
    var k = "tuto_session_id";
    var id = localStorage.getItem(k);
    if (!id) {
      id = "user_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
      localStorage.setItem(k, id);
    }
    return id;
  }
  var SESSION_ID = getSessionId();

  /* ── 4. Inject CSS ────────────────────────────────────────────── */
  var style = document.createElement("style");
  style.textContent = [
    "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');",
    "#tuto-root * { box-sizing: border-box; font-family: 'DM Sans', 'Segoe UI', sans-serif; margin: 0; padding: 0; }",
    "#tuto-root { position: fixed; z-index: 2147483647; " + cfg.position + ": 24px; bottom: 24px; max-width: calc(100vw - 48px); }",

    /* FAB */
    "#tuto-fab { width: 58px; height: 58px; border-radius: 50%; background: " + T.primary + ";",
    "  border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;",
    "  box-shadow: 0 8px 24px rgba(0,0,0,0.3); transition: transform .2s, box-shadow .2s;",
    "  position: relative; }",
    "#tuto-fab:hover { transform: scale(1.09); box-shadow: 0 12px 32px rgba(0,0,0,0.4); }",
    "#tuto-fab svg { width: 26px; height: 26px; fill: #fff; transition: opacity .2s; }",
    "#tuto-fab-close { display: none; font-size: 22px; color: #fff; line-height: 1; }",

    /* Badge */
    "#tuto-badge { position: absolute; top: 2px; right: 2px; width: 17px; height: 17px;",
    "  background: #c9a227; border: 2px solid #fff; border-radius: 50%;",
    "  font-size: 8px; font-weight: 700; color: #7a4e00;",
    "  display: flex; align-items: center; justify-content: center; }",

    /* Tooltip */
    "#tuto-tooltip { position: absolute; bottom: 68px; " + cfg.position + ": 0;",
    "  background: #fff; border: 1px solid #e2e8f0; border-radius: 20px;",
    "  padding: 6px 14px; white-space: nowrap; font-size: 13px; color: #334155;",
    "  box-shadow: 0 4px 14px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 8px;",
    "  animation: tuto-pop .25s ease-out; }",
    "#tuto-tooltip-close { background: none; border: none; cursor: pointer; font-size: 11px;",
    "  color: #94a3b8; padding: 0; line-height: 1; }",

    /* Widget panel */
    "#tuto-panel { position: fixed; bottom: 90px; " + cfg.position + ": 24px;",
    "  width: 420px; max-width: calc(100vw - 48px); height: 580px; max-height: 85vh;",
    "  border-radius: 20px; overflow: hidden; display: none; flex-direction: column;",
    "  box-shadow: 0 24px 60px rgba(15,52,96,0.25), 0 4px 16px rgba(15,52,96,0.1);",
    "  border: 1px solid #e2e8f0; background: #fff; animation: tuto-pop .25s ease-out; }",
    "#tuto-panel.open { display: flex; }",

    /* Panel Header */
    "#tuto-header { background: " + T.primary + "; border-bottom: 2.5px solid " + T.gold + ";",
    "  padding: 13px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }",
    "#tuto-logo { width: 34px; height: 34px; border-radius: 8px; background: " + T.gold + ";",
    "  display: flex; align-items: center; justify-content: center;",
    "  font-size: 16px; font-weight: 700; color: " + T.primary + "; flex-shrink: 0; }",
    "#tuto-header-text { margin-left: 10px; flex: 1; }",
    "#tuto-title { color: #fff; font-weight: 600; font-size: 14px; }",
    "#tuto-subtitle { font-size: 9px; color: rgba(255,255,255,.5); text-transform: uppercase; letter-spacing: 1.2px; margin-top: 1px; }",
    "#tuto-status { display: flex; align-items: center; gap: 5px; background: rgba(255,255,255,.1);",
    "  border: 1px solid rgba(255,255,255,.15); border-radius: 20px; padding: 4px 10px; }",
    "#tuto-dot { width: 6px; height: 6px; border-radius: 50%; background: #ef4444; flex-shrink: 0; }",
    "#tuto-status-label { font-size: 9px; color: rgba(255,255,255,.8); font-weight: 500; text-transform: uppercase; letter-spacing: .5px; }",

    /* Info bar */
    "#tuto-infobar { background: #eff6ff; border-bottom: 1px solid #bfdbfe; padding: 5px 14px;",
    "  font-size: 11px; color: #1d4ed8; display: flex; align-items: center; gap: 5px; flex-shrink: 0; }",

    /* Quick chips */
    "#tuto-chips { padding: 8px 12px; display: flex; flex-wrap: wrap; gap: 6px;",
    "  background: #fafbfc; border-bottom: 1px solid #f0f2f5; flex-shrink: 0; }",
    ".tuto-chip { cursor: pointer; font-size: 11px; padding: 5px 11px;",
    "  border: 1px solid #c7d2fe; background: #fff; color: #3730a3;",
    "  border-radius: 20px; font-weight: 500; transition: background .15s; }",
    ".tuto-chip:hover { background: #eef2ff; }",

    /* ════════════════════════════════════════════════════════════════ */
    /* FIXED: Message bubbles - User message min-width issue resolved  */
    /* ════════════════════════════════════════════════════════════════ */

    /* Message wrapper */
    ".tuto-msg-wrap { display: flex; margin-bottom: 10px; animation: tuto-msgin .3s ease-out; width: 100%; overflow: hidden; }",

    /* User message wrapper - right aligned with proper padding */
    ".tuto-msg-wrap.user { justify-content: flex-end; padding-left: 40px; }",

    /* Bot message wrapper - left aligned */
    ".tuto-msg-wrap.bot  { justify-content: flex-start; padding-right: 40px; }",

    /* ═══ FIXED BUBBLE STYLES ═══ */
    /* Base bubble */
    ".tuto-bubble { max-width: 100%; word-break: break-word; overflow-wrap: break-word; padding: 10px 14px; font-size: 13px; line-height: 1.55; }",

    /* ═══ USER BUBBLE FIX ═══ */
    /* User bubble: proper min-width, fit-content width, inline-block display */
    ".tuto-bubble.user { ",
    "  background: " + T.primary + "; color: #fff;",
    "  border-radius: 16px 16px 4px 16px;",
    "  min-width: 60px;",                          /* FIXED: minimum width so short text doesn't shrink */
    "  width: fit-content;",                       /* FIXED: width fits content but respects min-width */
    "  display: inline-block;",                    /* FIXED: inline-block for proper width behavior */
    "  flex-shrink: 0;",                           /* FIXED: don't shrink in flex container */
    "  text-align: left;",                         /* FIXED: text stays left-aligned inside bubble */
    "  box-shadow: 0 1px 2px rgba(0,0,0,0.1);",     /* subtle shadow for depth */
    "}",

    /* Bot bubble */
    ".tuto-bubble.bot  { background: #fff; color: #1e293b;",
    "  border: 1px solid #e2e8f0; border-radius: 16px 16px 16px 4px;",
    "  width: 100%;",                              /* Bot takes full available width */
    "}",

    /* Timestamp */
    ".tuto-ts { font-size: 10px; margin-top: 4px; text-align: right; }",
    ".tuto-bubble.user .tuto-ts { color: rgba(255,255,255,.6); }",
    ".tuto-bubble.bot .tuto-ts  { color: #94a3b8; }",

    /* Empty state */
    ".tuto-empty { text-align: center; color: #64748b; padding-top: 30%; }",
    ".tuto-empty .tuto-icon { font-size: 40px; margin-bottom: 10px; opacity: .4; }",
    ".tuto-empty p { font-size: 13px; font-weight: 500; }",

    /* Typing dots */
    "#tuto-typing { display: none; justify-content: flex-start; margin-bottom: 10px; }",
    "#tuto-typing.show { display: flex; }",
    ".tuto-typing-bubble { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px 14px 14px 3px;",
    "  padding: 12px 16px; display: inline-flex; gap: 5px; align-items: center; }",
    ".tuto-dot-anim { width: 6px; height: 6px; border-radius: 50%; background: #94a3b8;",
    "  animation: tuto-bounce 1.1s infinite; }",

    /* Input area */
    "#tuto-input-area { padding: 10px 12px; background: #fff; border-top: 1px solid #e2e8f0;",
    "  display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0; }",
    "#tuto-textarea { flex: 1; resize: none; border-radius: 10px; font-size: 13px;",
    "  min-height: 40px; max-height: 96px; padding: 10px 13px;",
    "  border: 1px solid #e2e8f0; background: #fafbfc; color: #1e293b;",
    "  outline: none; transition: border-color .15s; font-family: inherit; }",
    "#tuto-textarea:focus { border-color: " + T.primary + "; }",
    "#tuto-send { width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;",
    "  background: " + T.primary + "; border: none; color: #fff; font-size: 16px;",
    "  cursor: pointer; transition: background .15s, transform .1s; }",
    "#tuto-send:disabled { background: #cbd5e0; cursor: not-allowed; }",
    "#tuto-send:not(:disabled):hover { transform: scale(1.05); }",

    /* Disconnect banner */
    "#tuto-disconnected { display: none; padding: 6px 12px; background: #fef2f2;",
    "  border-top: 1px solid #fecaca; font-size: 11px; color: #b91c1c;",
    "  text-align: center; flex-shrink: 0; }",
    "#tuto-disconnected.show { display: block; }",

    /* Footer */
    "#tuto-footer { padding: 6px; text-align: center; font-size: 10px; color: #94a3b8;",
    "  background: #fafbfc; border-top: 1px solid #f1f5f9; flex-shrink: 0; }",
    "#tuto-footer a { color: #94a3b8; text-decoration: none; }",
    "#tuto-footer a:hover { color: " + T.primary + "; }",

    /* Animations */
    "@keyframes tuto-pop { from { opacity:0; transform:scale(.88); } to { opacity:1; transform:scale(1); } }",
    "@keyframes tuto-msgin { from { opacity:0; transform:translateY(7px); } to { opacity:1; transform:translateY(0); } }",
    "@keyframes tuto-bounce { 0%,80%,100% { transform:scale(.75); opacity:.3; } 40% { transform:scale(1.1); opacity:1; } }",

    /* Mobile responsive */
    "@media (max-width: 480px) {",
    "  #tuto-panel { width: calc(100vw - 20px); " + cfg.position + ": 10px; height: 78vh; }",
    "  .tuto-msg-wrap.user { padding-left: 20px; }",
    "  .tuto-msg-wrap.bot  { padding-right: 20px; }",
    "  .tuto-bubble { max-width: 100%; }",
    "}",
  ].join("\n");
  document.head.appendChild(style);

  /* ── 5. Build DOM ──────────────────────────────────────────────── */
  var QUICK = [
    "Start my intake form",
    "What is my claim probability?",
    "What does elimination period mean?",
    "How does inflation protection work?",
  ];

  var root = document.createElement("div");
  root.id = "tuto-root";
  root.innerHTML = [
    /* Tooltip */
    '<div id="tuto-tooltip">',
    '  <span>' + cfg.label + '</span>',
    '  <button id="tuto-tooltip-close" title="Dismiss">✕</button>',
    '</div>',

    /* FAB */
    '<button id="tuto-fab" aria-label="Open chat">',
    '  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">',
    '    <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>',
    '  </svg>',
    '  <span id="tuto-fab-close">✕</span>',
    '  <span id="tuto-badge">1</span>',
    '</button>',

    /* Panel */
    '<div id="tuto-panel" role="dialog" aria-label="Chat">',

    /* Header */
    '  <div id="tuto-header">',
    '    <div id="tuto-logo">T</div>',
    '    <div id="tuto-header-text">',
    '      <div id="tuto-title">Tell Us The Odds℠</div>',
    '      <div id="tuto-subtitle">Valuation Services</div>',
    '    </div>',
    '    <div id="tuto-status">',
    '      <span id="tuto-dot"></span>',
    '      <span id="tuto-status-label">Connecting</span>',
    '    </div>',
    '  </div>',

    /* Info bar */
    '  <div id="tuto-infobar">ℹ️ Educational guidance only — not financial or legal advice.</div>',

    /* Chips */
    '  <div id="tuto-chips">',
    QUICK.map(function(q) {
      return '<button class="tuto-chip" data-q="' + q.replace(/"/g, "&quot;") + '">' + q + '</button>';
    }).join(""),
    '  </div>',

    /* Messages */
    '  <div id="tuto-messages">',
    '    <div class="tuto-empty" id="tuto-empty">',
    '      <div class="tuto-icon">📝</div>',
    '      <p>How can we help with your<br>policy analysis today?</p>',
    '    </div>',
    '    <div id="tuto-typing">',
    '      <div class="tuto-typing-bubble">',
    '        <span class="tuto-dot-anim" style="animation-delay:0s"></span>',
    '        <span class="tuto-dot-anim" style="animation-delay:.18s"></span>',
    '        <span class="tuto-dot-anim" style="animation-delay:.36s"></span>',
    '      </div>',
    '    </div>',
    '  </div>',

    /* Input */
    '  <div id="tuto-input-area">',
    '    <textarea id="tuto-textarea" rows="1" placeholder="Type your message…" disabled></textarea>',
    '    <button id="tuto-send" disabled>➤</button>',
    '  </div>',

    /* Disconnect */
    '  <div id="tuto-disconnected">⚠️ Disconnected — reconnecting…</div>',

    /* Footer */
    '  <div id="tuto-footer">',
    '    Sutter\'s Mill Valuation Services &nbsp;|&nbsp;',
    '    <a href="https://tellustheodds.com" target="_blank" rel="noopener">tellustheodds.com</a>',
    '  </div>',

    '</div>', /* end panel */
  ].join("");

  document.body.appendChild(root);

  /* ── 6. Element refs ───────────────────────────────────────────── */
  var $fab       = document.getElementById("tuto-fab");
  var $fabClose  = document.getElementById("tuto-fab-close");
  var $fabSvg    = $fab.querySelector("svg");
  var $badge     = document.getElementById("tuto-badge");
  var $tooltip   = document.getElementById("tuto-tooltip");
  var $ttClose   = document.getElementById("tuto-tooltip-close");
  var $panel     = document.getElementById("tuto-panel");
  var $msgs      = document.getElementById("tuto-messages");
  var $empty     = document.getElementById("tuto-empty");
  var $typing    = document.getElementById("tuto-typing");
  var $chips     = document.getElementById("tuto-chips");
  var $dot       = document.getElementById("tuto-dot");
  var $statusLbl = document.getElementById("tuto-status-label");
  var $textarea  = document.getElementById("tuto-textarea");
  var $send      = document.getElementById("tuto-send");
  var $discon    = document.getElementById("tuto-disconnected");

  var isOpen      = false;
  var msgCount    = 0;

  /* ── 7. Open / close ───────────────────────────────────────────── */
  function openPanel() {
    isOpen = true;
    $panel.classList.add("open");
    $fabSvg.style.display  = "none";
    $fabClose.style.display = "block";
    $badge.style.display   = "none";
    $tooltip.style.display = "none";
    $textarea.focus();
    scrollBottom();
  }
  function closePanel() {
    isOpen = false;
    $panel.classList.remove("open");
    $fabSvg.style.display  = "block";
    $fabClose.style.display = "none";
  }

  $fab.addEventListener("click", function() {
    isOpen ? closePanel() : openPanel();
  });
  $ttClose.addEventListener("click", function(e) {
    e.stopPropagation();
    $tooltip.style.display = "none";
  });

  /* ── 8. Scroll helper ──────────────────────────────────────────── */
  function scrollBottom() {
    setTimeout(function() { $msgs.scrollTop = $msgs.scrollHeight; }, 50);
  }

  /* ── 9. Render a message bubble ────────────────────────────────── */
  function addMessage(text, type, ts) {
    msgCount++;
    if (msgCount === 1) {
      $empty.style.display = "none";
      $chips.style.display = "none";
    }
    var wrap = document.createElement("div");
    wrap.className = "tuto-msg-wrap " + type;
    var bubble = document.createElement("div");
    bubble.className = "tuto-bubble " + type;
    // Simple markdown: bold **x** and newlines
    var html = text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
    bubble.innerHTML = html + '<div class="tuto-ts">' + (ts || now()) + '</div>';
    wrap.appendChild(bubble);
    $msgs.insertBefore(wrap, $typing);
    scrollBottom();
  }

  function now() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  /* ── 10. Status indicator ──────────────────────────────────────── */
  var STATUS_COLORS = { connected: "#22c55e", connecting: "#eab308", disconnected: "#ef4444", error: "#ef4444" };
  function setStatus(s) {
    $dot.style.background = STATUS_COLORS[s] || "#ef4444";
    $statusLbl.textContent = s.charAt(0).toUpperCase() + s.slice(1);
    var conn = s === "connected";
    $textarea.disabled = !conn;
    $send.disabled = !conn || !$textarea.value.trim();
    if (s === "disconnected" || s === "error") {
      $discon.classList.add("show");
    } else {
      $discon.classList.remove("show");
    }
  }

  /* ── 11. WebSocket ─────────────────────────────────────────────── */
  var ws, reconnectTimer;

  function connect() {
    setStatus("connecting");
    var url = cfg.wsUrl + "/ws/chat?session_id=" + SESSION_ID;
    ws = new WebSocket(url);

    ws.onopen = function() { setStatus("connected"); };

    ws.onmessage = function(e) {
      var data;
      try { data = JSON.parse(e.data); } catch(ex) { return; }

      if (data.type === "history") {
        (data.messages || []).forEach(function(m) {
          var t = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "";
          addMessage(m.content || m.text || "", m.sender === "user" ? "user" : "bot", t);
        });
        return;
      }
      if (data.type === "bot") {
        $typing.classList.remove("show");
        addMessage(data.text || "", "bot", data.timestamp || "");
      }
    };

    ws.onerror = function() { setStatus("error"); };
    ws.onclose = function() {
      setStatus("disconnected");
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 3000);
    };
  }

  /* ── 12. Firebase typing listener (optional, graceful fallback) ── */
  // If Firebase SDK isn't on the page, typing indicator still works
  // via a simple timeout after user sends.
  var typingTimeout;
  function showTyping() {
    $typing.classList.add("show");
    scrollBottom();
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(function() {
      $typing.classList.remove("show");
    }, 15000); // safety fallback
  }

  /* ── 13. Send message ──────────────────────────────────────────── */
  function sendMessage(text) {
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    addMessage(text, "user", now());
    showTyping();
    ws.send(JSON.stringify({
      text:       text,
      session_id: SESSION_ID,
      timestamp:  now(),
    }));
    // When bot responds, typing is hidden in ws.onmessage
  }

  /* ── 14. Input listeners ───────────────────────────────────────── */
  $textarea.addEventListener("input", function() {
    $send.disabled = !this.value.trim() || !ws || ws.readyState !== WebSocket.OPEN;
    // Auto-grow
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 96) + "px";
  });

  $textarea.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      var text = $textarea.value.trim();
      if (text) { $textarea.value = ""; $textarea.style.height = "auto"; $send.disabled = true; sendMessage(text); }
    }
  });

  $send.addEventListener("click", function() {
    var text = $textarea.value.trim();
    if (text) { $textarea.value = ""; $textarea.style.height = "auto"; $send.disabled = true; sendMessage(text); }
  });

  /* ── 15. Quick chips ───────────────────────────────────────────── */
  $chips.addEventListener("click", function(e) {
    var chip = e.target.closest(".tuto-chip");
    if (chip) sendMessage(chip.dataset.q);
  });

  /* ── 16. Keyboard accessibility ────────────────────────────────── */
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && isOpen) closePanel();
  });

  /* ── 17. Boot ──────────────────────────────────────────────────── */
  connect();

  /* ── 18. Public API (window.TutoWidget) ────────────────────────── */
  window.TutoWidget = {
    open:  openPanel,
    close: closePanel,
    send:  sendMessage,
  };

})(window, document);