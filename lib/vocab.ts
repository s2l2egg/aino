// ─── Vocabulary tracker ───
// Tracks encountered Finnish words within a session.
// Designed with a clean interface so we can swap in persistent
// storage (Vercel KV, Supabase, etc.) later without touching other code.

export interface VocabEntry {
  word: string;
  translation: string;
  encounters: number;
  firstSeen: number;
  lastSeen: number;
}

export interface VocabStore {
  words: Map<string, VocabEntry>;
  getKnownWords: () => string[];
  addWord: (word: string, translation: string) => void;
  addWordsFromMessage: (text: string) => void;
  getWordTranslation: (word: string) => string | null;
  getStats: () => { total: number; recent: string[] };
}

export function createVocabStore(): VocabStore {
  const words = new Map<string, VocabEntry>();

  return {
    words,

    getKnownWords(): string[] {
      return Array.from(words.keys());
    },

    addWord(word: string, translation: string): void {
      const normalised = word.toLowerCase().trim();
      const existing = words.get(normalised);
      if (existing) {
        existing.encounters += 1;
        existing.lastSeen = Date.now();
      } else {
        words.set(normalised, {
          word: normalised,
          translation: translation.trim(),
          encounters: 1,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
        });
      }
    },

    // Extract words from **word|translation** format in messages
    addWordsFromMessage(text: string): void {
      const regex = /\*\*([^|*]+)\|([^*]+)\*\*/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        this.addWord(match[1], match[2]);
      }

      // Also extract Finnish words from story format (words followed by emojis)
      // Common Finnish words that appear in stories
      const storyWordRegex = /\b([A-ZÄÖa-zäö]{2,})\s+(?:[\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}])/gu;
      let storyMatch;
      while ((storyMatch = storyWordRegex.exec(text)) !== null) {
        const word = storyMatch[1].toLowerCase();
        // Only add if not already tracked with a translation
        if (!words.has(word)) {
          // We don't have a translation for story-embedded words,
          // but we track that they've been encountered
          words.set(word, {
            word,
            translation: "",
            encounters: 1,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
          });
        } else {
          const existing = words.get(word)!;
          existing.encounters += 1;
          existing.lastSeen = Date.now();
        }
      }
    },

    getWordTranslation(word: string): string | null {
      const entry = words.get(word.toLowerCase().trim());
      return entry?.translation || null;
    },

    getStats() {
      const all = Array.from(words.values());
      const sorted = all.sort((a, b) => b.lastSeen - a.lastSeen);
      return {
        total: all.length,
        recent: sorted.slice(0, 10).map((e) => e.word),
      };
    },
  };
}
