"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { SCENARIOS, STORY_LEVELS } from "@/lib/prompts";
import {
  useFinishTTS,
  useSpeechRecognition,
  extractFinnishPhrases,
} from "@/lib/speech";
import { createVocabStore } from "@/lib/vocab";

interface Message {
  role: "user" | "assistant";
  content: string;
  isStory?: boolean;
}

// ─── Sub-components ───

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 6, padding: "8px 0", alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: "var(--text-muted)",
          animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// Finnish word with hover-to-translate and click-to-speak
function FinnishWord({
  word,
  translation,
  onSpeak,
  isPlaying,
}: {
  word: string;
  translation?: string;
  onSpeak: (text: string) => void;
  isPlaying: boolean;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline" }}
      onMouseEnter={() => translation && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        onClick={(e) => { e.stopPropagation(); onSpeak(word); }}
        style={{
          fontWeight: 600,
          color: "var(--finnish)",
          fontStyle: "italic",
          cursor: "pointer",
          borderBottom: "1px dotted rgba(139, 164, 190, 0.35)",
          transition: "all 0.15s ease",
          background: isPlaying ? "var(--accent-soft)" : "transparent",
          borderRadius: isPlaying ? 3 : 0,
          padding: isPlaying ? "1px 3px" : "0",
        }}
        title={translation ? `${translation} · Click to hear` : "Click to hear"}
      >
        {word}
      </span>
      {showTooltip && translation && (
        <span style={{
          position: "absolute",
          bottom: "calc(100% + 6px)",
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "4px 10px",
          fontSize: 12,
          color: "var(--text)",
          whiteSpace: "nowrap",
          zIndex: 50,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          animation: "fadeInUp 0.15s ease",
          pointerEvents: "none",
        }}>
          {translation}
        </span>
      )}
    </span>
  );
}

// Story line component — click to hear the whole line
function StoryLine({
  line,
  tts,
  vocabStore,
}: {
  line: string;
  tts: ReturnType<typeof useFinishTTS>;
  vocabStore: ReturnType<typeof createVocabStore>;
}) {
  const handleLineClick = () => {
    // Strip emojis for cleaner TTS, keep Finnish words
    const cleanLine = line.replace(/[\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{200D}\u{20E3}]/gu, "").trim();
    if (cleanLine) tts.speakOne(cleanLine, true);
  };

  // Parse the line: make Finnish words clickable, keep emojis as-is
  const renderStoryLine = (text: string) => {
    // Split into words and emojis
    const tokens = text.split(/(\s+)/);
    return tokens.map((token, i) => {
      const trimmed = token.trim();
      if (!trimmed) return <span key={i}>{token}</span>;

      // Check if it's an emoji or punctuation
      const isEmoji = /^[\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{200D}\u{20E3}⬆️⬇️➡️⬛⬜🟫🟥]+$/u.test(trimmed);
      const isPunct = /^[.,!?:;"'…\-–—]+$/.test(trimmed);
      const isQuoted = /^[""].*[""]$/.test(trimmed);

      if (isEmoji || isPunct) return <span key={i}>{token}</span>;

      // Check if it's a Finnish word (starts with uppercase or is a known word)
      const wordLower = trimmed.replace(/[.,!?"":]/g, "").toLowerCase();
      const translation = vocabStore.getWordTranslation(wordLower);

      // For story mode, make all non-emoji words clickable for TTS
      const cleanWord = trimmed.replace(/["""]/g, "");
      if (cleanWord.length > 1 && !isEmoji) {
        return (
          <span key={i}>
            {trimmed.startsWith('"') || trimmed.startsWith('\u201C') ? '"' : ""}
            <FinnishWord
              word={cleanWord.replace(/[.,!?:]/g, "")}
              translation={translation || undefined}
              onSpeak={tts.speakOne}
              isPlaying={tts.currentPhrase === cleanWord.replace(/[.,!?:]/g, "")}
            />
            {/[.,!?:]$/.test(trimmed) ? trimmed.slice(-1) : ""}
            {trimmed.endsWith('"') || trimmed.endsWith('\u201D') ? '"' : ""}
          </span>
        );
      }

      return <span key={i}>{token}</span>;
    });
  };

  return (
    <div
      onClick={handleLineClick}
      style={{
        padding: "6px 10px",
        borderRadius: 8,
        cursor: "pointer",
        transition: "background 0.15s ease",
        fontSize: 16,
        lineHeight: 1.8,
        letterSpacing: "0.01em",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--accent-soft)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
      title="Click to hear this line"
    >
      {renderStoryLine(line)}
    </div>
  );
}

// Story message bubble with line-by-line display
function StoryBubble({
  message,
  tts,
  vocabStore,
}: {
  message: Message;
  tts: ReturnType<typeof useFinishTTS>;
  vocabStore: ReturnType<typeof createVocabStore>;
}) {
  const lines = message.content.split("\n").filter((l) => l.trim());
  const separatorIndex = lines.findIndex((l) => l.trim() === "---");
  const storyLines = separatorIndex >= 0 ? lines.slice(0, separatorIndex) : lines;
  const questionLines = separatorIndex >= 0 ? lines.slice(separatorIndex + 1) : [];

  return (
    <div style={{
      display: "flex", justifyContent: "flex-start",
      marginBottom: 16, animation: "fadeInUp 0.3s ease",
    }}>
      <div style={{
        maxWidth: "90%", padding: "16px 18px",
        borderRadius: "20px 20px 20px 4px",
        background: "var(--ai-bubble)",
        color: "var(--ai-text)",
        border: "1px solid var(--border)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 10,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.1em", color: "var(--accent)",
          }}>
            📚 Aino · Story
          </div>
          <button
            onClick={() => {
              if (tts.speaking) { tts.stop(); return; }
              const allText = storyLines.join(". ").replace(/[\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{200D}\u{20E3}]/gu, "");
              tts.speakFullMessage(allText);
            }}
            style={{
              background: "none", border: "none",
              color: tts.speaking ? "var(--speaker-active)" : "var(--text-muted)",
              fontSize: 13, padding: "2px 6px", cursor: "pointer",
            }}
          >
            {tts.speaking ? "■ Stop" : "▶ Listen"}
          </button>
        </div>

        {/* Story lines */}
        {storyLines.map((line, i) => (
          <StoryLine key={i} line={line} tts={tts} vocabStore={vocabStore} />
        ))}

        {/* Comprehension questions */}
        {questionLines.length > 0 && (
          <div style={{
            marginTop: 16, paddingTop: 14,
            borderTop: "1px solid var(--border)",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.1em", color: "var(--accent)", marginBottom: 8,
            }}>
              Ymmärsitkö? (Did you understand?)
            </div>
            {questionLines.map((line, i) => {
              if (!line.trim()) return null;
              return (
                <div key={i} style={{
                  padding: "6px 10px", fontSize: 15, lineHeight: 1.7,
                }}>
                  {renderTranslatableText(line, tts, vocabStore)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Render text with **word|translation** support
function renderTranslatableText(
  text: string,
  tts: ReturnType<typeof useFinishTTS>,
  vocabStore: ReturnType<typeof createVocabStore>
) {
  // Split on **word|translation** patterns
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      const pipeIndex = inner.indexOf("|");
      if (pipeIndex >= 0) {
        const word = inner.slice(0, pipeIndex);
        const translation = inner.slice(pipeIndex + 1);
        return (
          <FinnishWord
            key={i}
            word={word}
            translation={translation}
            onSpeak={tts.speakOne}
            isPlaying={tts.currentPhrase === word}
          />
        );
      }
      // No pipe — just a highlighted Finnish word
      return (
        <FinnishWord
          key={i}
          word={inner}
          translation={vocabStore.getWordTranslation(inner.toLowerCase()) || undefined}
          onSpeak={tts.speakOne}
          isPlaying={tts.currentPhrase === inner}
        />
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function MessageBubble({
  message,
  tts,
  autoSpeak,
  vocabStore,
}: {
  message: Message;
  tts: ReturnType<typeof useFinishTTS>;
  autoSpeak: boolean;
  vocabStore: ReturnType<typeof createVocabStore>;
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

  // Track vocabulary from this message
  useEffect(() => {
    if (!isUser && message.content) {
      vocabStore.addWordsFromMessage(message.content);
    }
  }, [message.content, isUser, vocabStore]);

  // Use story bubble for story messages
  if (message.isStory && !isUser) {
    return <StoryBubble message={message} tts={tts} vocabStore={vocabStore} />;
  }

  return (
    <div style={{
      display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 16, animation: "fadeInUp 0.3s ease",
    }}>
      <div style={{
        maxWidth: "82%", padding: "14px 18px",
        borderRadius: isUser ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
        background: isUser ? "var(--user-bubble)" : "var(--ai-bubble)",
        color: isUser ? "var(--user-text)" : "var(--ai-text)",
        fontSize: 15, lineHeight: 1.7, letterSpacing: "0.01em",
        border: isUser ? "none" : "1px solid var(--border)",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {!isUser && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 8,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.1em", color: "var(--accent)",
            }}>Aino</div>
            <div style={{ display: "flex", gap: 4 }}>
              {extractFinnishPhrases(message.content).length > 0 && (
                <button
                  onClick={() => {
                    if (tts.speaking) { tts.stop(); } else { tts.speakFinnishFromMessage(message.content); }
                  }}
                  title={tts.speaking ? "Stop" : "Hear Finnish phrases"}
                  style={{
                    background: "none", border: "none",
                    color: tts.speaking ? "var(--speaker-active)" : "var(--text-muted)",
                    fontSize: 13, padding: "2px 6px", cursor: "pointer",
                    opacity: tts.speaking ? 1 : 0.65,
                  }}
                >
                  {tts.speaking ? "■" : "🇫🇮"}
                </button>
              )}
              <button
                onClick={() => {
                  if (tts.speaking) { tts.stop(); } else { tts.speakFullMessage(message.content); }
                }}
                title={tts.speaking ? "Stop" : "Hear full message"}
                style={{
                  background: "none", border: "none", color: "var(--text-muted)",
                  fontSize: 13, padding: "2px 6px", opacity: 0.65, cursor: "pointer",
                }}
              >
                {tts.speaking ? "■" : "▶"}
              </button>
            </div>
          </div>
        )}
        <div>{renderTranslatableText(message.content, tts, vocabStore)}</div>
      </div>
    </div>
  );
}

// ─── Story Level Picker ───

function StoryLevelPicker({
  onSelect,
  onCancel,
}: {
  onSelect: (level: number) => void;
  onCancel: () => void;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, animation: "fadeInUp 0.2s ease",
    }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 16, padding: 24, maxWidth: 400, width: "90%",
          boxShadow: "0 16px 48px rgba(0,0,0,0.3)",
        }}
      >
        <h3 style={{
          fontSize: 18, fontWeight: 500, marginBottom: 4,
          fontFamily: "var(--font-display)",
        }}>
          📚 Choose your level
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          Pick a difficulty for your story
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {STORY_LEVELS.map((sl) => (
            <button
              key={sl.level}
              onClick={() => onSelect(sl.level)}
              style={{
                background: "var(--surface-alt)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "12px 16px",
                color: "var(--text)",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.15s ease",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
                (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-soft)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-alt)";
              }}
            >
              <span style={{
                fontSize: 20, fontWeight: 700, color: "var(--accent)",
                minWidth: 28, textAlign: "center",
              }}>
                {sl.level}
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{sl.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {sl.description}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          style={{
            background: "none", border: "none", color: "var(--text-muted)",
            fontSize: 13, marginTop: 16, cursor: "pointer", width: "100%",
            textAlign: "center", padding: 8,
          }}
        >
          Cancel
        </button>
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
  const [showLevelPicker, setShowLevelPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const tts = useFinishTTS();
  const vocabStore = useMemo(() => createVocabStore(), []);

  const handleVoiceResult = useCallback((transcript: string) => {
    setInput((prev) => (prev ? prev + " " + transcript : transcript));
  }, []);

  const stt = useSpeechRecognition({ onResult: handleVoiceResult, lang: sttLang });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages, isLoading]);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const sendToAPI = async (
    conversationMessages: Message[],
    options?: { mode?: string; storyLevel?: number; isStory?: boolean }
  ) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          mode: options?.mode,
          storyLevel: options?.storyLevel,
          knownWords: vocabStore.getKnownWords(),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.text, isStory: options?.isStory },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Anteeksi — I had a technical hiccup there. Could you try again?" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = (scenarioId: string) => {
    if (scenarioId === "story") {
      setShowLevelPicker(true);
      return;
    }
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
        content: "Moi! I want to learn Finnish. I know some very basics — moi, kiitos, a few numbers. Let's start chatting.",
      };
      setMessages([introMsg]);
      sendToAPI([introMsg]);
    }
  };

  const handleStoryLevel = (level: number) => {
    setShowLevelPicker(false);
    setStarted(true);
    setSelectedScenario("story");
    const userMsg: Message = {
      role: "user",
      content: `Tell me a story at level ${level}.`,
    };
    setMessages([userMsg]);
    sendToAPI([userMsg], { mode: "story", storyLevel: level, isStory: true });
  };

  const handleRequestNewStory = (level: number) => {
    setShowLevelPicker(false);
    const userMsg: Message = {
      role: "user",
      content: `Tell me another story at level ${level}.`,
    };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    sendToAPI(newMsgs, { mode: "story", storyLevel: level, isStory: true });
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    if (stt.listening) stt.stop();
    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    // If we're in story mode, keep using story mode for follow-ups
    if (selectedScenario === "story") {
      sendToAPI(newMessages, { mode: "story", storyLevel: 1 });
    } else {
      sendToAPI(newMessages);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleReset = () => {
    tts.stop();
    if (stt.listening) stt.stop();
    setMessages([]); setStarted(false); setSelectedScenario("free"); setInput("");
  };

  // ─── Welcome screen ───
  if (!started) {
    return (
      <div style={{
        height: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 24, position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0, opacity: 0.025, pointerEvents: "none",
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, currentColor 2px, currentColor 3px)",
        }} />

        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} style={{
          position: "absolute", top: 20, right: 20, background: "none",
          border: "1px solid var(--border)", color: "var(--text-muted)",
          padding: "6px 16px", borderRadius: 20, fontSize: 12,
        }}>
          {theme === "dark" ? "☀ Päivä" : "☽ Yö"}
        </button>

        <div style={{ textAlign: "center", maxWidth: 520, zIndex: 1, animation: "fadeInUp 0.6s ease" }}>
          <div style={{
            fontSize: 12, letterSpacing: "0.25em", textTransform: "uppercase",
            color: "var(--accent)", marginBottom: 28, fontWeight: 500,
          }}>Puhutaan suomea</div>

          <h1 style={{
            fontSize: 52, fontWeight: 400, margin: "0 0 8px 0",
            letterSpacing: "-0.03em", lineHeight: 1, fontFamily: "var(--font-display)",
          }}>Aino</h1>
          <p style={{
            fontSize: 17, color: "var(--text-muted)", margin: "0 0 14px 0",
            fontStyle: "italic", fontFamily: "var(--font-display)",
          }}>Your Finnish conversation partner</p>

          <div style={{
            display: "flex", gap: 20, justifyContent: "center", marginBottom: 40,
            fontSize: 12, color: "var(--text-muted)",
          }}>
            <span>🔊 She speaks Finnish</span>
            <span>🎤 You speak back</span>
            <span>📚 Immersive stories</span>
          </div>

          <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-muted)", marginBottom: 36 }}>
            Choose a scenario to begin, or start a free conversation.<br />
            Hover over <span style={{ color: "var(--finnish)", fontStyle: "italic", fontWeight: 500 }}>Finnish words</span> to see translations. Click to hear them spoken.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {SCENARIOS.map((s) => (
              <button key={s.id} onClick={() => handleStart(s.id)} style={{
                background: "var(--surface-alt)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "16px 14px", color: "var(--text)",
                textAlign: "left", fontSize: 14, transition: "all 0.2s ease",
                display: "flex", alignItems: "center", gap: 10,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
                (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-soft)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-alt)";
              }}>
                <span style={{ fontSize: 20 }}>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {showLevelPicker && (
          <StoryLevelPicker
            onSelect={handleStoryLevel}
            onCancel={() => setShowLevelPicker(false)}
          />
        )}
      </div>
    );
  }

  // ─── Chat screen ───
  const visibleMessages = messages.filter((m) => {
    const sc = SCENARIOS.find((s) => s.id === selectedScenario);
    if (m.role === "user" && sc?.prompt && m.content === sc.prompt) return false;
    if (m.role === "user" && m.content.startsWith("Moi! I want to learn Finnish") && messages.indexOf(m) === 0) return false;
    if (m.role === "user" && m.content.startsWith("Tell me a story at level") && messages.indexOf(m) === 0) return false;
    if (m.role === "user" && m.content.startsWith("Tell me another story at level")) return false;
    return true;
  });

  const vocabStats = vocabStore.getStats();

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column", position: "relative",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 20px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--surface)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={handleReset} style={{
            background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, padding: "2px 6px",
          }} title="New conversation">←</button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 500, fontFamily: "var(--font-display)" }}>Aino</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {SCENARIOS.find((s) => s.id === selectedScenario)?.label || "Free chat"} · Finnish tutor
              {vocabStats.total > 0 && ` · ${vocabStats.total} words learned`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setAutoSpeak(!autoSpeak)} style={{
            background: autoSpeak ? "var(--accent-soft)" : "none",
            border: "1px solid var(--border)",
            color: autoSpeak ? "var(--accent)" : "var(--text-muted)",
            padding: "4px 12px", borderRadius: 16, fontSize: 11, transition: "all 0.15s ease",
          }} title={autoSpeak ? "Auto-speak: ON" : "Auto-speak: OFF"}>
            🔊 {autoSpeak ? "On" : "Off"}
          </button>
          <button onClick={() => setSttLang(sttLang === "fi-FI" ? "en-GB" : "fi-FI")} style={{
            background: "none", border: "1px solid var(--border)",
            color: "var(--text-muted)", padding: "4px 12px", borderRadius: 16, fontSize: 11,
          }} title="Switch speech recognition language">
            🎤 {sttLang === "fi-FI" ? "FI" : "EN"}
          </button>
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} style={{
            background: "none", border: "1px solid var(--border)",
            color: "var(--text-muted)", padding: "4px 12px", borderRadius: 16, fontSize: 11,
          }}>
            {theme === "dark" ? "☀" : "☽"}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 8px 20px" }}>
        {visibleMessages.map((msg, i) => (
          <MessageBubble key={i} message={msg} tts={tts} autoSpeak={autoSpeak} vocabStore={vocabStore} />
        ))}
        {isLoading && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 16 }}>
            <div style={{
              padding: "14px 18px", borderRadius: "20px 20px 20px 4px",
              background: "var(--ai-bubble)", border: "1px solid var(--border)",
            }}>
              <div style={{
                fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.1em", color: "var(--accent)", marginBottom: 4,
              }}>Aino</div>
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: "12px 16px 16px 16px", borderTop: "1px solid var(--border)",
        background: "var(--surface)", flexShrink: 0,
      }}>
        {/* Scenario quick-switch */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", paddingBottom: 2 }}>
          {SCENARIOS.filter((s) => s.id !== "free").map((sc) => (
            <button key={sc.id}
              onClick={() => {
                if (isLoading) return;
                if (sc.id === "story") {
                  setShowLevelPicker(true);
                  return;
                }
                setSelectedScenario(sc.id);
                const userMsg: Message = { role: "user", content: sc.prompt! };
                const newMsgs = [...messages, userMsg];
                setMessages(newMsgs);
                sendToAPI(newMsgs);
              }}
              style={{
                background: "var(--accent-soft)", border: "1px solid var(--border)",
                borderRadius: 16, padding: "5px 12px", color: "var(--text-muted)",
                fontSize: 12, whiteSpace: "nowrap", transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              }}
              disabled={isLoading}
            >
              {sc.icon} {sc.label}
            </button>
          ))}
        </div>

        {/* Input row */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          {stt.supported && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <button onClick={stt.toggle} disabled={isLoading && !stt.listening} style={{
                background: stt.listening ? "var(--mic-active-bg)" : "none",
                border: `2px solid ${stt.listening ? "var(--mic-active)" : "var(--border)"}`,
                borderRadius: "50%", width: 44, height: 44,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s ease",
                color: stt.listening ? "var(--mic-active)" : "var(--text-muted)",
                fontSize: 18, animation: stt.listening ? "micPulse 1.5s ease-in-out infinite" : "none",
                flexShrink: 0,
              }} title={stt.listening ? "Stop recording" : "Start speaking"}>
                {stt.listening ? "●" : "🎤"}
              </button>
              {stt.interim && (
                <div style={{
                  fontSize: 11, color: "var(--text-muted)", fontStyle: "italic",
                  maxWidth: 160, textAlign: "center", lineHeight: 1.3, animation: "fadeInUp 0.2s ease",
                }}>{stt.interim}...</div>
              )}
            </div>
          )}

          <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Kirjoita tai puhu... (Type or speak)"
            disabled={isLoading} rows={1}
            style={{
              flex: 1, background: "var(--input-bg)", border: "1px solid var(--border)",
              borderRadius: 16, padding: "12px 16px", color: "var(--text)",
              fontSize: 15, fontFamily: "var(--font-body)", resize: "none",
              lineHeight: 1.5, maxHeight: 120, transition: "border-color 0.2s ease",
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
          />

          <button onClick={handleSend} disabled={isLoading || !input.trim()} style={{
            background: input.trim() && !isLoading ? "var(--accent)" : "var(--surface-alt)",
            border: "none", borderRadius: "50%", width: 44, height: 44,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s ease", flexShrink: 0,
            color: input.trim() && !isLoading ? "#fff" : "var(--text-muted)", fontSize: 18,
          }}>↑</button>
        </div>

        <div style={{
          fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 8,
        }}>
          {stt.supported
            ? "🎤 Tap mic to speak · Hover Finnish words for meaning · Click to hear · Shift+Enter for new line"
            : "Hover Finnish words for meaning · Click to hear · Shift+Enter for new line"}
        </div>
      </div>

      {/* Level picker modal */}
      {showLevelPicker && (
        <StoryLevelPicker
          onSelect={handleRequestNewStory.bind(null) || handleStoryLevel}
          onCancel={() => setShowLevelPicker(false)}
        />
      )}
    </div>
  );
}
