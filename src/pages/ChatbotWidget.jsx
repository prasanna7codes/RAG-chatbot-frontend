// pages/ChatbotWidget.jsx

"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Loader2 } from "lucide-react";

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(""); // MODIFIED: Use apiKey instead of companyName
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // MODIFIED: Load apiKey from query string
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("apiKey");
    if (key) {
      setApiKey(key);
    } else {
        console.error("Chatbot API Key not found in URL.");
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = async () => {
    // MODIFIED: Check for apiKey
    if (!input.trim() || !apiKey) return;

    const userMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await fetch("https://trying-cloud-embedding-again.onrender.com/query/", {
        method: "POST",
        // MODIFIED: Send API key in header and remove company name from body
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "X-Client-Domain": window.location.hostname 
        },
        body: JSON.stringify({
          question: input,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || `HTTP error! Status: ${res.status}`);
      }

      const data = await res.json();
      const aiMessage = { sender: "ai", text: data.answer || "Sorry, I could not find an answer." };
      setMessages((prev) => [...prev, aiMessage]);

    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: `⚠️ Error: ${error.message}` },
      ]);
    }

    setInput("");
    setLoading(false);
    inputRef.current?.focus();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen && (
        <Button onClick={() => setIsOpen(true)} className="rounded-full p-5 shadow-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:opacity-90">
          <MessageCircle className="w-7 h-7" />
        </Button>
      )}
      {isOpen && (
        <Card className="w-[26rem] h-[30rem] flex flex-col rounded-3xl shadow-2xl overflow-hidden border-2 border-blue-400">
          <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            {/* MODIFIED: Generic header */}
            <h2 className="text-lg font-bold">AI Assistant</h2>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white hover:bg-blue-700">
              <X className="w-5 h-5" />
            </Button>
          </div>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-br from-gray-50 to-gray-100">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`px-4 py-2 rounded-2xl shadow-md text-sm leading-relaxed max-w-[75%] break-words ${msg.sender === "user" ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-br-none" : "bg-white text-gray-900 border rounded-bl-none"}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start items-center text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> AI is thinking...
              </div>
            )}
            <div ref={chatEndRef} />
          </CardContent>
          <div className="p-3 border-t flex items-center gap-2 bg-white">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 text-sm border-blue-400 focus-visible:ring-blue-500"
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              disabled={!apiKey}
            />
            <Button size="sm" onClick={sendMessage} disabled={loading || !apiKey} className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:opacity-90">
              Send
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}