"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Loader2, Send, Bot, User } from "lucide-react";

export default function ChatWindow() {
  const [apiKey, setApiKey] = useState("");
  const [clientDomain, setClientDomain] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [themeColor, setThemeColor] = useState("#4f46e5");
  const [botName, setBotName] = useState("InsightBot");

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    setApiKey(params.get("apiKey") || "");
    setClientDomain(params.get("clientDomain") || "");
    setThemeColor(params.get("themeColor") || "#4f46e5");
    setBotName(params.get("botName") || "InsightBot");
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || !apiKey || !clientDomain) return;

    const userMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

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

      if (!res.ok) throw new Error("Error fetching answer");

      const data = await res.json();
      const aiMessage = { sender: "ai", text: data.answer || "Sorry, I could not find an answer." };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      setMessages((prev) => [...prev, { sender: "ai", text: `⚠️ ${error.message}` }]);
    }

    setInput("");
    setLoading(false);
    inputRef.current?.focus();
  };

  return (
    <Card className="w-full h-full flex flex-col overflow-hidden" style={{ background: "white" }}>
      {/* Header */}
      <div className="flex justify-between items-center p-4" style={{ background: themeColor, color: "white" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.3)" }}>
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold">{botName}</h2>
            <p className="text-xs text-white/80">Always here to help</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => { if (window.frameElement) window.frameElement.style.display = "none"; }}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <h3 className="font-semibold mb-2">{botName} is ready to help!</h3>
            <p className="text-sm text-gray-600">Ask me anything about this website or company.</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
            {msg.sender === "ai" && (
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${msg.sender === "user" ? "bg-blue-500 text-white rounded-br-md" : "bg-white border rounded-bl-md"}`}>
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
            </div>
            {msg.sender === "user" && (
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-gray-700" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border rounded-2xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Thinking...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </CardContent>

      {/* Input */}
      <div className="p-4 border-t flex gap-2">
        <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask me anything..." onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()} />
        <Button onClick={sendMessage} disabled={!input.trim()}>Send</Button>
      </div>
    </Card>
  );
}
