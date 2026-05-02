import { readFileSync, existsSync } from "node:fs";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterOptions = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  key: string;
};

export function loadDotEnv(): void {
  if (!existsSync(".env")) return;

  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsAt = trimmed.indexOf("=");
    if (equalsAt === -1) continue;

    const key = trimmed.slice(0, equalsAt).trim();
    const value = trimmed.slice(equalsAt + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function getOpenRouterKeys(): string[] {
  loadDotEnv();

  const keys = [
    process.env.OPENROUTER_API_KEY,
    ...(process.env.OPENROUTER_API_KEYS ?? "").split(/[,\s]+/),
  ]
    .filter((key): key is string => Boolean(key?.trim()))
    .map((key) => key.trim());

  return [...new Set(keys)];
}

export async function openRouterChat(options: OpenRouterOptions): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/composio/dep-graph-task",
      "X-Title": "Composio Dependency Graph Task",
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens ?? 9000,
      reasoning: { exclude: true },
      include_reasoning: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 500)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ finish_reason?: string; message?: { content?: string | null; reasoning?: string | null } }>;
  };

  const choice = json.choices?.[0];
  const content = choice?.message?.content;
  if (!content) {
    throw new Error(
      `OpenRouter response did not contain message content${
        choice?.finish_reason ? ` (finish_reason=${choice.finish_reason})` : ""
      }.`,
    );
  }

  return content;
}

export function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object found in model output.");
    return JSON.parse(text.slice(start, end + 1));
  }
}
