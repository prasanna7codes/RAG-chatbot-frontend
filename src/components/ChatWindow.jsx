"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";

export default function ChatWindow({ onClose }) {
  const [apiKey, setApiKey] = useState("");
  // *** CHANGE #1: Add state for the client's domain ***
  const [clientDomain, setClientDomain] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load apiKey and clientDomain from the URL query string
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("apiKey");
    // *** CHANGE #2: Read the clientDomain from the URL ***
    const domain = params.get("clientDomain");

    if (key) {
      setApiKey(key);
    } else {
      console.error("Chatbot API Key not found in URL.");
    }
    if (domain) {
      setClientDomain(domain);
    } else {
      console.error("Client Domain not found in URL.");
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    // Also check for clientDomain before sending
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
          // *** CHANGE #3: Use the domain from the URL for the header ***
          "X-Client-Domain": clientDomain,
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

  // --- No changes needed for the JSX return part ---
  return (
    <Card className="fixed bottom-20 right-6 w-[26rem] h-[30rem] flex flex-col rounded-3xl shadow-2xl overflow-hidden border-2 border-blue-400 bg-white/60 backdrop-blur-md">
      <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <h2 className="text-lg font-bold">AI Assistant</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-blue-700"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`px-4 py-2 rounded-2xl shadow-md text-sm leading-relaxed max-w-[75%] break-words ${
                msg.sender === "user"
                  ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-br-none"
                  : "bg-white/80 text-gray-900 border rounded-bl-none"
              }`}
            >
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
      <div className="p-3 border-t flex items-center gap-2 bg-white/70 backdrop-blur">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 text-sm border-blue-400 focus-visible:ring-blue-500"
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          disabled={!apiKey || !clientDomain}
        />
        <Button
          size="sm"
          onClick={sendMessage}
          disabled={loading || !apiKey || !clientDomain}
          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:opacity-90"
        >
          Send
        </Button>
      </div>
    </Card>
  );
}
