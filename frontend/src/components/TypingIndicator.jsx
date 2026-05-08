export const TypingIndicator = () => (
  <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 16 }}>
    <div style={{ 
      padding: "12px 16px", 
      borderRadius: "12px 12px 12px 2px", 
      background: "#ffffff", 
      border: "1px solid #e2e8f0", 
      display: "flex", 
      gap: 4, 
      alignItems: "center" 
    }}>
      {[0, 0.18, 0.36].map((d, i) => (
        <span key={i} style={{ 
          width: 6, 
          height: 6, 
          borderRadius: "50%", 
          background: "#94a3b8", 
          animation: "dotB 1.1s infinite", 
          animationDelay: `${d}s`, 
          display: "inline-block" 
        }} />
      ))}
    </div>
  </div>
);