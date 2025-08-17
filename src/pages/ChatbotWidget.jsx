"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Loader2 } from "lucide-react";

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load company from query string
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const company = params.get("company");
    if (company) setCompanyName(company);
  }, []);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-focus input when chat opens
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || !companyName) return;

    const userMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/query/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          question: input,
        }),
      });
      const data = await res.json();

      const aiMessage = {
        sender: "ai",
        text: data.answer || "No answer found.",
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: "⚠️ Error contacting server." },
      ]);
    }

    setInput("");
    setLoading(false);
    inputRef.current?.focus();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full p-5 shadow-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:opacity-90"
        >
          <MessageCircle className="w-7 h-7" />
        </Button>
      )}

      {/* Chat window */}
      {isOpen && (
        <Card className="w-[26rem] h-[30rem] flex flex-col rounded-3xl shadow-2xl overflow-hidden border-2 border-blue-400">
          {/* Header */}
          <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <h2 className="text-lg font-bold">
              {companyName || "AI Assistant"}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-blue-700"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Messages */}
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-br from-gray-50 to-gray-100">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`px-4 py-2 rounded-2xl shadow-md text-sm leading-relaxed max-w-[65%] break-words ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-br-none"
                      : "bg-white text-gray-900 border rounded-bl-none"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start items-center text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> AI is typing...
              </div>
            )}

            <div ref={chatEndRef} />
          </CardContent>

          {/* Input */}
          <div className="p-3 border-t flex items-center gap-2 bg-white">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 text-sm border-blue-400 focus-visible:ring-blue-500"
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <Button
              size="sm"
              onClick={sendMessage}
              disabled={loading}
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:opacity-90"
            >
              Send
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
