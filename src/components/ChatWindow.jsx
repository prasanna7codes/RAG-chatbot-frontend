"use client";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
// removed Input import because we use a textarea now
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Bot,
  User,
  PhoneCall,
  Mic,
  Send,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
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
  const textareaRef = useRef(null); // replaced inputRef with textareaRef

  const scrollRef = useRef(null); // the scrollable container
  const lastAiRef = useRef(null); // the last AI message element

  // voice (existing full voice view)
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  // NEW: dictation (for the input box)
  const [isDictating, setIsDictating] = useState(false);
  const mediaRecorderDictRef = useRef(null);
  const audioChunksDictRef = useRef([]);
  const streamDictRef = useRef(null);

  // WebAudio monitoring refs for silence detection
  const audioMonitorRef = useRef(null); // stop function
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);

  const silenceTimeoutRef = useRef(null);
  const silenceTimeoutDictRef = useRef(null);

  // continuous monitoring helpers & smoothing
  const continuousRafRef = useRef(null);
  const smoothedRmsRef = useRef(0);
  const smoothedOrbRef = useRef(0);
  const smoothedPeakHoldRef = useRef(0);

  // playback refs
  const currentAudioRef = useRef(null);
  const currentAudioUrlRef = useRef(null);

  // allow monitoring to interrupt TTS or be paused; we use modes instead of a single flag
  const monitoringModeRef = useRef("normal"); // "normal" | "duringPlayback"
  // normal threshold tuned to avoid tiny noise; duringPlayback threshold higher to avoid accidental interruptions
  const BASE_VOICE_THRESHOLD = 0.02; // adjust if too sensitive
  const PLAYBACK_INTERRUPT_THRESHOLD = 0.04; // user must be louder to interrupt during playback

  // control variables for VAD debounce
  const vadAboveStartRef = useRef(0);
  const vadBelowStartRef = useRef(0);
  const userSpeakingRef = useRef(false);
  const lastUtteranceAtRef = useRef(0);

  // track last input type
  const [lastWasVoice, setLastWasVoice] = useState(false);

  // orb UI level
  const [voiceOrbLevel, setVoiceOrbLevel] = useState(0); // 0..1

  function stripMarkdownForSpeech(s = "") {
    if (!s) return "";
    // remove bullet markers at start of lines and heading markers
    s = s.replace(/^[\s]*[*\-+]\s+/gm, "");
    s = s.replace(/^[\s]*#{1,6}\s+/gm, "");
    // remove leftover inline emphasis markers *like this*
    s = s.replace(/\*(.*?)\*/g, "$1");
    // collapse multiple newlines and replace with single space for speech
    s = s.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
    return s;
  }

  // preserve paragraphs/newlines, but strip bullet markers, headings, inline asterisks
  function cleanForDisplay(s = "") {
    if (!s) return "";
    // remove leading bullet markers at line starts
    s = s.replace(/^[\s]*[*\-+]\s+/gm, "");
    // remove heading markers like "# " at line starts
    s = s.replace(/^[\s]*#{1,6}\s+/gm, "");
    // remove inline emphasis markers *like this* -> like this
    s = s.replace(/\*(.*?)\*/g, "$1");
    // trim spaces on each line and remove trailing/leading whitespace
    s = s.split("\n").map((l) => l.trim()).join("\n").trim();
    return s;
  }

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

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || messages.length === 0) return;

    const last = messages[messages.length - 1];

    // helper: top of el relative to the scroller
    const getTopWithinScroller = (el, container) => {
      const elTop = el.getBoundingClientRect().top;
      const scTop = container.getBoundingClientRect().top;
      return elTop - scTop + container.scrollTop;
    };

    requestAnimationFrame(() => {
      if (last.sender === "ai" && lastAiRef.current) {
        const top = getTopWithinScroller(lastAiRef.current, scroller);
        scroller.scrollTo({ top: Math.max(top - 16, 0), behavior: "instant" });

        const ro = new ResizeObserver(() => {
          const t = getTopWithinScroller(lastAiRef.current, scroller);
          scroller.scrollTo({ top: Math.max(t - 16, 0) });
        });
        ro.observe(lastAiRef.current);
        return () => ro.disconnect();
      } else {
        scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
      }
    });
  }, [messages, loading]);

  useEffect(() => {
    textareaRef.current?.focus();
    resizeTextarea();
  }, []);

  // ===== TTS playback helpers (interruptible) =====
  const stopTTS = () => {
    try {
      if (currentAudioRef.current) {
        try { currentAudioRef.current.pause(); } catch (e) {}
        try { currentAudioRef.current.src = ""; } catch (e) {}
        currentAudioRef.current = null;
      }
      if (currentAudioUrlRef.current) {
        try { URL.revokeObjectURL(currentAudioUrlRef.current); } catch (e) {}
        currentAudioUrlRef.current = null;
      }
    } catch (e) {
      console.warn("stopTTS error", e);
    } finally {
      setBotSpeaking(false);
      monitoringModeRef.current = "normal";
    }
  };

  const playTTS = async (text) => {
    try {
      // Make sure any existing TTS is stopped
      stopTTS();

      setBotSpeaking(true);
      // set monitoring mode: during playback we still monitor for loud user speech but require higher threshold
      monitoringModeRef.current = "duringPlayback";

      const res = await fetch("https://trying-cloud-embedding-again.onrender.com/tts?text=" + encodeURIComponent(text));
      if (!res.ok) throw new Error("TTS fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      currentAudioUrlRef.current = url;
      const audio = new Audio(url);
      audio.autoplay = false;
      audio.playsInline = true;
      audio.volume = 1.0;
      currentAudioRef.current = audio;

      audio.onended = () => {
        // restore monitoring mode
        monitoringModeRef.current = "normal";
        setBotSpeaking(false);
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        if (currentAudioUrlRef.current) {
          try { URL.revokeObjectURL(currentAudioUrlRef.current); } catch (e) {}
          currentAudioUrlRef.current = null;
        }
      };

      audio.onplay = () => setBotSpeaking(true);

      try {
        const p = audio.play();
        if (p && p instanceof Promise) {
          await p.catch((err) => {
            console.error("audio.play() rejected:", err);
            monitoringModeRef.current = "normal";
            setBotSpeaking(false);
          });
        }
      } catch (err) {
        console.error("TTS play failed:", err);
        monitoringModeRef.current = "normal";
        setBotSpeaking(false);
      }
    } catch (e) {
      console.error("playTTS error:", e);
      monitoringModeRef.current = "normal";
      setBotSpeaking(false);
    }
  };

  // ---------- Audio monitoring / silence detection helpers ----------
  // startAudioMonitor returns a stop function. onSoundLevel(level) called each tick.
  const startAudioMonitorCore = async (stream) => {
    try {
      // create AudioContext and analyser
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);

      // set up analyser for time domain
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      source.connect(analyser);

      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;

      const smoothingAlpha = 0.08; // for RMS smoothing
      const speakHoldMs = 120; // need 120ms above threshold to count as start of speech
      const silenceForUtteranceMs = 800; // 0.8s silence triggers STT send

      const poll = () => {
        try {
          analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
          let sum = 0;
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            const v = (dataArrayRef.current[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / dataArrayRef.current.length);

          // smooth RMS (exponential)
          smoothedRmsRef.current = smoothedRmsRef.current * (1 - smoothingAlpha) + rms * smoothingAlpha;

          // update orb level (scaled)
          const scaled = Math.max(0, Math.min(1, smoothedRmsRef.current * 12)); // empirical scale
          smoothedOrbRef.current = smoothedOrbRef.current * 0.85 + scaled * 0.15;
          setVoiceOrbLevel(smoothedOrbRef.current);

          const now = performance.now();

          // choose threshold depending on monitoring mode
          const threshold = monitoringModeRef.current === "duringPlayback" ? PLAYBACK_INTERRUPT_THRESHOLD : BASE_VOICE_THRESHOLD;

          // VAD: start detection when RMS stays above threshold for speakHoldMs
          if (smoothedRmsRef.current >= threshold) {
            if (!vadAboveStartRef.current) vadAboveStartRef.current = now;
            vadBelowStartRef.current = 0;
            // if sustained above for hold time, mark user speaking
            if (!userSpeakingRef.current && now - vadAboveStartRef.current > speakHoldMs) {
              userSpeakingRef.current = true;
              // start recording if not already
              if (!isRecording) {
                // if bot is speaking, this is user interrupt -> stop TTS and start recording
                if (botSpeaking) {
                  stopTTS();
                }
                startVoiceRecording(stream);
              }
            }
          } else {
            // below threshold
            if (!vadBelowStartRef.current) vadBelowStartRef.current = now;
            if (vadAboveStartRef.current) vadAboveStartRef.current = 0;
            // if we are currently speaking and silence has lasted silenceForUtteranceMs -> finalize utterance
            if (userSpeakingRef.current && now - vadBelowStartRef.current > silenceForUtteranceMs) {
              // mark last utterance timestamp
              lastUtteranceAtRef.current = now;
              userSpeakingRef.current = false;
              // stop recording and send STT
              if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                try { mediaRecorderRef.current.stop(); } catch (e) { console.warn("stop recorder error", e); }
              } else {
                // if not using MediaRecorder for some reason, we can fallback to sending smaller buffer - but we'll rely on MediaRecorder
              }
            }
          }

        } catch (e) {
          console.warn("monitor poll error", e);
        }
        continuousRafRef.current = requestAnimationFrame(poll);
      };

      continuousRafRef.current = requestAnimationFrame(poll);

      // stop function
      return () => {
        try {
          if (continuousRafRef.current) cancelAnimationFrame(continuousRafRef.current);
          continuousRafRef.current = null;
          if (analyserRef.current) try { analyserRef.current.disconnect(); } catch (e) {}
          analyserRef.current = null;
          if (audioCtxRef.current) try { audioCtxRef.current.close(); } catch (e) {}
          audioCtxRef.current = null;
        } catch (e) {
          console.warn("stop monitor cleanup", e);
        }
      };
    } catch (e) {
      console.warn("startAudioMonitorCore error", e);
      return () => {};
    }
  };

  // ---------- continuous "always-on" mic for voice mode ----------
  const startContinuousListening = async () => {
    try {
      // request mic with some helpful constraints
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      // Prepare MediaRecorder for capturing segments on-demand (we will create a fresh MediaRecorder when user starts speaking)
      // But we still use MediaRecorder only when user speaking is detected. The analyser uses the stream for VAD.
      // start monitor core
      if (audioMonitorRef.current) {
        audioMonitorRef.current();
        audioMonitorRef.current = null;
      }
      audioMonitorRef.current = await startAudioMonitorCore(stream);
    } catch (e) {
      console.error("startContinuousListening error", e);
      setMessages((prev) => [...prev, { sender: "ai", text: "⚠️ Microphone access denied or unavailable." }]);
    }
  };

  const stopContinuousListening = () => {
    try {
      // stop monitor
      if (audioMonitorRef.current) {
        try { audioMonitorRef.current(); } catch (e) {}
        audioMonitorRef.current = null;
      }
      // stop stream tracks
      try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch (e) {}
      streamRef.current = null;
      // cleanup audioctx
      try { if (audioCtxRef.current) audioCtxRef.current.close(); } catch (e) {}
      audioCtxRef.current = null;
      analyserRef.current = null;
      dataArrayRef.current = null;
      if (continuousRafRef.current) {
        try { cancelAnimationFrame(continuousRafRef.current); } catch (e) {}
        continuousRafRef.current = null;
      }
      smoothedRmsRef.current = 0;
      setVoiceOrbLevel(0);
    } catch (e) {
      console.warn("stopContinuousListening error", e);
    }
  };

  // ---------- start/stop a MediaRecorder when user starts speaking ----------
  const startVoiceRecording = (stream) => {
    try {
      // Create a fresh MediaRecorder to capture user's utterance
      let options = { mimeType: "audio/webm;codecs=opus" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "audio/webm" };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = {};
      }
      audioChunksRef.current = [];
      // prefer using the already-open streamRef if available
      const recStream = stream || streamRef.current;
      if (!recStream) {
        console.warn("no stream to record from");
        return;
      }
      const mr = new MediaRecorder(recStream, options);
      mediaRecorderRef.current = mr;

      mr.onstart = () => {
        setIsRecording(true);
      };
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        setIsRecording(false);
        // cleanup VAD timers
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
        // form blob and send to your STT endpoint
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
        const formData = new FormData();
        formData.append("file", blob, "recording.webm");

        try {
          const res = await fetch("https://trying-cloud-embedding-again.onrender.com/stt", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          console.log("STT response (voice view):", data);

          if (data.text) {
            // send voice transcript directly to bot (voice-only path)
            sendBotMessageDirect(data.text);
          } else {
            setMessages((prev) => [...prev, { sender: "ai", text: "⚠️ Could not transcribe audio." }]);
          }
        } catch (err) {
          console.error("Voice STT error:", err);
          setMessages((prev) => [...prev, { sender: "ai", text: "⚠️ Error sending audio to server." }]);
        } finally {
          audioChunksRef.current = [];
        }
      };

      mr.start();
    } catch (e) {
      console.error("startVoiceRecording error", e);
    }
  };

  const stopVoiceRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch (e) {
      console.warn("stopVoiceRecording error", e);
    }
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch (e) {}
    // do not null streamRef here — continuous listener controls it
    setIsRecording(false);
  };

  // ===== NEW: dictation recording (transcribe into input box only) with silence auto-stop =====
  const toggleDictation = async () => {
    if (isDictating) {
      // stop dictation
      stopDictationRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamDictRef.current = stream;

      let options = { mimeType: "audio/webm;codecs=opus" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: "audio/webm" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) options = {};

      audioChunksDictRef.current = [];
      const mr = new MediaRecorder(stream, options);
      mediaRecorderDictRef.current = mr;

      mr.onstart = () => {
        setIsDictating(true);
      };
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksDictRef.current.push(e.data);
      };
      mr.onstop = async () => {
        // cleanup monitor
        if (audioMonitorDictRef.current) {
          audioMonitorDictRef.current();
          audioMonitorDictRef.current = null;
        }
        if (silenceTimeoutDictRef.current) {
          clearTimeout(silenceTimeoutDictRef.current);
          silenceTimeoutDictRef.current = null;
        }

        const blob = new Blob(audioChunksDictRef.current, { type: mr.mimeType || "audio/webm" });
        const fd = new FormData();
        fd.append("file", blob, "dictation.webm");

        try {
          const res = await fetch("https://trying-cloud-embedding-again.onrender.com/stt", { method: "POST", body: fd });
          if (!res.ok) throw new Error("Transcription failed");
          const data = await res.json();

          if (data.text) {
            // append transcript into textarea for editing
            setInput((prev) => (prev && prev.trim() ? prev + " " + data.text : data.text));
            requestAnimationFrame(resizeTextarea);
            textareaRef.current?.focus();
            setLastWasVoice(true);
          } else {
            setMessages((prev) => [...prev, { sender: "ai", text: "⚠️ Could not transcribe audio." }]);
          }
        } catch (err) {
          console.error("Dictation STT error:", err);
          setMessages((prev) => [...prev, { sender: "ai", text: "⚠️ Error transcribing dictation." }]);
        } finally {
          audioChunksDictRef.current = [];
          try { streamDictRef.current?.getTracks().forEach((t) => t.stop()); } catch (e) {}
          streamDictRef.current = null;
          setIsDictating(false);
        }
      };

      // start silence monitor for dictation
      // reuse simple approach: auto-stop when 1s of silence after speech
      const dictAnalyzer = await (async () => {
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 2048;
          source.connect(analyser);
          const bufferLength = analyser.fftSize;
          const dataArray = new Uint8Array(bufferLength);

          let raf = null;
          const threshold = 0.01;
          const smoothing = 0.05;
          let smooth = 0;

          const poll = () => {
            analyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const v = (dataArray[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            smooth = smooth * (1 - smoothing) + rms * smoothing;
            if (smooth > threshold) {
              if (silenceTimeoutDictRef.current) {
                clearTimeout(silenceTimeoutDictRef.current);
                silenceTimeoutDictRef.current = null;
              }
              silenceTimeoutDictRef.current = setTimeout(() => {
                try {
                  if (mediaRecorderDictRef.current && mediaRecorderDictRef.current.state !== "inactive") {
                    mediaRecorderDictRef.current.stop();
                  } else {
                    stopDictationRecording();
                  }
                } catch (e) {
                  stopDictationRecording();
                }
              }, 1000);
            }
            raf = requestAnimationFrame(poll);
          };
          raf = requestAnimationFrame(poll);

          return () => {
            try { if (raf) cancelAnimationFrame(raf); } catch (e) {}
            try { analyser.disconnect(); } catch (e) {}
            try { audioCtx.close(); } catch (e) {}
          };
        } catch (e) {
          return () => {};
        }
      })();

      audioMonitorDictRef.current = dictAnalyzer;

      mr.start();
    } catch (err) {
      console.error("Dictation start failed:", err);
      let errorMsg = "⚠️ Microphone access denied or unavailable.";
      if (err.name === "NotAllowedError") errorMsg = "⚠️ Permission denied. Please allow microphone access.";
      else if (err.name === "NotFoundError") errorMsg = "⚠️ No microphone found. Please connect one.";
      else if (err.name === "NotReadableError") errorMsg = "⚠️ Microphone is in use by another app.";
      else if (err.name === "SecurityError") errorMsg = "⚠️ Access blocked due to insecure context (use HTTPS or localhost).";

      setMessages((prev) => [...prev, { sender: "ai", text: errorMsg }]);
    }
  };

  const stopDictationRecording = () => {
    try {
      if (mediaRecorderDictRef.current && mediaRecorderDictRef.current.state !== "inactive") {
        mediaRecorderDictRef.current.stop();
      }
    } catch (e) {
      console.warn("stopDictationRecording error", e);
    }
    try { streamDictRef.current?.getTracks().forEach((t) => t.stop()); } catch (e) {}
    if (audioMonitorDictRef.current) { audioMonitorDictRef.current(); audioMonitorDictRef.current = null; }
    if (silenceTimeoutDictRef.current) { clearTimeout(silenceTimeoutDictRef.current); silenceTimeoutDictRef.current = null; }
    setIsDictating(false);
  };

  // ---------- textarea auto-resize helper ----------
  const resizeTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const max = 300; // px
    ta.style.height = Math.min(ta.scrollHeight, max) + "px";
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
      const rawAnswer = data.answer || "Sorry, I could not find an answer.";
      const displayText = cleanForDisplay(rawAnswer);
      const aiMessage = {
        sender: "ai",
        text: displayText,
      };

      // typed input -> show chatbot bubble
      setMessages((prev) => [...prev, aiMessage]);

      // 🚫 no TTS for text input
    } catch (e) {
      setMessages((prev) => [...prev, { sender: "ai", text: `⚠️ ${e.message}` }]);
    }

    setInput("");
    resizeTextarea();
    setLoading(false);
    textareaRef.current?.focus();
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
      playTTS(stripMarkdownForSpeech(aiMessage));

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
      const res = await fetch("https://trying-cloud-embedding-again.onrender.com/live/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "X-Client-Domain": clientDomain,
          "X-Session-Id": sessionId,
        },
        body: JSON.stringify({ requested_by_contact: null }),
      });
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
          const mapped = history.filter((r) => r.sender_type === "executive").map((r) => ({ sender: "ai", text: cleanForDisplay(r.message || "") }));
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
            setMessages((prev) => [...prev, { sender: "ai", text: cleanForDisplay(row.message || "") }]);
          }
        )
        .subscribe();

      channelRef.current = ch;
      setLiveMode(true);
      setMessages((prev) => [...prev, { sender: "ai", text: "Connecting you to a human agent..." }]);
    } catch (e) {
      setMessages((prev) => [...prev, { sender: "ai", text: `⚠️ ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const sendLiveMessage = async () => {
    if (!input.trim() || !supaRef.current || !conversationId) return;
    const text = input.trim();

    setMessages((prev) => [...prev, { sender: "user", text }]);
    setInput("");
    resizeTextarea();

    const { error } = await supaRef.current.from("live_messages").insert({
      conversation_id: conversationId,
      sender_type: "visitor",
      message: text,
    }).select("*");

    if (error) {
      setMessages((prev) => [...prev, { sender: "ai", text: `⚠️ ${error.message}` }]);
    }
  };

  const onSend = async () => {
    if (liveMode) return sendLiveMessage();
    return sendBotMessage();
  };

  // When switching into voice view, start continuous listening automatically
  useEffect(() => {
    if (viewMode === "voice") {
      // initialize continuous listening
      startContinuousListening();
    } else {
      // stop continuous listener when leaving voice view
      stopContinuousListening();
      // also stop any TTS playback
      stopTTS();
    }

    // cleanup on unmount
    return () => {
      stopContinuousListening();
      stopTTS();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // simple inline waveform SVG (compact, accessible)
  const WaveformIcon = ({ className = "w-4 h-4", title = "waveform" }) => (
    <svg
      aria-hidden="true"
      role="img"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <title>{title}</title>
      <path d="M2 12h2v4h2v-8h2v12h2V6h2v16h2V4h2v10h2v-6h2" />
    </svg>
  );

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
            <h2 className="text-2xl font-bold text-voice-foreground">{botName}</h2>
          </div>
          <p className="text-sm text-voice-foreground/70 font-medium">Voice Conversation</p>
        </div>

        {/* Main Voice Interface */}
        <div className="flex flex-col items-center justify-center flex-1 z-10">
          {/* CHATGPT-like orb */}
          <div className="mb-6">
            <div
              aria-hidden
              className="relative w-32 h-32 rounded-full flex items-center justify-center"
              style={{
                // animated gradient + scale based on orb level
                background: `radial-gradient(circle at 30% 30%, rgba(79,70,229,${0.35 + voiceOrbLevel * 0.4}), transparent 30%), radial-gradient(circle at 70% 70%, rgba(99,102,241,${0.2 + voiceOrbLevel * 0.3}), transparent 40%)`,
                boxShadow: `0 8px ${20 + voiceOrbLevel * 30}px rgba(79,70,229,${0.08 + voiceOrbLevel * 0.12})`,
                transform: `scale(${1 + voiceOrbLevel * 0.06})`,
                transition: "transform 120ms linear, box-shadow 160ms linear",
              }}
            >
              {/* inner animated ripples */}
              <div
                style={{
                  position: "absolute",
                  width: `${60 + voiceOrbLevel * 30}px`,
                  height: `${60 + voiceOrbLevel * 30}px`,
                  borderRadius: "50%",
                  opacity: 0.08 + voiceOrbLevel * 0.5,
                  transform: `translateZ(0)`,
                  transition: "width 160ms linear, height 160ms linear, opacity 160ms linear",
                  background: "radial-gradient(circle, rgba(255,255,255,0.12), rgba(255,255,255,0.02))",
                }}
              />
              <div className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#6d28d9,#4f46e5)", boxShadow: "inset 0 -6px 14px rgba(0,0,0,0.15)" }}>
                <Mic className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          {/* Instruction + status */}
          <div className="text-center max-w-sm">
            {botSpeaking ? (
              <div className="space-y-2">
                <div className="text-xl font-semibold text-voice-foreground">AI is speaking</div>
                <div className="text-sm text-voice-foreground/70">You can interrupt by speaking.</div>
              </div>
            ) : isRecording ? (
              <div className="space-y-2">
                <div className="text-xl font-semibold text-voice-foreground">Listening</div>
                <div className="text-sm text-voice-foreground/70">Speak now — will stop automatically after 0.8s of silence</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xl font-semibold text-voice-foreground">Ready to listen</div>
                <div className="text-sm text-voice-foreground/70">Speak at any time — the mic is always on</div>
              </div>
            )}
          </div>

          {/* Simple Audio Visualization */}
          {(isRecording || botSpeaking) && (
            <div className="flex items-center gap-1 mt-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`w-2 rounded-full opacity-80`}
                  style={{
                    height: `${10 + voiceOrbLevel * 40 * (i / 5)}px`,
                    background: botSpeaking ? "linear-gradient(180deg,#eab308,#f97316)" : "linear-gradient(180deg,#7c3aed,#4f46e5)",
                    transition: "height 120ms linear",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Back Button */}
        <div className="absolute bottom-6 z-10">
          <Button variant="chat-outline" size="default" onClick={() => setViewMode("text")} className="px-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Button>
        </div>
      </div>
    );
  }

  // Text Mode UI
  return (
    <Card className="w-full h-full flex flex-col min-h-0 overflow-hidden shadow-elegant bg-gradient-subtle border-0">
      {/* Modern Header */}
      <div className="relative px-6 py-4 bg-gradient-primary text-white overflow-hidden" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)` }}>
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
            <Button variant="chat-outline" size="sm" onClick={startHumanHandoff} disabled={loading} className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white hover:text-primary">
              <PhoneCall className="w-4 h-4" />
              Human Agent
            </Button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <CardContent className="flex-1 min-h-0 p-0">
        <div ref={scrollRef} className="h-full overflow-y-auto bg-chat-background overscroll-contain scroll-pb-28">
          <div className="p-6 space-y-6">
            {messages.length === 0 && (
              <div className="text-center py-12 animate-fade-in">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center shadow-glow bg-[linear-gradient(135deg,_hsl(var(--primary)),_hsl(292_84%_61%))]">
                  <WaveformIcon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Welcome to {botName}!</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  I'm here to help you with any questions about this website or company. Feel free to ask me anything!
                </p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-4 animate-slide-up ${msg.sender === "user" ? "justify-end" : "justify-start"}`} style={{ animationDelay: `${idx * 50}ms` }} ref={idx === messages.length - 1 && msg.sender === "ai" ? lastAiRef : null}>
                {msg.sender !== "user" && (
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}

                <div className={`max-w-[85%] px-4 py-3 rounded-2xl shadow-sm backdrop-blur-sm transition-all duration-200 hover:shadow-md ${msg.sender === "user" ? "bg-chat-user text-chat-user-foreground rounded-br-md shadow-glow" : "bg-chat-bot text-chat-bot-foreground border border-border/50 rounded-bl-md"}`}>
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
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="bg-chat-bot border border-border/50 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-3 shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">{liveMode ? "Agent is typing..." : "Thinking..."}</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>
      </CardContent>

      {/* Modern Input Area */}
      <div className="p-6 border-t border-border/50 bg-gradient-subtle backdrop-blur-sm">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
              placeholder={liveMode ? "Type your message to the agent..." : "Ask me anything about this company..."}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              className="w-full resize-none rounded-xl p-3 bg-white/90 border-border/50 focus:border-primary/50 focus:ring-primary/20 shadow-sm transition-all duration-200 text-sm leading-relaxed"
              style={{ minHeight: 56, maxHeight: 300, overflow: "auto" }}
            />
          </div>

          <button onClick={onSend} disabled={!input.trim() || loading} title="Send message" className="flex items-center justify-center h-12 px-6 rounded-xl bg-primary text-white hover:scale-105 transition-transform">
            <Send className="w-4 h-4" />
          </button>

          {/* DICTATE BUTTON: different symbol (Sparkles) so it's visually distinct */}
          <button
            onClick={toggleDictation}
            title={isDictating ? "Stop dictation" : "Dictate (adds text to input)"}
            className={`flex items-center justify-center h-12 px-3 rounded-lg border ${isDictating ? "bg-amber-600 text-white border-amber-600" : "bg-amber-100 text-amber-800 border-amber-200"} hover:scale-105 transition-transform`}
            style={{ minWidth: 44 }}
          >
            <span className="relative flex items-center justify-center">
              <WaveformIcon className="w-4 h-4" title={isDictating ? "Dictating" : "Dictate"} />
              {isDictating && <span className="absolute -right-1 -top-1 w-2 h-2 rounded-full bg-white/90 animate-pulse" />}
            </span>
          </button>

          {/* VOICE-ONLY MODE BUTTON: distinct round ChatGPT-like UI */}
          <button
            onClick={() => setViewMode("voice")}
            title="Open voice-only mode"
            className="flex items-center justify-center h-12 w-12 rounded-full bg-voice-primary text-white hover:scale-105 transition-transform"
            style={{ boxShadow: "0 6px 18px rgba(79,70,229,0.12)" }}
          >
            <Mic className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3 text-xs text-center text-muted-foreground">
          {liveMode ? (
            "Connected to live support"
          ) : (
            `Powered by ${botName} • Click the round mic for voice chat or the waveform mic to dictate into the input`
          )}
        </div>
      </div>
    </Card>
  );
}
