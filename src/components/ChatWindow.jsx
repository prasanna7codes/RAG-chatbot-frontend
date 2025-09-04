"use client";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Bot, User, PhoneCall, Mic, Send, ArrowLeft, Sparkles } from "lucide-react";
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

  // voice mode toggle + bot speaking tracker
  const [voiceMode, setVoiceMode] = useState(false);
  const [botSpeaking, setBotSpeaking] = useState(false);

  const [viewMode, setViewMode] = useState("text");

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

  // track last input type
  const [lastWasVoice, setLastWasVoice] = useState(false);

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
      setBotSpeaking(true); // show "AI is speaking..."
      const res = await fetch(
        "https://trying-cloud-embedding-again.onrender.com/tts?text=" + encodeURIComponent(text)
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      audio.onended = () => {
        setBotSpeaking(false); // hide when finished
      };

      audio.play();
    } catch (e) {
      console.error("TTS error:", e);
      setBotSpeaking(false);
    }
  };

  // ===== voice recording (STT ) with device logging =====
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop()); // cleanup
      setIsRecording(false);
      return;
    }

    try {
      console.log("🎙️ Requesting microphone access...");

      // 🔍 List available media devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log("🔊 Available devices:", devices);
      const mics = devices.filter((d) => d.kind === "audioinput");
      if (mics.length === 0) {
        console.warn("⚠️ No microphones detected!");
      } else {
        console.log("🎤 Detected microphones:", mics.map((m) => m.label || "Unnamed mic"));
      }

      // ✅ Request mic stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Pick supported MIME type
      let options = { mimeType: "audio/webm;codecs=opus" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "audio/webm" };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = {}; // fallback
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.onstart = () => {
        console.log("✅ Recording started with MIME:", mediaRecorder.mimeType);
        setIsRecording(true);
      };

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("🛑 Recording stopped");
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });

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
            console.log("Voice transcript:", data.text);

            // mark as voice input
            setLastWasVoice(true);

            // directly send transcript to bot (skip input field)
            sendBotMessageDirect(data.text);
          } else {
            setMessages((prev) => [
              ...prev,
              { sender: "ai", text: "⚠️ Could not transcribe audio." },
            ]);
          }
        } catch (err) {
          console.error("❌ STT error:", err);
          setMessages((prev) => [
            ...prev,
            { sender: "ai", text: "⚠️ Error sending audio to server." },
          ]);
        }
      };

      mediaRecorder.start();
    } catch (err) {
      console.error("❌ getUserMedia failed:", err);

      let errorMsg = "⚠️ Microphone access denied or unavailable.";
      if (err.name === "NotAllowedError") {
        errorMsg = "⚠️ Permission denied. Please allow microphone access.";
      } else if (err.name === "NotFoundError") {
        errorMsg = "⚠️ No microphone found. Please connect one.";
      } else if (err.name === "NotReadableError") {
        errorMsg = "⚠️ Microphone is in use by another app.";
      } else if (err.name === "SecurityError") {
        errorMsg = "⚠️ Access blocked due to insecure context (use HTTPS or localhost).";
      }

      setMessages((prev) => [...prev, { sender: "ai", text: errorMsg }]);
    }
  };

  // ===== RAG flow =====
  const sendBotMessage = async () => {
    if (!input.trim() || !apiKey || !clientDomain) return;

    const text = input.trim();

    // typed input -> show bubble
    setMessages((prev) => [...prev, { sender: "user", text }]);
    setLastWasVoice(false); // mark explicitly

    setLoading(true);

    try {
      const res = await fetch("https://trying-cloud-embedding-again.onrender.com/query/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "X-Client-Domain": clientDomain,
          "X-Session-Id": sessionId,
        },
        body: JSON.stringify({ question: text }),
      });

      if (!res.ok) throw new Error("Error fetching answer");

      const data = await res.json();
      const aiMessage = {
        sender: "ai",
        text: data.answer || "Sorry, I could not find an answer.",
      };

      // typed input -> show chatbot bubble
      setMessages((prev) => [...prev, aiMessage]);

      // 🚫 no TTS for text input
    } catch (e) {
      setMessages((prev) => [...prev, { sender: "ai", text: `⚠️ ${e.message}` }]);
    }

    setInput("");
    setLoading(false);
    inputRef.current?.focus();
  };

  const sendBotMessageDirect = async (voiceText) => {
    if (!voiceText || !apiKey || !clientDomain) return;

    setLastWasVoice(true); // voice input

    setLoading(true);

    try {
      const res = await fetch("https://trying-cloud-embedding-again.onrender.com/query/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "X-Client-Domain": clientDomain,
          "X-Session-Id": sessionId,
        },
        body: JSON.stringify({ question: voiceText }),
      });

      if (!res.ok) throw new Error("Error fetching answer");

      const data = await res.json();
      const aiMessage = data.answer || "Sorry, I could not find an answer.";

      // 🚫 don't show bubbles for voice input
      // 🔊 just play TTS
      playTTS(aiMessage);
    } catch (e) {
      console.error("Voice flow error:", e);
    }

    setLoading(false);
    setLastWasVoice(false);
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

  // Voice Mode UI
  if (viewMode === "voice") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-voice-background text-voice-foreground rounded-2xl overflow-hidden relative">
        
        {/* Subtle Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-voice-primary/3 to-voice-secondary/3"></div>
        
        {/* Header */}
        <div className="absolute top-6 left-0 right-0 text-center z-10">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-voice-primary/20 flex items-center justify-center">
              <Mic className="w-4 h-4 text-voice-primary" />
            </div>
            <h2 className="text-2xl font-bold text-voice-foreground">
              {botName}
            </h2>
          </div>
          <p className="text-sm text-voice-foreground/70 font-medium">Voice Conversation</p>
        </div>

        {/* Main Voice Interface */}
        <div className="flex flex-col items-center justify-center flex-1 z-10">
          {/* Microphone Button */}
          <div className="relative mb-8">
            {/* Subtle pulse ring for recording */}
            {isRecording && (
              <div className="absolute inset-0 rounded-full bg-voice-secondary/20 animate-ping"></div>
            )}
            
            <Button
              size="voice"
              disabled={botSpeaking}
              variant={
                botSpeaking 
                  ? "voice-disabled" 
                  : isRecording 
                    ? "voice-record" 
                    : "voice-idle"
              }
              onClick={toggleRecording}
              className="relative z-10 transform transition-all duration-300 hover:scale-105
           bg-voice-primary text-voice-foreground rounded-full h-16 w-16 focus:outline-none focus:ring-2 focus:ring-voice-primary/40"
            >
              {(botSpeaking || isRecording) ? (
  <div className="w-8 h-8 rounded-full bg-current animate-pulse" />
) : (
  <Mic className="w-8 h-8" />
)}
            </Button>
          </div>

          {/* Status Display */}
          <div className="text-center max-w-sm">
            {botSpeaking ? (
              <div className="space-y-2">
                <div className="text-xl font-semibold text-voice-foreground">AI is speaking</div>
                <div className="text-sm text-voice-foreground/70">Please wait for the response</div>
              </div>
            ) : isRecording ? (
              <div className="space-y-2">
                <div className="text-xl font-semibold text-voice-foreground">Listening</div>
                <div className="text-sm text-voice-foreground/70">Speak now, tap when finished</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xl font-semibold text-voice-foreground">Ready to listen</div>
                <div className="text-sm text-voice-foreground/70">Tap the microphone to start</div>
              </div>
            )}
          </div>

          {/* Simple Audio Visualization */}
          {(isRecording || botSpeaking) && (
  <div className="flex items-center gap-1 mt-6">
    {[1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        className={`w-1 h-8 rounded-full opacity-60 ${
          botSpeaking ? "bg-voice-secondary" : "bg-voice-primary"
        }`}
        style={{
          animation: `bounce-gentle 1s ease-in-out infinite`,
          animationDelay: `${i * 0.1}s`
        }}
      />
    ))}
  </div>
)}
        </div>

        {/* Back Button */}
        <div className="absolute bottom-6 z-10">
          <Button
            variant="chat-outline"
            size="default"
            onClick={() => setViewMode("text")}
            className="px-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Button>
        </div>
      </div>
    );
  }

  // Text Mode UI
  return (
    <Card className="w-full h-full flex flex-col overflow-hidden shadow-elegant bg-gradient-subtle border-0">
      {/* Modern Header */}
      <div 
        className="relative px-6 py-4 bg-gradient-primary text-white overflow-hidden"
        style={{ 
          background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)` 
        }}
      >
        {/* Header Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
        </div>
        
        <div className="relative flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-elegant">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">{botName}</h2>
              <p className="text-sm text-white/80 font-medium">
                {liveMode ? (
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    Live agent connected
                  </span>
                ) : (
                  "Always here to help you"
                )}
              </p>
            </div>
          </div>
          
          {!liveMode && (
            <Button
              variant="chat-outline"
              size="sm"
              onClick={startHumanHandoff}
              disabled={loading}
              className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white hover:text-primary"
            >
              <PhoneCall className="w-4 h-4" />
              Human Agent
            </Button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <CardContent className="flex-1 overflow-y-auto p-0 bg-chat-background">
        <div className="p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12 animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center shadow-glow
+                 bg-[linear-gradient(135deg,_hsl(var(--primary)),_hsl(292_84%_61%))]">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Welcome to {botName}!</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                I'm here to help you with any questions about this website or company. 
                Feel free to ask me anything!
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-4 animate-slide-up ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {msg.sender !== "user" && (
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl shadow-sm backdrop-blur-sm transition-all duration-200 hover:shadow-md ${
                  msg.sender === "user"
                    ? "bg-chat-user text-chat-user-foreground rounded-br-md shadow-glow"
                    : "bg-chat-bot text-chat-bot-foreground border border-border/50 rounded-bl-md"
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
              
              {msg.sender === "user" && (
                <div className="w-10 h-10 rounded-full bg-secondary shadow-sm flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-5 h-5 text-secondary-foreground" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-4 animate-fade-in">
              <div className="w-10 h-10 rounded-full bg-gradient-primary shadow-elegant flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-chat-bot border border-border/50 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-3 shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {liveMode ? "Agent is typing..." : "Thinking..."}
                </span>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>
      </CardContent>

      {/* Modern Input Area */}
      <div className="p-6 border-t border-border/50 bg-gradient-subtle backdrop-blur-sm">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                liveMode 
                  ? "Type your message to the agent..." 
                  : "Ask me anything about this company..."
              }
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
              className="pr-12 h-12 bg-white/80 backdrop-blur-sm border-border/50 focus:border-primary/50 focus:ring-primary/20 rounded-xl shadow-sm transition-all duration-200"
            />
          </div>
          
          <Button 
            onClick={onSend} 
            disabled={!input.trim() || loading}
            variant="chat"
            size="default"
            className="h-12 px-6 rounded-xl"
          >
            <Send className="w-4 h-4" />
          </Button>
          
          <Button 
            variant="voice" 
            size="default"
            onClick={() => setViewMode("voice")}
            className="h-12 px-4 rounded-xl"
          >
            <Mic className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="mt-3 text-xs text-center text-muted-foreground">
          {liveMode ? (
            "Connected to live support"
          ) : (
            `Powered by ${botName} • Click the mic for voice chat`
          )}
        </div>
      </div>
    </Card>
  );
}