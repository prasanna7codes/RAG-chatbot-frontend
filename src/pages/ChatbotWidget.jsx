// pages/ChatbotWidget.jsx
"use client";

import ChatbotWidgetUI from "../components/ChatbotWidgetUI";

export default function ChatbotWidget() {
  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      <ChatbotWidgetUI />
    </div>
  );
}
