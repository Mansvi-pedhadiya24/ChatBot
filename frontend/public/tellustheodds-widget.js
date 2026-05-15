(function () {
  if (window.__TutoWidgetLoaded) return;
  window.__TutoWidgetLoaded = true;

  /* ── Config ── */
  var WS_BASE     = 'ws://192.168.0.245:8001/ws/chat';
  var STORAGE_KEY = 'tuto_session_id';

  /* ── State ── */
  var ws = null;
  var sessionId = '';
  var reconnectTimer = null;
  var isConnecting = false;
  var chatIsOpen = false;
  var localIdCounter = 0;
  var hasMessages = false;

  /* ── Inject Google Fonts ── */
  var fontLink = document.createElement('link');
  fontLink.rel  = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Open+Sans:wght@400;500;600&display=swap';
  document.head.appendChild(fontLink);

  /* ── Inject CSS ── */
  var style = document.createElement('style');
  style.textContent = `
    #tuto-fab-tooltip {
      position:fixed;bottom:34px;right:90px;z-index:2147483645;
      background:#fff;border:1px solid #e2e8f0;border-radius:20px;
      padding:6px 14px;display:flex;align-items:center;gap:8px;
      box-shadow:0 2px 10px rgba(0,0,0,0.1);
      animation:tutoFabPop 0.3s ease-out;
      font-family:'Open Sans',sans-serif;
    }
    #tuto-fab-tooltip span{font-size:13px;color:#334155;white-space:nowrap;}
    #tuto-fab-tooltip button{background:none;border:none;cursor:pointer;font-size:11px;color:#94a3b8;padding:0;line-height:1;}

    #tuto-fab {
      position:fixed;bottom:24px;right:24px;
      width:56px;height:56px;border-radius:50%;
      background:#4886ff;border:none;
      box-shadow:0 6px 20px rgba(15,52,96,0.4);
      z-index:2147483646;
      display:flex;align-items:center;justify-content:center;
      font-size:22px;color:#fff;cursor:pointer;
      transition:transform 0.2s;
    }
    #tuto-fab:hover{transform:scale(1.08);}
    #tuto-fab-badge {
      position:absolute;top:2px;right:2px;
      width:16px;height:16px;background:#c9a227;
      border:2px solid #fff;border-radius:50%;
      font-size:8px;font-weight:700;color:#7a4e00;
      display:flex;align-items:center;justify-content:center;
      font-family:'Open Sans',sans-serif;
    }

    #tuto-chat-widget {
      position:fixed;bottom:90px;right:24px;
      width:420px;height:85vh;max-height:680px;
      z-index:2147483644;
      display:none;flex-direction:column;
      border-radius:20px;overflow:hidden;
      box-shadow:0 24px 60px rgba(15,52,96,0.22),0 4px 16px rgba(15,52,96,0.1);
      border:1px solid #e2e8f0;background:#fff;
      font-family:'Open Sans',sans-serif;
      animation:tutoFabPop 0.25s ease-out;
    }
    #tuto-chat-widget.tuto-open{display:flex;}

    #tuto-header {
      background:#4886ff;
      // border-bottom:2.5px solid #c9a227;
      padding:13px 18px;
      display:flex;align-items:center;justify-content:space-between;
      flex-shrink:0;
    }
    #tuto-header-left{display:flex;align-items:center;gap:11px;}
    #tuto-logo {
      width:36px;height:36px;border-radius:8px;
      background:#f4f1e6;
      display:flex;align-items:center;justify-content:center;
      font-size:17px;color:#4886ff;font-weight:700;
    }
    #tuto-title{color:#fff;font-weight:600;font-size:15px;}
    #tuto-subtitle{font-size:9px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1.2px;}

    #tuto-status {
      background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
      border-radius:20px;padding:4px 10px;
      display:flex;align-items:center;gap:5px;
    }
    #tuto-status-dot{width:6px;height:6px;border-radius:50%;background:#eab308;display:inline-block;flex-shrink:0;}
    #tuto-status-label{font-size:10px;color:rgba(255,255,255,0.8);font-weight:500;text-transform:uppercase;letter-spacing:0.5px;}

    #tuto-infobar {
      background:#eff6ff;border-bottom:1px solid #bfdbfe;
      padding:5px 16px;font-size:11px;color:#1d4ed8;
      display:flex;align-items:center;gap:5px;flex-shrink:0;
    }

    #tuto-chips {
      padding:10px 14px;display:flex;flex-wrap:wrap;gap:6px;
      background:#fafbfc;border-bottom:1px solid #f0f2f5;flex-shrink:0;
    }
    .tuto-chip {
      cursor:pointer;font-size:11px;padding:5px 11px;
      border:1px solid #c7d2fe;background:#fff;color:#3730a3;
      border-radius:20px;font-weight:500;font-family:'Open Sans',sans-serif;
      transition:background 0.15s;
    }
    .tuto-chip:hover{background:#eef2ff;}

    #tuto-messages {
      flex:1;overflow-y:auto;padding:18px 14px;
      background:#f8fafc;min-height:0;
    }
    #tuto-empty {
      text-align:center;color:#64748b;padding-top:30%;
    }
    #tuto-empty .tuto-empty-icon{font-size:40px;margin-bottom:12px;opacity:0.4;}
    #tuto-empty p{font-size:14px;font-weight:500;}

    .tuto-row{display:flex;margin-bottom:10px;}
    .tuto-row.user{justify-content:flex-end;}
    .tuto-row.bot{justify-content:flex-start;}

    .tuto-bubble {
      max-width:80%;padding:10px 13px;
      font-size:13.5px;line-height:1.55;
    }
    .tuto-bubble.user {
      border-radius:16px 16px 4px 16px;
      background:#4886ff;color:#fff;border:none;white-space:pre-wrap;
    }
    .tuto-bubble.bot {
      border-radius:16px 16px 16px 4px;
      background:#fff;color:#1e293b;border:1px solid #e2e8f0;
    }
    .tuto-bubble .tuto-ts{font-size:10px;margin-top:4px;text-align:right;}
    .tuto-bubble.user .tuto-ts{color:rgba(255,255,255,0.5);}
    .tuto-bubble.bot  .tuto-ts{color:#94a3b8;}
    .tuto-bubble.bot strong{font-weight:600;color:#0f3460;}
    .tuto-bubble.bot em{color:#64748b;font-style:italic;}
    .tuto-bubble.bot ul,.tuto-bubble.bot ol{margin:4px 0;padding-left:18px;}
    .tuto-bubble.bot li{margin-bottom:3px;}
    .tuto-bubble.bot p{margin:0 0 6px 0;}
    .tuto-bubble.bot p:last-child{margin-bottom:0;}

    #tuto-typing{display:none;justify-content:flex-start;margin-bottom:12px;}
    .tuto-typing-card {
      padding:12px 16px;border-radius:14px 14px 14px 3px;
      background:#fff;border:1px solid #e2e8f0;
      display:inline-flex;gap:5px;align-items:center;
    }
    .tuto-dot {
      width:6px;height:6px;border-radius:50%;background:#94a3b8;
      display:inline-block;animation:tutoDotBounce 1.1s infinite;
    }

    #tuto-input-area {
      padding:12px 14px;background:#fff;border-top:1px solid #e2e8f0;
      display:flex;gap:8px;align-items:flex-end;flex-shrink:0;
    }
    #tuto-input {
      flex:1;resize:none;border-radius:10px;
      font-size:13.5px;font-family:'Open Sans',sans-serif;
      min-height:40px;max-height:100px;padding:10px 13px;
      border:1px solid #e2e8f0;background:#fafbfc;
      color:#1e293b;outline:none;overflow-y:auto;
      box-sizing:border-box;width:100%;
    }
    #tuto-input:disabled{opacity:0.5;cursor:not-allowed;}
    #tuto-send {
      width:40px;height:40px;border-radius:10px;flex-shrink:0;
      background:#4886ff;border:none;color:#fff;font-size:16px;
      cursor:pointer;transition:background 0.15s;
    }
    #tuto-send:disabled{background:#cbd5e0;cursor:not-allowed;}

    #tuto-footer {
      padding:7px;text-align:center;font-size:10px;color:#94a3b8;
      background:#fafbfc;border-top:1px solid #f1f5f9;flex-shrink:0;
    }
    #tuto-disconnect {
      display:none;padding:7px 14px;background:#fef2f2;
      border-top:1px solid #fecaca;font-size:11px;color:#b91c1c;
      text-align:center;flex-shrink:0;
    }

    @keyframes tutoFabPop {
      from{transform:scale(0.85);opacity:0;}
      to{transform:scale(1);opacity:1;}
    }
    @keyframes tutoMsgIn {
      from{opacity:0;transform:translateY(8px);}
      to{opacity:1;transform:translateY(0);}
    }
    @keyframes tutoDotBounce {
      0%,80%,100%{transform:scale(0.75);opacity:0.3;}
      40%{transform:scale(1.1);opacity:1;}
    }
    .tuto-msg-anim{animation:tutoMsgIn 0.3s ease-out;}
  `;
  document.head.appendChild(style);

  /* ── Build DOM ── */
  var tooltip = document.createElement('div');
  tooltip.id  = 'tuto-fab-tooltip';
  tooltip.innerHTML = '<span>Free to Ask</span><button onclick="document.getElementById(\'tuto-fab-tooltip\').remove()" aria-label="Dismiss">✕</button>';
  document.body.appendChild(tooltip);

  var fab = document.createElement('button');
  fab.id          = 'tuto-fab';
  fab.innerHTML   = '💬<div id="tuto-fab-badge">1</div>';
  fab.setAttribute('aria-label','Open chat');
  fab.onclick     = toggleChat;
  document.body.appendChild(fab);

  var widget = document.createElement('div');
  widget.id        = 'tuto-chat-widget';
  widget.setAttribute('role','dialog');
  widget.setAttribute('aria-label','Tell Us The Odds chat');
  widget.innerHTML = `
    <div id="tuto-header">
      <div id="tuto-header-left">
        <div id="tuto-logo">T</div>
        <div>
          <div id="tuto-title">Tell Us The Odds℠</div>
          <div id="tuto-subtitle">Valuation Services</div>
        </div>
      </div>
      <div id="tuto-status">
        <span id="tuto-status-dot"></span>
        <span id="tuto-status-label">Connecting</span>
      </div>
    </div>

    <div id="tuto-infobar">ℹ️ Educational guidance only — not financial or legal advice.</div>

    <div id="tuto-chips">
      <span class="tuto-chip">Start my intake form</span>
      <span class="tuto-chip">What is my claim probability?</span>
      <span class="tuto-chip">Which option has the best value?</span>
      <span class="tuto-chip">What does elimination period mean?</span>
      <span class="tuto-chip">How does inflation protection work?</span>
      <span class="tuto-chip">Show all my details</span>
    </div>

    <div id="tuto-messages">
      <div id="tuto-empty">
        <div class="tuto-empty-icon">📝</div>
        <p>How can we help with your policy analysis today?</p>
      </div>
      <div id="tuto-typing">
        <div class="tuto-typing-card">
          <span class="tuto-dot" style="animation-delay:0s"></span>
          <span class="tuto-dot" style="animation-delay:0.18s"></span>
          <span class="tuto-dot" style="animation-delay:0.36s"></span>
        </div>
      </div>
    </div>

    <div id="tuto-input-area">
      <textarea id="tuto-input" rows="1" placeholder="Type your message…"></textarea>
      <button id="tuto-send" disabled aria-label="Send">➤</button>
    </div>

    <div id="tuto-disconnect">⚠️ Disconnected — reconnecting automatically…</div>
    <div id="tuto-footer">Sutter's Mill Valuation Services</div>
  `;
  document.body.appendChild(widget);

  /* ── Chip click handlers ── */
  widget.querySelectorAll('.tuto-chip').forEach(function(chip) {
    chip.onclick = function() { sendQuick(chip.textContent); };
  });

  /* ── Input handlers ── */
  var inputEl = document.getElementById('tuto-input');
  var sendEl  = document.getElementById('tuto-send');

  inputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    updateSendBtn();
  });
  inputEl.addEventListener('input', function() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
    updateSendBtn();
  });
  sendEl.onclick = handleSend;

  /* ── Session ── */
  function getOrCreateSession() {
    var id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  }

  /* ── Toggle ── */
  function toggleChat() {
    chatIsOpen = !chatIsOpen;
    var fabEl   = document.getElementById('tuto-fab');
    var badgeEl = document.getElementById('tuto-fab-badge');
    if (chatIsOpen) {
      widget.classList.add('tuto-open');
      fabEl.textContent = '✕';
      if (badgeEl) badgeEl.remove();
      if (!ws || ws.readyState !== WebSocket.OPEN) connect();
      scrollBottom();
    } else {
      widget.classList.remove('tuto-open');
      fabEl.textContent = '💬';
    }
  }

  /* ── WebSocket ── */
  function connect() {
    if (isConnecting) return;
    if (ws && ws.readyState === WebSocket.OPEN) return;
    isConnecting = true;
    setStatus('connecting');

    ws = new WebSocket(WS_BASE + '?session_id=' + encodeURIComponent(sessionId));

    ws.onopen = function() {
      isConnecting = false;
      setStatus('connected');
    };

    ws.onmessage = function(e) {
      var data;
      try { data = JSON.parse(e.data); } catch(err) { return; }

      if (data.type === 'history') {
        var msgs = data.messages || [];
        msgs.forEach(function(m, i) {
          var ts = m.created_at
            ? new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
            : '';
          appendMessage(m.sender === 'user' ? 'user' : 'bot', m.content || m.text || '', ts);
        });
        if (msgs.length) hideEmpty();
        scrollBottom();
        return;
      }

      if (data.type === 'bot') {
        hideTyping();
        appendMessage('bot', data.text || '', data.timestamp || '');
        scrollBottom();
      }
    };

    ws.onerror = function() {
      isConnecting = false;
      setStatus('error');
    };

    ws.onclose = function() {
      isConnecting = false;
      setStatus('disconnected');
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 3000);
    };
  }

  /* ── Status ── */
  var STATUS_CFG = {
    connected:    { color: '#22c55e', label: 'Connected' },
    connecting:   { color: '#eab308', label: 'Connecting' },
    disconnected: { color: '#ef4444', label: 'Disconnected' },
    error:        { color: '#ef4444', label: 'Error' },
  };

  function setStatus(s) {
    var dot     = document.getElementById('tuto-status-dot');
    var label   = document.getElementById('tuto-status-label');
    var banner  = document.getElementById('tuto-disconnect');
    var footer  = document.getElementById('tuto-footer');
    var cfg     = STATUS_CFG[s] || STATUS_CFG.disconnected;
    dot.style.background = cfg.color;
    label.textContent    = cfg.label;
    if (s === 'disconnected' || s === 'error') {
      banner.style.display = 'block';
      footer.style.display = 'none';
      inputEl.disabled = true;
      sendEl.disabled  = true;
    } else {
      banner.style.display = 'none';
      footer.style.display = 'block';
      inputEl.disabled = (s !== 'connected');
      updateSendBtn();
    }
  }

  /* ── Send ── */
  function handleSend() {
    var text = inputEl.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    var now = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    appendMessage('user', text, now);
    hideEmpty();
    ws.send(JSON.stringify({ text: text, session_id: sessionId, timestamp: now }));
    showTyping();
    inputEl.value = '';
    inputEl.style.height = 'auto';
    updateSendBtn();
    scrollBottom();
  }

  function sendQuick(text) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    var now = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    appendMessage('user', text, now);
    hideEmpty();
    document.getElementById('tuto-chips').style.display = 'none';
    ws.send(JSON.stringify({ text: text, session_id: sessionId, timestamp: now }));
    showTyping();
    scrollBottom();
  }

  function updateSendBtn() {
    sendEl.disabled = !inputEl.value.trim() || !ws || ws.readyState !== WebSocket.OPEN;
  }

  /* ── Messages ── */
  function appendMessage(type, text, timestamp) {
    var container = document.getElementById('tuto-messages');
    var typing    = document.getElementById('tuto-typing');

    var row = document.createElement('div');
    row.className = 'tuto-row tuto-msg-anim ' + type;

    var bubble = document.createElement('div');
    bubble.className = 'tuto-bubble ' + type;

    if (type === 'user') {
      bubble.textContent = text;
    } else {
      bubble.innerHTML = simpleMarkdown(text);
    }

    var ts = document.createElement('div');
    ts.className = 'tuto-ts';
    ts.textContent = timestamp;
    bubble.appendChild(ts);
    row.appendChild(bubble);
    container.insertBefore(row, typing);
  }

  function simpleMarkdown(text) {
    text = text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/_(.+?)_/g,'<em>$1</em>');

    var lines = text.split('\n');
    var html = '', inUl = false, inOl = false;
    lines.forEach(function(line) {
      var ul = line.match(/^[\-\*•]\s+(.*)/);
      var ol = line.match(/^\d+\.\s+(.*)/);
      if (ul) {
        if (!inUl) { if (inOl) { html += '</ol>'; inOl = false; } html += '<ul>'; inUl = true; }
        html += '<li>' + ul[1] + '</li>';
      } else if (ol) {
        if (!inOl) { if (inUl) { html += '</ul>'; inUl = false; } html += '<ol>'; inOl = true; }
        html += '<li>' + ol[1] + '</li>';
      } else {
        if (inUl) { html += '</ul>'; inUl = false; }
        if (inOl) { html += '</ol>'; inOl = false; }
        if (line.trim()) html += '<p>' + line + '</p>';
      }
    });
    if (inUl) html += '</ul>';
    if (inOl) html += '</ol>';
    return html;
  }

  function hideEmpty() {
    var el = document.getElementById('tuto-empty');
    if (el) el.style.display = 'none';
    var chips = document.getElementById('tuto-chips');
    if (chips) chips.style.display = 'none';
  }

  function showTyping() {
    document.getElementById('tuto-typing').style.display = 'flex';
    scrollBottom();
  }

  function hideTyping() {
    document.getElementById('tuto-typing').style.display = 'none';
  }

  function scrollBottom() {
    var c = document.getElementById('tuto-messages');
    if (c) c.scrollTop = c.scrollHeight;
  }

  /* ── Init ── */
  sessionId = getOrCreateSession();
  setStatus('connecting');
  connect();

})();