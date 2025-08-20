"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Loader2, Send, Bot, User } from "lucide-react";

export default function ChatWindow({ onClose }) {
  const [apiKey, setApiKey] = useState("");
  const [clientDomain, setClientDomain] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setApiKey(params.get("apiKey") || "");
    setClientDomain(params.get("clientDomain") || "");
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || !apiKey || !clientDomain) return;

    const userMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setInput("");

    try {
      const res = await fetch("https://trying-cloud-embedding-again.onrender.com/query/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "X-Client-Domain": clientDomain,
        },
        body: JSON.stringify({ question: input }),
      });

      const data = await res.json();
      const aiMessage = { sender: "ai", text: data.answer || "Sorry, I could not find an answer." };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      setMessages((prev) => [...prev, { sender: "ai", text: `⚠️ Error: ${error.message}` }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  return (
    <Card className="w-full h-full flex flex-col rounded-2xl border-0 shadow-xl overflow-hidden bg-white/10 backdrop-blur-lg">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-500/80 to-purple-600/80 backdrop-blur-lg text-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/30 rounded-full flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold">InsightBot AI</h2>
            <p className="text-xs text-white/80">Always here to help</p>
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20 h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-transparent">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <h3 className="font-semibold text-white mb-2">Welcome to InsightBot!</h3>
            <p className="text-sm text-gray-200">Ask me anything about this website or company.</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.sender === "ai" && (
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={`max-w-[75%] px-4 py-3 rounded-2xl backdrop-blur-md ${
                msg.sender === "user"
                  ? "bg-gradient-to-r from-purple-500/80 to-pink-500/80 text-white shadow-lg rounded-br-md"
                  : "bg-white/20 text-white border border-white/20 shadow-sm rounded-bl-md"
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
            {msg.sender === "user" && (
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white/20 text-white border border-white/20 rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-gray-200">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </CardContent>

      {/* Input */}
      <div className="p-4 border-t border-white/10 bg-white/5 backdrop-blur-lg">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-white/20 text-white placeholder-gray-300 border-0 rounded-xl focus-visible:ring-1 focus-visible:ring-blue-400"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            disabled={!apiKey || !clientDomain || loading}
          />
          <Button
            onClick={sendMessage}
            disabled={loading || !input.trim() || !apiKey || !clientDomain}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:opacity-90 px-4 text-white rounded-xl shadow-lg"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-center mt-2 text-gray-300">✨ Powered by InsightBot AI</p>
      </div>
    </Card>
  );
}
