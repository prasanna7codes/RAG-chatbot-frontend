// pages/ChatbotWidget.jsx
"use client";

// This component is now simplified for direct iframe embedding.
// It no longer shows a floating button, it IS the chat window.
import ChatWindow from "../components/ChatWindow";

export default function ChatbotWidget() {
  // The ChatWindow component is now the main export.
  // We don't need the floating button logic here because the entire
  // component will be inside the iframe on the client's page.
  // The onClose function is not needed here, as there's no button to close it.
  // If you want a close button inside the chat, that would be handled in ChatWindow.
  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
       <ChatWindow onClose={() => { /* Optional: define close behavior if needed */ }} />
    </div>
  );
}
