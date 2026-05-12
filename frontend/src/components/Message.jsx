import ReactMarkdown from "react-markdown";

const formatBotText = (text) => {
  if (!text) return "";

  const hasBullets = text.includes("•");

  if (hasBullets) {
    return text
      .replace(/\s*•\s*/g, "\n• ") 
      .replace(/^\n/, "")          
      .trim();
  }

  return text;
};

export const Message = ({ msg, isUser }) => {
  return (
    <div
      className="tuto-msg"
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          maxWidth: "80%",
          padding: "10px 13px",
          borderRadius: isUser
            ? "16px 16px 4px 16px"
            : "16px 16px 16px 4px",
          background: isUser ? "var(--brand-navy)" : "#fff",
          color: isUser ? "#fff" : "#1e293b",
          fontSize: 13.5,
          fontFamily: "'Open Sans', sans-serif",
          border: isUser ? "none" : "1px solid #e2e8f0",
          lineHeight: 1.55,
        }}
      >
        {isUser ? (
          <span style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => (
                <p style={{ margin: "0 0 6px 0", whiteSpace: "pre-line" }}>
                  {children}
                </p>
              ),
              strong: ({ children }) => (
                <strong style={{ fontWeight: 600, color: "#0f3460" }}>
                  {children}
                </strong>
              ),
              ul: ({ children }) => (
                <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol style={{ margin: "4px 0", paddingLeft: 18 }}>
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li style={{ marginBottom: 3 }}>{children}</li>
              ),
              em: ({ children }) => (
                <em style={{ color: "#64748b", fontStyle: "italic" }}>
                  {children}
                </em>
              ),
            }}
          >
            {formatBotText(msg.text)}
          </ReactMarkdown>
        )}

        <div
          style={{
            fontSize: 10,
            color: isUser ? "rgba(255,255,255,0.5)" : "#94a3b8",
            marginTop: 4,
            textAlign: "right",
          }}
        >
          {msg.timestamp}
        </div>
      </div>
    </div>
  );
};