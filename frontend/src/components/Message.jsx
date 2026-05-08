export const Message = ({ msg, isUser }) => {
  const formatText = (text) =>
    String(text).split(/(\*\*[^*]+\*\*)/).map((p, i) =>
      p.startsWith("**") && p.endsWith("**") ? 
        <strong key={i}>{p.slice(2, -2)}</strong> : p
    );
    
  return (
    <div style={{ 
      display: "flex", 
      justifyContent: isUser ? "flex-end" : "flex-start", 
      marginBottom: 16, 
      animation: "msgIn 0.3s ease-out" 
    }}>
      <div style={{ maxWidth: "80%" }}>
        <div style={{
          padding: "12px 16px",
          borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
          background: isUser ? "#1a4a7a" : "#ffffff",
          color: isUser ? "#ffffff" : "#334155",
          fontSize: "14px", 
          lineHeight: "1.6",
          boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
          border: isUser ? "none" : "1px solid #e2e8f0",
          whiteSpace: "pre-wrap",
        }}>
          {isUser ? msg.text : formatText(msg.text)}
        </div>
        <div style={{ 
          fontSize: "10px", 
          color: "#94a3b8", 
          marginTop: 4, 
          textAlign: isUser ? "right" : "left" 
        }}>
          {msg.timestamp}
        </div>
      </div>
    </div>
  );
};