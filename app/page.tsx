"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { SCENARIOS } from "@/lib/prompts";
import {
  useFinishTTS,
  useSpeechRecognition,
  extractFinnishPhrases,
} from "@/lib/speech";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ─── Sub-components ───

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 6, padding: "8px 0", alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--text-muted)",
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function FinnishWord({
  word,
  onSpeak,
  isPlaying,
}: {
  word: string;
  onSpeak: (text: string) => void;
  isPlaying: boolean;
}) {
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        onSpeak(word);
      }}
      style={{
        fontWeight: 600,
        color: "var(--finnish)",
        fontStyle: "italic",
        cursor: "pointer",
        borderBottom: "1px dotted rgba(139, 164, 190, 0.35)",
        transition: "all 0.15s ease",
        background: isPlaying ? "var(--accent-soft)" : "transparent",
        borderRadius: isPlaying ? 3 : 0,
        padding: isPlaying ? "1px 3px" : 0,
      }}
      title="Click to hear pronunciation"
    >
      {word}
    </span>
  );
}

function MessageBubble({
  message,
  tts,
  autoSpeak,
}: {
  message: Message;
  tts: ReturnType<typeof useFinishTTS>;
  autoSpeak: boolean;
}) {
  const isUser = message.role === "user";
  const hasAutoSpoken = useRef(false);

  useEffect(() => {
    if (!isUser && autoSpeak && !hasAutoSpoken.current && message.content) {
      hasAutoSpoken.current = true;
      const timer = setTimeout(() => {
        tts.speakFinnishFromMessage(message.content);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const renderContent = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const word = part.slice(2, -2);
        return (
          <FinnishWord
            key={i}
            word={word}
            onSpeak={tts.speakOne}
            isPlaying={tts.currentPhrase === word}
          />
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 16,
        animation: "fadeInUp 0.3s ease",
      }}
    >
      <div
        style={{
          maxWidth: "82%",
          padding: "14px 18px",
          borderRadius: isUser ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
          background: isUser ? "var(--user-bubble)" : "var(--ai-bubble)",
          color: isUser ? "var(--user-text)" : "var(--ai-text)",
          fontSize: 15,
          lineHeight: 1.7,
          letterSpacing: "0.01em",
          border: isUser ? "none" : "1px solid var(--border)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {!isUser && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--accent)",
                fontFamily: "var(--font-body)",
              }}
            >
              Aino
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {extractFinnishPhrases(message.content).length > 0 && (
                <button
                  onClick={() => tts.speakFinnishFromMessage(message.content)}
                  title="Hear Finnish phrases"
                  style={{
                    background: "none",
                    border: "none",
                    color: tts.speaking
                      ? "var(--speaker-active)"
                      : "var(--text-muted)",
                    fontSize: 13,
                    padding: "2px 6px",
                    opacity: tts.speaking ? 1 : 0.65,
                    transition: "all 0.15s ease",
                    borderRadius: 4,
                  }}
                >
                  {tts.speaking ? "■" : "🇫🇮"}
                </button>
              )}
              <button
                onClick={() => tts.speakFullMessage(message.content)}
                title="Hear full message"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: 13,
                  padding: "2px 6px",
                  opacity: 0.65,
                  transition: "all 0.15s ease",
                  borderRadius: 4,
                }}
              >
                ▶
              </button>
            </div>
          </div>
        )}
        <div>{renderContent(message.content)}</div>
      </div>
    </div>
  );
}

// ─── Main Page ───

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState("free");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [sttLang, setSttLang] = useState("fi-FI");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const tts = useFinishTTS();

  const handleVoiceResult = useCallback((transcript: string) => {
    setInput((prev) => (prev ? prev + " " + transcript : transcript));
  }, []);

  const stt = useSpeechRecognition({
    onResult: handleVoiceResult,
    lang: sttLang,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const sendToAPI = async (conversationMessages: Message[]) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversationMessages }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.text },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Anteeksi — I had a technical hiccup there. Could you try again?",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = (scenarioId: string) => {
    setStarted(true);
    setSelectedScenario(scenarioId);
    const scenario = SCENARIOS.find((s) => s.id === scenarioId);
    if (scenario?.prompt) {
      const userMsg: Message = { role: "user", content: scenario.prompt };
      setMessages([userMsg]);
      sendToAPI([userMsg]);
    } else {
      const introMsg: Message = {
        role: "user",
        content:
          "Moi! I'm Vonny — I'm a musician from Glasgow, Scotland. I play in a doom metal band called Cwfen and we tour in Finland sometimes. I want to learn Finnish! I know some very basics — moi, kiitos, a few numbers. Let's start chatting.",
      };
      setMessages([introMsg]);
      sendToAPI([introMsg]);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    if (stt.listening) stt.stop();
    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    sendToAPI(newMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    tts.stop();
    if (stt.listening) stt.stop();
    setMessages([]);
    setStarted(false);
    setSelectedScenario("free");
    setInput("");
  };

  // ─── Welcome screen ───
  if (!started) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle grain texture */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.025,
            pointerEvents: "none",
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, currentColor 2px, currentColor 3px)",
          }}
        />

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            background: "none",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            padding: "6px 16px",
            borderRadius: 20,
            fontSize: 12,
            letterSpacing: "0.03em",
          }}
        >
          {theme === "dark" ? "☀ Päivä" : "☽ Yö"}
        </button>

        <div
          style={{
            textAlign: "center",
            maxWidth: 520,
            zIndex: 1,
            animation: "fadeInUp 0.6s ease",
          }}
        >
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "var(--accent)",
              marginBottom: 28,
              fontFamily: "var(--font-body)",
              fontWeight: 500,
            }}
          >
            Puhutaan suomea
          </div>

          <h1
            style={{
              fontSize: 52,
              fontWeight: 400,
              margin: "0 0 8px 0",
              letterSpacing: "-0.03em",
              lineHeight: 1,
              fontFamily: "var(--font-display)",
            }}
          >
            Aino
          </h1>
          <p
            style={{
              fontSize: 17,
              color: "var(--text-muted)",
              margin: "0 0 14px 0",
              fontStyle: "italic",
              fontFamily: "var(--font-display)",
            }}
          >
            Your Finnish conversation partner
          </p>

          <div
            style={{
              display: "flex",
              gap: 20,
              justifyContent: "center",
              marginBottom: 40,
              fontSize: 12,
              color: "var(--text-muted)",
            }}
          >
            <span>🔊 She speaks Finnish</span>
            <span>🎤 You speak back</span>
            <span>💬 Natural chat</span>
          </div>

          <p
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: "var(--text-muted)",
              marginBottom: 36,
            }}
          >
            Choose a scenario to begin, or start a free conversation.
            <br />
            Click any{" "}
            <span
              style={{
                color: "var(--finnish)",
                fontStyle: "italic",
                fontWeight: 500,
              }}
            >
              Finnish word
            </span>{" "}
            to hear it spoken.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => handleStart(s.id)}
                style={{
                  background: "var(--surface-alt)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "16px 14px",
                  color: "var(--text)",
                  textAlign: "left",
                  fontSize: 14,
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "var(--accent)";
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--accent-soft)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "var(--border)";
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--surface-alt)";
                }}
              >
                <span style={{ fontSize: 20 }}>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Chat screen ───
  const visibleMessages = messages.filter((m) => {
    const sc = SCENARIOS.find((s) => s.id === selectedScenario);
    if (m.role === "user" && sc?.prompt && m.content === sc.prompt) return false;
    if (
      m.role === "user" &&
      m.content.startsWith("Moi! I'm Vonny") &&
      messages.indexOf(m) === 0
    )
      return false;
    return true;
  });

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--surface)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={handleReset}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              fontSize: 18,
              padding: "2px 6px",
            }}
            title="New conversation"
          >
            ←
          </button>
          <div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 500,
                fontFamily: "var(--font-display)",
              }}
            >
              Aino
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {SCENARIOS.find((s) => s.id === selectedScenario)?.label ||
                "Free chat"}{" "}
              · Finnish tutor
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Auto-speak toggle */}
          <button
            onClick={() => setAutoSpeak(!autoSpeak)}
            style={{
              background: autoSpeak ? "var(--accent-soft)" : "none",
              border: "1px solid var(--border)",
              color: autoSpeak ? "var(--accent)" : "var(--text-muted)",
              padding: "4px 12px",
              borderRadius: 16,
              fontSize: 11,
              transition: "all 0.15s ease",
            }}
            title={
              autoSpeak
                ? "Auto-speak Finnish: ON"
                : "Auto-speak Finnish: OFF"
            }
          >
            🔊 {autoSpeak ? "On" : "Off"}
          </button>

          {/* STT language toggle */}
          <button
            onClick={() =>
              setSttLang(sttLang === "fi-FI" ? "en-GB" : "fi-FI")
            }
            style={{
              background: "none",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              padding: "4px 12px",
              borderRadius: 16,
              fontSize: 11,
            }}
            title="Switch speech recognition language"
          >
            🎤 {sttLang === "fi-FI" ? "FI" : "EN"}
          </button>

          {/* Theme */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              padding: "4px 12px",
              borderRadius: 16,
              fontSize: 11,
            }}
          >
            {theme === "dark" ? "☀" : "☽"}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 20px 8px 20px",
        }}
      >
        {visibleMessages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            tts={tts}
            autoSpeak={autoSpeak}
          />
        ))}
        {isLoading && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderRadius: "20px 20px 20px 4px",
                background: "var(--ai-bubble)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--accent)",
                  marginBottom: 4,
                }}
              >
                Aino
              </div>
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          padding: "12px 16px 16px 16px",
          borderTop: "1px solid var(--border)",
          background: "var(--surface)",
          flexShrink: 0,
        }}
      >
        {/* Scenario quick-switch */}
        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 10,
            overflowX: "auto",
            paddingBottom: 2,
          }}
        >
          {SCENARIOS.filter((s) => s.id !== "free" && s.prompt).map((sc) => (
            <button
              key={sc.id}
              onClick={() => {
                if (isLoading) return;
                setSelectedScenario(sc.id);
                const userMsg: Message = {
                  role: "user",
                  content: sc.prompt!,
                };
                const newMsgs = [...messages, userMsg];
                setMessages(newMsgs);
                sendToAPI(newMsgs);
              }}
              style={{
                background: "var(--accent-soft)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: "5px 12px",
                color: "var(--text-muted)",
                fontSize: 12,
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "var(--accent)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--text)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--text-muted)";
              }}
              disabled={isLoading}
            >
              {sc.icon} {sc.label}
            </button>
          ))}
        </div>

        {/* Input row */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          {/* Mic button */}
          {stt.supported && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <button
                onClick={stt.toggle}
                disabled={isLoading && !stt.listening}
                style={{
                  background: stt.listening
                    ? "var(--mic-active-bg)"
                    : "none",
                  border: `2px solid ${stt.listening ? "var(--mic-active)" : "var(--border)"}`,
                  borderRadius: "50%",
                  width: 44,
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                  color: stt.listening
                    ? "var(--mic-active)"
                    : "var(--text-muted)",
                  fontSize: 18,
                  animation: stt.listening
                    ? "micPulse 1.5s ease-in-out infinite"
                    : "none",
                  flexShrink: 0,
                }}
                title={stt.listening ? "Stop recording" : "Start speaking"}
              >
                {stt.listening ? "●" : "🎤"}
              </button>
              {stt.interim && (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    fontStyle: "italic",
                    maxWidth: 160,
                    textAlign: "center",
                    lineHeight: 1.3,
                    animation: "fadeInUp 0.2s ease",
                  }}
                >
                  {stt.interim}...
                </div>
              )}
            </div>
          )}

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Kirjoita tai puhu... (Type or speak)"
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1,
              background: "var(--input-bg)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: "12px 16px",
              color: "var(--text)",
              fontSize: 15,
              fontFamily: "var(--font-body)",
              resize: "none",
              lineHeight: 1.5,
              maxHeight: 120,
              transition: "border-color 0.2s ease",
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
          />

          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            style={{
              background:
                input.trim() && !isLoading
                  ? "var(--accent)"
                  : "var(--surface-alt)",
              border: "none",
              borderRadius: "50%",
              width: 44,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              flexShrink: 0,
              color:
                input.trim() && !isLoading ? "#fff" : "var(--text-muted)",
              fontSize: 18,
            }}
          >
            ↑
          </button>
        </div>

        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            textAlign: "center",
            marginTop: 8,
            letterSpacing: "0.02em",
          }}
        >
          {stt.supported
            ? "🎤 Tap mic to speak · Click Finnish words to hear them · Shift+Enter for new line"
            : "Click Finnish words to hear them · Shift+Enter for new line"}
        </div>
      </div>
    </div>
  );
}
