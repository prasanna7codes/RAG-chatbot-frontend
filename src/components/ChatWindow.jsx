"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Bot, User, PhoneCall, Mic } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function ChatWindow() {
  const [apiKey, setApiKey] = useState("");
  const [clientDomain, setClientDomain] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [themeColor, setThemeColor] = useState("#4f46e5");
  const [botName, setBotName] = useState("InsightBot");
  const [sessionId, setSessionId] = useState("");

  // live chat
  const [liveMode, setLiveMode] = useState(false);
  const [conversationId, setConversationId] = useState(null);

  // refs
  const supaRef = useRef(null);
  const channelRef = useRef(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // voice
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setApiKey(params.get("apiKey") || "");
    setClientDomain(params.get("clientDomain") || "");
    setThemeColor(params.get("themeColor") || "#4f46e5");
    setBotName(params.get("botName") || "InsightBot");
    setSessionId(crypto.randomUUID());

    return () => {
      (async () => {
        try {
          if (channelRef.current && supaRef.current) {
            await channelRef.current.unsubscribe();
            supaRef.current.removeChannel(channelRef.current);
            channelRef.current = null;
          }
        } catch (e) {
          // no-op
        }
      })();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ===== helper: play bot reply with ElevenLabs TTS =====
  const playTTS = async (text) => {
    try {
      const res = await fetch(
        "https://trying-cloud-embedding-again.onrender.com/tts?text=" +
          encodeURIComponent(text)
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (e) {
      console.error("TTS error:", e);
    }
  };

  // ===== voice recording (STT Whisper) =====
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop()); // cleanup
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.onstart = () => {
        console.log("🎙️ Recording started");
        setIsRecording(true);
      };

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("🛑 Recording stopped");
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        const formData = new FormData();
        formData.append("file", blob, "recording.webm");

        try {
          const res = await fetch(
            "https://trying-cloud-embedding-again.onrender.com/stt",
            { method: "POST", body: formData }
          );
          const data = await res.json();
          console.log("STT response:", data);

          if (data.text) {
            setInput(data.text); // fill input box with transcript
          } else {
            setMessages((prev) => [
              ...prev,
              { sender: "ai", text: "⚠️ Could not transcribe audio." },
            ]);
          }
        } catch (err) {
          console.error("STT error:", err);
          setMessages((prev) => [
            ...prev,
            { sender: "ai", text: "⚠️ Error sending audio to server." },
          ]);
        }
      };

      mediaRecorder.start();
    } catch (err) {
      console.error("Mic error:", err);
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: "⚠️ Microphone access denied or unavailable." },
      ]);
    }
  };

  // ===== RAG flow =====
  const sendBotMessage = async () => {
    if (!input.trim() || !apiKey || !clientDomain) return;
    const text = input.trim();
    setMessages((prev) => [...prev, { sender: "user", text }]);
    setLoading(true);
    try {
      const res = await fetch(
        "https://trying-cloud-embedding-again.onrender.com/query/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
            "X-Client-Domain": clientDomain,
            "X-Session-Id": sessionId,
          },
          body: JSON.stringify({ question: text }),
        }
      );
      if (!res.ok) throw new Error("Error fetching answer");
      const data = await res.json();
      const aiMessage = {
        sender: "ai",
        text: data.answer || "Sorry, I could not find an answer.",
      };
      setMessages((prev) => [...prev, aiMessage]);

      // auto-play answer
      playTTS(aiMessage.text);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: `⚠️ ${e.message}` },
      ]);
    }
    setInput("");
    setLoading(false);
    inputRef.current?.focus();
  };

  // ===== LIVE handoff =====
  const startHumanHandoff = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        "https://trying-cloud-embedding-again.onrender.com/live/request",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
            "X-Client-Domain": clientDomain,
            "X-Session-Id": sessionId,
          },
          body: JSON.stringify({ requested_by_contact: null }),
        }
      );
      if (!res.ok) throw new Error("Unable to start live chat");
      const data = await res.json();

      // debug JWT
      try {
        const payload = JSON.parse(atob(data.supabase_jwt.split(".")[1]));
        console.log("VISITOR JWT payload (widget):", payload);
      } catch (e) {
        console.warn("Failed to decode visitor JWT in browser:", e);
      }

      setConversationId(data.conversation_id);

      const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${data.supabase_jwt}` } },
        realtime: { params: { eventsPerSecond: 20 } },
      });
      supaRef.current = supa;
      supa.realtime.setAuth(data.supabase_jwt);

      // initial history
      try {
        const { data: history, error: histErr } = await supa
          .from("live_messages")
          .select("*")
          .eq("conversation_id", data.conversation_id)
          .order("created_at", { ascending: true });
        if (histErr) console.warn("Initial history fetch failed:", histErr);
        if (history?.length) {
          const mapped = history
            .filter((r) => r.sender_type === "executive")
            .map((r) => ({ sender: "ai", text: r.message }));
          if (mapped.length) setMessages((prev) => [...prev, ...mapped]);
        }
      } catch (e) {
        console.warn("History fetch exception:", e);
      }

      // realtime subscribe
      const ch = supa
        .channel(`live:msgs:${data.conversation_id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "live_messages",
            filter: `conversation_id=eq.${data.conversation_id}`,
          },
          (payload) => {
            const row = payload.new;
            if (!row) return;
            if (row.sender_type !== "executive") return;
            setMessages((prev) => [...prev, { sender: "ai", text: row.message }]);
          }
        )
        .subscribe();

      channelRef.current = ch;
      setLiveMode(true);
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: "Connecting you to a human agent..." },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: `⚠️ ${e.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sendLiveMessage = async () => {
    if (!input.trim() || !supaRef.current || !conversationId) return;
    const text = input.trim();

    setMessages((prev) => [...prev, { sender: "user", text }]);
    setInput("");

    const { error } = await supaRef.current
      .from("live_messages")
      .insert({
        conversation_id: conversationId,
        sender_type: "visitor",
        message: text,
      })
      .select("*");

    if (error) {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: `⚠️ ${error.message}` },
      ]);
    }
  };

  const onSend = async () => {
    if (liveMode) return sendLiveMessage();
    return sendBotMessage();
  };

  return (
    <Card
      className="w-full h-full flex flex-col overflow-hidden"
      style={{ background: "white" }}
    >
      {/* Header */}
      <div
        className="flex justify-between items-center p-4"
        style={{ background: themeColor, color: "white" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.3)" }}
          >
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold">{botName}</h2>
            <p className="text-xs text-white/80">
              {liveMode ? "Live agent connected" : "Always here to help"}
            </p>
          </div>
        </div>
        {!liveMode && (
          <Button
            variant="secondary"
            onClick={startHumanHandoff}
            disabled={loading}
            className="gap-2"
          >
            <PhoneCall className="w-4 h-4" /> Talk to a human
          </Button>
        )}
      </div>

      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <h3 className="font-semibold mb-2">{botName} is ready to help!</h3>
            <p className="text-sm text-gray-600">
              Ask me anything about this website or company.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${
              msg.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.sender !== "user" && (
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                msg.sender === "user"
                  ? "bg-blue-500 text-white rounded-br-md"
                  : "bg-white border rounded-bl-md"
              }`}
            >
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
            <div className="bg-white border rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Connecting...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </CardContent>

      {/* Input */}
      <div className="p-4 border-t flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            liveMode ? "Type a message to the agent..." : "Ask me anything..."
          }
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
        />
        <Button onClick={onSend} disabled={!input.trim()}>
          {liveMode ? "Send" : "Ask"}
        </Button>
        <Button onClick={toggleRecording} variant="outline">
          {isRecording ? "🛑 Stop Recording" : <Mic className="w-4 h-4" />}
        </Button>
      </div>
    </Card>
  );
}
