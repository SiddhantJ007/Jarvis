import OpenAI from "openai";

export const JARVIS_SYSTEM_PROMPT = `
You are Jarvis, a local personal assistant running entirely on the user’s Mac.

Core identity & behavior:
- You are smart, pragmatic, and slightly witty.
- Voice: confident and human. State clear opinions when asked; avoid fence-sitting. Keep replies short-to-medium unless depth is requested or necessary.
- Your default tone is friendly and conversational, but not annoying.
- You use light humor or short quips occasionally, especially in greetings or confirmations, but never at the expense of clarity.
- You prioritize being actually helpful over being funny. If in doubt, choose clarity.

Capabilities (what you can rely on):
- The backend can:
  - Open macOS applications by name (via an “openApplication” tool).
  - Open URLs in the browser.
  - Create and manage text/markdown notes in a notes folder.
  - List files in certain directories.
  - Fetch basic system info.
  - Store and manage agenda items (tasks) with statuses like TODO / DONE / MOVED and due dates.
- YOU DO NOT call these tools directly; the backend decides when to run them and passes you their results.
- Never say “I can’t open apps” or “I can’t create notes” or “I can’t manage your tasks.” Instead, if something should have triggered a tool but didn’t, say something like:
  - “I didn’t receive any action result for that, so I didn’t actually perform the action.”

How to answer:
- For pure questions, give clear, well-structured answers.
- For confirmations of actions, keep it short, concrete, and you may add a small quip:
  - “Opening Google Chrome. Try not to open 37 tabs this time.”
  - “Note saved. Future you will thank present you.”
- If the user asks for help with a task or agenda item, treat it like a coaching/problem-solving request:
  - Ask a couple of clarifying questions if needed.
  - Then suggest concrete next steps, not vague motivational quotes.

Boundaries:
- You don’t have real-time internet for live data like current weather or stock prices unless the backend explicitly sends you that info.
- Be honest about that limitation: suggest using a weather app or browser when appropriate.
- Never pretend you can see the screen, emails, or private data unless the backend has clearly provided that content in the messages or context.

Memory & personalization:
- The backend may pass in preferences like “short replies”, “casual tone”, or the user’s preferred name.
- Respect those preferences in your style when they are provided.
- If the user explicitly says “remember that I prefer X”, respond as if you will remember, but the actual persistence is the backend’s job.

General style:
- Avoid long walls of text unless the user asks for deep detail.
- Prefer short paragraphs and bullet points for complex explanations.
- Never gaslight the user about what the system can do. If something fails, admit it and suggest a workaround.
- Avoid generic assistant closers like “Let me know if you need anything else” or “How else can I assist you today?”. Just answer and stop.
- For short greetings (“hi”, “hello”, etc.), acknowledge, add a touch of personality (light wit), optionally nod to time of day/day, and move directly into being useful—no canned “how can I help” lines.
- When asked for facts or “something interesting”, give a concise, interesting fact. Prefer varying topics on successive requests (e.g., history → science → tech → psychology). Do not repeat the same fact back-to-back unless explicitly asked to repeat or expand that exact one.
- When addressing the user directly, refer to them as “sir” regularly. Where natural, end sentences with “sir.” Avoid inserting “sir” inside code blocks or inline code; keep code clean.
`.trim();

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function generateAnswer(input: {
  text: string;
  recentMessages: { role: "user" | "assistant"; content: string }[];
  preferences?: Record<string, string>;
  isFirstReply?: boolean;
  factRequest?: boolean;
  jokeRequest?: boolean;
  lastFact?: string | null;
  lastJoke?: string | null;
  styleHint?: string;
}): Promise<string> {
  const {
    text,
    recentMessages,
    preferences,
    isFirstReply = false,
    factRequest = false,
    jokeRequest = false,
    lastFact = null,
    lastJoke = null,
    styleHint,
  } = input;

  const prefsText =
    preferences && Object.keys(preferences).length > 0
      ? `User preferences:\n${Object.entries(preferences)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")}`
      : "No explicit user preferences.";

  const messages = [
    { role: "system" as const, content: JARVIS_SYSTEM_PROMPT },
    isFirstReply
      ? {
          role: "system" as const,
          content:
            "This is the first reply in a new session. Do NOT use stock greetings. Respond directly and engagingly to the user’s opening message, as if you already know them, with a short witty line and immediate usefulness.",
        }
      : null,
    { role: "system" as const, content: prefsText },
    styleHint
      ? {
          role: "system" as const,
          content: styleHint,
        }
      : null,
    ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: text },
  ].filter(Boolean) as { role: "system" | "user" | "assistant"; content: string }[];

  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    messages,
  });

  let choice = response.choices?.[0]?.message?.content;
  if (!choice) {
    throw new Error("LLM returned no content");
  }

  const genericGreeting = /^(hello|hi)[^a-zA-Z0-9]{0,3}.*assist you today/i;
  if (isFirstReply) {
    if (genericGreeting.test(choice)) {
      const fallbacks = [
        "What’s on the agenda, boss?",
        "Ready when you are. What are we doing?",
        "Back online. What do you need?",
      ];
      const idx = Math.floor(Math.random() * fallbacks.length);
      choice = fallbacks[idx];
    }
  }

  // Strip generic closers
  const closers =
    /(let me know if (there'?s|you) (anything else )?(you )?(need|want).*$|how else can i assist.*$|is there anything else.*$)/i;
  choice = choice.replace(closers, "").trim();

  // If fact request and too similar to last fact, retry with stronger instruction once
  if (factRequest && lastFact && isTooSimilar(choice, lastFact)) {
    const retryMessages = [
      { role: "system" as const, content: JARVIS_SYSTEM_PROMPT },
      { role: "system" as const, content: "The previous fact was too similar to the last one. Provide a different fact on a different topic. Keep it concise and interesting." },
      { role: "system" as const, content: prefsText },
      ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: text },
    ];
    const retry = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: retryMessages,
    });
    const retryChoice = retry.choices?.[0]?.message?.content;
    if (retryChoice) {
      choice = retryChoice.replace(closers, "").trim();
    }
  }

  // If joke request and too similar to last joke, retry once
  if (jokeRequest && lastJoke && isTooSimilar(choice, lastJoke)) {
    const retryMessages = [
      { role: "system" as const, content: JARVIS_SYSTEM_PROMPT },
      { role: "system" as const, content: "The previous joke was too similar to the last one. Provide a different joke. Keep it short and fresh." },
      { role: "system" as const, content: prefsText },
      ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: text },
    ];
    const retry = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: retryMessages,
    });
    const retryChoice = retry.choices?.[0]?.message?.content;
    if (retryChoice) {
      choice = retryChoice.replace(closers, "").trim();
    }
  }

  return applySirPostProcessing(choice);
}

function isTooSimilar(current: string, last: string): boolean {
  const firstSentence = (s: string) => {
    const idx = s.indexOf(".");
    return idx >= 0 ? s.slice(0, idx + 1).trim().toLowerCase() : s.trim().toLowerCase();
  };
  const cur = firstSentence(current);
  const prev = firstSentence(last);
  if (!cur || !prev) return false;
  if (cur === prev) return true;
  // basic prefix similarity
  return cur.startsWith(prev) || prev.startsWith(cur);
}

function applySirPostProcessing(reply: string): string {
  const trimmed = reply.trim();
  if (!trimmed) return reply;
  if (trimmed.length > 300) return reply;
  if (/sir/i.test(trimmed)) return reply;
  if (trimmed.includes("```")) return reply;

  const endsWithPunct = /[.!?]$/.test(trimmed);
  if (endsWithPunct) {
    return trimmed.replace(/[.!?]+$/, ", sir.");
  }
  return `${trimmed}, sir.`;
}

export type PlannedToolCall = {
  name: string;
  args: Record<string, unknown>;
};

export type PlanResult = {
  mode: "ANSWER" | "ACTION" | "TASK" | "MIXED";
  plannedTools: PlannedToolCall[];
  reasoningSummary: string;
};

export type NormalizedStep =
  | { action: "open_application"; params: { name: string } }
  | { action: "open_url"; params: { url: string } }
  | { action: "youtube_search_play"; params: { query: string } }
  | { action: "open_new_tab"; params: { appName?: string } }
  | { action: "keypress"; params: { key: string; modifiers?: string[]; appName?: string } }
  | { action: "click"; params: { target: string; appName?: string } }
  | { action: "find_and_click"; params: { target: string; appName?: string } }
  | { action: "find_and_click_ocr"; params: { target: string } }
  | { action: "browser_click_text"; params: { text: string } }
  | { action: "browser_click_selector"; params: { selector: string; index?: number } }
  | { action: "close_tab"; params: { appName?: string } }
  | { action: "get_time"; params: {} }
  | { action: "fetch_news"; params: { query?: string } }
  | { action: "fetch_weather"; params: { city: string } }
  | { action: "play_music"; params: { appName?: string } }
  | { action: "scroll"; params: { direction: "up" | "down"; steps?: number; appName?: string } }
  | { action: "type_text"; params: { text: string; appName?: string } }
  | { action: "focus_app"; params: { name: string } };

export async function planWithLlm(input: {
  text: string;
  availableTools: { name: string; description: string; parameters: Record<string, unknown> }[];
  recentMessages: { role: "user" | "assistant"; content: string }[];
}): Promise<PlanResult> {
  const { text, availableTools, recentMessages } = input;

  const plannerInstruction = `
Decide whether to answer normally, call tools, or both.
Return ONLY a minified JSON object with fields: mode ("ANSWER" | "ACTION" | "TASK" | "MIXED"), plannedTools (array of {name,args}), reasoningSummary (short string).
No prose, no code fences, no prefixes/suffixes—just JSON. Use only tools from the provided list. Do NOT execute tools yourself.
Available tools:
${availableTools
  .map(
    (t) =>
      `- ${t.name}: ${t.description}. Params: ${JSON.stringify(t.parameters)}`
  )
  .join("\n")}
`.trim();

  const messages = [
    { role: "system" as const, content: JARVIS_SYSTEM_PROMPT },
    { role: "system" as const, content: plannerInstruction },
    ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: text },
  ];

  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    messages,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    return { mode: "ANSWER", plannedTools: [], reasoningSummary: "" };
  }

  const parsed = safeParsePlan(content);
  if (!parsed) {
    return { mode: "ANSWER", plannedTools: [], reasoningSummary: "" };
  }

  return {
    mode: parsed.mode,
    plannedTools: parsed.plannedTools || [],
    reasoningSummary: parsed.reasoningSummary || "",
  };
}

export async function normalizeIntent(text: string): Promise<NormalizedStep[]> {
  const intentInstruction = `
You are an intent normalizer. Convert messy user requests into a minimal, ordered list of executable steps using ONLY these actions:
- open_application: params { name: string }
- open_url: params { url: string }
- youtube_search_play: params { query: string }
- open_new_tab: params { appName?: string }
- keypress: params { key: string, modifiers?: string[], appName?: string }
- click: params { target: string, appName?: string }
- find_and_click: params { target: string, appName?: string }
- find_and_click_ocr: params { target: string }
- browser_click_text: params { text: string }
- browser_click_selector: params { selector: string, index?: number }
 - browser_click_selector: params { selector: string, index?: number }
 - close_tab: params { appName?: string }
- get_time: params {}
- fetch_news: params { query?: string }
- fetch_weather: params { city: string }
- play_music: params { appName?: string }
- scroll: params { direction: "up" | "down", steps?: number, appName?: string }
- type_text: params { text: string, appName?: string }
- focus_app: params { name: string }

Rules:
- Return ONLY a minified JSON array, e.g., [{"action":"open_application","params":{"name":"Google Chrome"}}]
- No prose, no code fences, no commentary.
- If nothing actionable, return [].
- For “open youtube ... play <something>”, produce steps: open_application (browser name if specified), open_url (https://www.youtube.com), youtube_search_play with the query/title.
- Normalize app names to what a Mac would recognize (e.g., “Chrome”, “Google Chrome”).
- Prefer explicit focus_app before click/type/keypress if the app is specified.
- Use open_new_tab for “new tab” requests; include appName if mentioned, otherwise let the executor use last focused app.
- Use find_and_click for UI labels like “login”, “submit”, “close”, “add to cart”.
- Use find_and_click_ocr if plain find_and_click might miss because the element isn’t accessible.
- Use browser_click_text for web page interactions when Chrome debugging is available (remote-debugging-port=9222).
- Use browser_click_selector when you need the nth element of a selector (e.g., the second video card on YouTube).
- Use close_tab to close the current browser tab (Cmd+W).
- Use get_time for current time; use fetch_news for headlines.
- Use fetch_weather for weather queries (requires OPENWEATHER_API_KEY).
- Use play_music to start music (Spotify by default; fallback to YouTube Music).
- Use scroll for “scroll down/up” requests; default steps ~5.
`.trim();

  const messages = [
    { role: "system" as const, content: intentInstruction },
    { role: "user" as const, content: text },
  ];

  try {
    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });
    const choice = response.choices?.[0]?.message?.content?.trim();
    if (!choice) return [];
    const parsed = JSON.parse(choice);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function safeParsePlan(raw: string): PlanResult | null {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const slice = raw.slice(first, last + 1);
  try {
    const parsed = JSON.parse(slice) as Partial<PlanResult>;
    if (!parsed.mode || !parsed.plannedTools) return null;
    return {
      mode: parsed.mode,
      plannedTools: parsed.plannedTools || [],
      reasoningSummary: parsed.reasoningSummary || "",
    };
  } catch {
    return null;
  }
}
