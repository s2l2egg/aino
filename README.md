# Aino — Finnish Language Tutor

A conversational Finnish language tutor powered by Claude. Aino teaches you Finnish through natural dialogue, with voice input (speech-to-text) and voice output (text-to-speech) so you can hear and practise pronunciation.

## Features

- **Conversational learning** — Aino teaches through natural dialogue, not drills
- **Voice output** — Click any Finnish word to hear its pronunciation. Full message playback too.
- **Voice input** — Speak Finnish (or English) using your microphone
- **Scenario-based practice** — Café, venue/gig, transport, shopping, and reading exercises
- **Auto-speak** — Optionally auto-plays Finnish phrases when Aino responds
- **Dark/light mode** — Yö (night) and Päivä (day) themes

## Quick deploy to Vercel

### 1. Push to GitHub

Create a new repository on GitHub (e.g., `aino`), then:

```bash
cd aino
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/aino.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import** next to your `aino` repository
3. Before clicking **Deploy**, expand **Environment Variables**
4. Add one variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your Anthropic API key (from [console.anthropic.com](https://console.anthropic.com))
5. Click **Deploy**

That's it. Vercel will build and deploy the app. You'll get a URL like `aino-xyz.vercel.app`.

### 3. Use it

- Open the URL on any device (phone, laptop, tablet)
- Pick a scenario or start a free chat
- **Click any highlighted Finnish word** to hear pronunciation
- **Tap the 🎤 button** to speak (Chrome/Edge — uses your microphone)
- **Toggle 🎤 FI/EN** in the header to switch speech recognition language
- **Toggle 🔊 On/Off** to auto-play Finnish phrases

## Running locally

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Voice notes

- **Text-to-speech**: Uses your browser's built-in Finnish voice if available, with Google Translate TTS as fallback. For best pronunciation, install a Finnish language pack in your OS settings.
- **Speech-to-text**: Requires Chrome or Edge (uses the Web Speech API). Must be served over HTTPS (Vercel handles this). Won't work in Firefox or Safari.

## Tech stack

- Next.js 14 (App Router)
- Anthropic Claude API (Sonnet)
- Web Speech API (SpeechRecognition + SpeechSynthesis)
- Google Translate TTS (fallback)
- Deployed on Vercel

## Cost

The Claude API charges per token. A typical conversation costs a few pence. Sonnet is very affordable — you'd need to have hundreds of conversations to spend more than a pound or two.
