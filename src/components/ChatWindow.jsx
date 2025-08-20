"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Loader2, Send, Bot, User } from "lucide-react";

export default function ChatWindow({ onClose }) {
  // State management from Code 2 - starting with an empty array
  const [apiKey, setApiKey] = useState("");
  const [clientDomain, setClientDomain] = useState("");
  const [messages, setMessages] = useState([]); // Changed to empty array to match Code 1's initial state logic
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // All useEffect hooks and the sendMessage function are preserved from Code 2
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("apiKey");
    const domain = params.get("clientDomain");

    if (key) setApiKey(key);
    else console.error("Chatbot API Key not found in URL.");
    
    if (domain) setClientDomain(domain);
    else console.error("Client Domain not found in URL.");
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
    setInput(""); // Clears input immediately for better UX

    try {
      const res = await fetch("https://trying-cloud-embedding-again.onrender.com/query/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
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
    
    setLoading(false);
    inputRef.current?.focus();
  };

  // The entire JSX structure is now identical to Code 1
  return (
    <Card className="w-full h-full flex flex-col bg-background border shadow-elegant overflow-hidden">
      {/* Header from Code 1 */}
      <div className="flex justify-between items-center p-4 bg-gradient-primary text-white border-b">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
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

      {/* Messages section from Code 1 */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
        {/* Initial empty state message from Code 1 */}
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Welcome to InsightBot!</h3>
            <p className="text-sm text-muted-foreground">Ask me anything about this website or company.</p>
          </div>
        )}
        
        {/* Message mapping from Code 1 */}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
            {msg.sender === "ai" && (
              <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                msg.sender === "user"
                  ? "bg-gradient-primary text-white rounded-br-md"
                  : "bg-background border shadow-sm rounded-bl-md"
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
            {msg.sender === "user" && (
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        
        {/* Loading indicator from Code 1 */}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-background border shadow-sm rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </CardContent>

      {/* Input section from Code 1 */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            className="flex-1 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            disabled={!apiKey || !clientDomain || loading}
          />
          <Button
            onClick={sendMessage}
            disabled={loading || !input.trim() || !apiKey || !clientDomain}
            className="bg-gradient-primary hover:opacity-90 px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center justify-center mt-2">
          <p className="text-xs text-muted-foreground">Powered by InsightBot AI</p>
        </div>
      </div>
    </Card>
  );
}
