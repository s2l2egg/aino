import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildStoryPrompt } from "@/lib/prompts";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, mode, storyLevel, knownWords } = body;

    let systemPrompt = SYSTEM_PROMPT;

    // Story mode uses a different system prompt
    if (mode === "story") {
      systemPrompt = buildStoryPrompt(storyLevel || 1, knownWords || []);
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => {
        if (b.type === "text") return b.text;
        return "";
      })
      .join("\n");

    return NextResponse.json({ text });
  } catch (error: unknown) {
    console.error("Anthropic API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to get response", details: message },
      { status: 500 }
    );
  }
}
