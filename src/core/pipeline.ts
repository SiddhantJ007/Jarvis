import { AppConfig } from "../config/env";
import { DatabaseClient, MessageMode } from "../db/sqlite";
import { executeTool, getToolRegistry } from "../tools";
import { ToolRegistry } from "../tools/types";
import {
  generateAnswer,
  planWithLlm,
  PlanResult,
  normalizeIntent,
  NormalizedStep,
} from "./llm";
import { getRagContext, indexMessage } from "./rag";
import { synthesizeSpeech } from "./tts";

export interface QueryRequest {
  sessionId: string;
  text: string;
  source?: string;
}

export interface ToolCallResultEntry {
  name: string;
  args: any;
  success: boolean;
  message?: string;
}

export interface QueryResponse {
  mode: "ACTION" | "ANSWER";
  replyText: string;
  toolCalls: ToolCallResultEntry[];
  ttsAudioBase64?: string | null;
}

export interface PipelineContext {
  db: DatabaseClient;
  config: AppConfig;
  tools?: ToolRegistry;
  logger?: Console;
}

const OPEN_APP_PREFIX = /^open app\s+/i;
const OPEN_URL_PREFIX = /^open url\s+/i;
const OPEN_ANY_PREFIX = /^open\s+/i;
const CREATE_NOTE_PREFIX = /^create note:\s*/i;
const LIST_FILES_PREFIX = /^list files in\s+/i;
const SYSTEM_INFO_PATTERN = /^system info$/i;
const REMEMBER_NAME_PATTERN = /^remember my name is\s+(.+)$/i;
const KEEP_SHORT_PATTERN = /^keep (?:your )?answers short$/i;
const ADD_TODAY_AGENDA_PREFIXES = [
  /^today'?s agenda:\s*/i,
  /^todays agenda:\s*/i,
  /^add to my agenda:\s*/i,
  /^add to agenda:\s*/i,
];
const LIST_TODAY_AGENDA_PATTERNS = [
  /^what'?s my agenda\??$/i,
  /^whats my agenda\??$/i,
  /^show my agenda$/i,
  /^today'?s agenda\?$/i,
];
const ADD_AGENDA_FUZZY = /(add|put)\s+(.+?)\s+(?:to\s+)?(?:the\s+)?(?:my\s+)?agenda\b/i;
const LIST_AGENDA_FUZZY =
  /\b(show|read|see|list|display|tell me|pull up|check|what(?:'s)?|what all|what do i have|whats on)\b.*\b(agenda|to do|today)\b/i;
const LIST_AGENDA_FUZZY_ALT =
  /(agenda|to do|todo|today).*\\b(show|read|see|list|display|pull up|check|what(?:'s)?|whats on|what do i have)\b/i;
const SCREEN_SUMMARY_PATTERN =
  /(summari[sz]e|read|capture|scan).*(screen|window|tab)|what(?:'s|s)? (?:on|visible) on (?:the )?(screen|window|tab)/i;
const COPY_CLIPBOARD_PATTERN =
  /\b(copy|grab|send)\b.*\b(clipboard|clip|paste ?board|copy buffer)\b|\bcopy (?:that|this|last (?:reply|response|output|message))\b|\bcopy my (?:response|reply)\b/i;
const SELECT_TEXT_PATTERN =
  /\bselect\b.*\btext\b|\bselect (?:all|everything)\b|\bhighlight\b.*\btext\b/i;
const CUT_PATTERN =
  /\b(cut|remove|clip out|trim)\b.*(selection|text|this)|^(cut|remove selection|delete selection)\b/i;
const COPY_PATTERN =
  /\bcopy\b.*(selection|text|this)|^(copy selection|copy text|copy it|copy that)\b/i;
const PASTE_PATTERN =
  /\bpaste\b|\binsert\b.*(clipboard|paste)|^(paste|insert paste)\b/i;
const NEWLINE_PATTERN =
  /\b(new line|next line|line break|go to new line|enter|return key)\b/i;
const CLOSE_APP_PATTERN =
  /\b(close|quit|exit|shut down|terminate)\b\s+(?:the\s+)?(app|application|program)?\s*(?<app>[a-zA-Z0-9 ._-]+)?$/i;
const PLEASANTRY_PATTERN =
  /^(thanks?|thank you|bye[- ]?bye|bye|goodbye|see you|nice day|later|ciao|take care|you'?re welcome|welcome|no problem)[!. ]*$/i;
const NOISE_WORDS = new Set(["you", "u", "ok", "k", "hmm", "hmmm", "huh", "h", "hey", "hi"]);
const CLOSE_TAB_PATTERN = /\bclose (?:this|the)?\s*tab\b/i;
const EMBEDDED_FLOW_PATTERN =
  /\bopen\s+([a-zA-Z0-9 ._-]+?).*(paste).*(summari[sz]e).*(copy).*(clipboard)/i;
const EMBEDDED_PASTE_SUMMARY_PATTERN =
  /\bopen\s+([a-zA-Z0-9 ._-]+?).*(paste).*(summari[sz]e)(.*clipboard)?/i;
const SEQUENTIAL_PATTERN = /\bthen\b/i;
const DEBATE_STYLE_HINT =
  "Tone: confident and well-informed with a human edge; don’t be a fence-sitter. State a clear view and back it with 2-4 crisp sentences. It’s okay to be a bit pointed if challenged, but stay respectful. Avoid long lists or boilerplate; give a concise opinion with one or two concrete points.";
const REWRITE_PATTERN =
  /\b(rewrite|rephrase|make.*better|improve|more formal|polish|refine)\b.*\b(text|selection|this)\b/i;
const SIGN_OFF_PATTERN = /\b(sign-?off|signing-?off)\b/i;
const WEATHER_PATTERN =
  /\b(weather|temperature|forecast)\b|how'?s\b.*\bweather\b|what'?s\b.*\bweather\b/i;
const CAPABILITY_PATTERN =
  /\b(what\s+can\s+you\s+do|what\s+else\s+can\s+you\s+do|what\s+are\s+you\s+capable|your\s+capabilities|help\s+me\s+with|what\s+do\s+you\s+do)\b/i;
const CAPABILITY_SUMMARY =
  "- Open/quit apps and tabs\n- Manage agenda (add/list/update/delete/move/mark)\n- Time, news, weather (NYC default)\n- Rewrite/rephrase/polish text and paste it back\n- Summarize text or screen\n- Dictation: type what you say\n- Chat with clear opinions\n- Click/scroll/select/cut/copy/paste on apps/web\n- Two-step flows (open app + paste or similar)\n- Notes/files: create notes, list files\n- System info\n- Hotkeys: Cmd+Shift+J toggle listen, Cmd+Shift+K stop; HUD shows status";
const CLICK_PATTERN = /\b(click|tap)\s+(?:on\s+)?(.+)/i;
const DICTATION_START_PATTERN =
  /(start|begin|enter)\s+(dictation|typing)|^dictate\b|^now write for me\b|^write for me\b|^start writing\b/i;
const DICTATION_STOP_PATTERN =
  /(stop|end|exit)\s+(dictation|typing|writing)|^stop dictation\b|^stop writing\b|^exit dictation\b/i;
const MARK_DONE_PATTERN = /^mark\s+(.+?)\s+as\s+(?:done|complete)$/i;
const MOVE_TOMORROW_PATTERN = /^(?:shift|move)\s+(.+?)\s+to\s+tomorrow$/i;
const HELP_WITH_PATTERNS = [/^help me with\s+(.+)/i, /^help with\s+(.+)/i];
const FACT_REQUEST_PATTERN =
  /(tell me (a )?(random )?fact|something interesting|interesting fact|fun fact)/i;
const JOKE_REQUEST_PATTERN = /(tell me (a )?(joke|funny))/i;
const DELETE_AGENDA_FUZZY = /(remove|delete|clear)\s+(.+?)\s+(?:from\s+)?(?:the\s+)?(?:my\s+)?agenda\b/i;

type ToolCallSpec = { name: string; args: any };
type SessionContext = { lastFocusedApp?: string; dictationMode?: boolean };
const sessionContext = new Map<string, SessionContext>();

function normalizeStepToTool(step: NormalizedStep): ToolCallSpec | null {
  switch (step.action) {
    case "open_application":
      return { name: "openApplication", args: { name: step.params.name } };
    case "open_url":
      return { name: "openUrl", args: { url: step.params.url } };
    case "youtube_search_play": {
      const query = step.params.query || "";
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
        query
      )}`;
      return { name: "openUrl", args: { url: searchUrl } };
    }
    case "find_and_click":
      return {
        name: "uiFindAndClick",
        args: { target: (step.params as any).target, appName: (step.params as any).appName },
      };
    case "find_and_click_ocr":
      return {
        name: "uiOcrClick",
        args: { target: (step.params as any).target },
      };
    case "get_time":
      return { name: "getCurrentTime", args: {} };
    case "fetch_news":
      return { name: "fetchNews", args: { query: (step.params as any).query } };
    case "play_music":
      return { name: "playMusic", args: { appName: (step.params as any).appName } };
    case "fetch_weather":
      return { name: "fetchWeather", args: { city: (step.params as any).city } };
    case "browser_click_text":
      return {
        name: "browserClickText",
        args: { text: (step.params as any).text },
      };
    case "browser_click_selector":
      return {
        name: "browserClickSelector",
        args: {
          selector: (step.params as any).selector,
          index: (step.params as any).index,
        },
      };
    case "close_tab":
      return {
        name: "closeTab",
        args: { appName: (step.params as any).appName },
      };
    case "scroll":
      return {
        name: "uiScroll",
        args: {
          direction: (step.params as any).direction,
          steps: (step.params as any).steps,
          appName: (step.params as any).appName,
        },
      };
    case "open_new_tab":
      return {
        name: "uiKeys",
        args: { key: "t", modifiers: ["command"], appName: (step.params as any).appName },
      };
    case "keypress":
      return {
        name: "uiKeys",
        args: {
          key: (step.params as any).key,
          modifiers: (step.params as any).modifiers,
          appName: (step.params as any).appName,
        },
      };
    case "click":
      return {
        name: "uiClick",
        args: { target: (step.params as any).target, appName: (step.params as any).appName },
      };
    case "type_text":
      return {
        name: "uiType",
        args: { text: (step.params as any).text, appName: (step.params as any).appName },
      };
    case "focus_app":
      return { name: "openApplication", args: { name: step.params.name } };
    default:
      return null;
  }
}

function looksLikeUrl(target: string): boolean {
  return (
    /^https?:\/\//i.test(target) ||
    /^www\./i.test(target) ||
    /^[\w-]+\.[\w.-]+/.test(target)
  );
}

function extractOpenTarget(text: string): string | null {
  const match = text.match(/\bopen\s+(?:up\s+)?(.+)/i);
  if (!match) return null;
  let target = match[1].trim();
  target = target.split(/(?:,|\.|!|\?|;|\band\b|\bthen\b)/i)[0].trim();
  return target || null;
}

function formatDictationInput(text: string): string {
  const tokens = text
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const resultParts: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const current = tokens[i];
    const next = tokens[i + 1];
    const bigram = next ? `${current.toLowerCase()} ${next.toLowerCase()}` : "";
    const lower = current.toLowerCase();

    if (["new line", "next line", "line break"].includes(bigram)) {
      resultParts.push("\n");
      i += 2;
      continue;
    }
    if (/^(full\s?stop|period)$/.test(lower)) {
      resultParts.push(".");
      i += 1;
      continue;
    }
    if (/^comma$/.test(lower)) {
      resultParts.push(",");
      i += 1;
      continue;
    }
    if (/^(question\s?mark)$/.test(lower)) {
      resultParts.push("?");
      i += 1;
      continue;
    }
    if (/^(exclamation\s?mark|exclamation\s?point)$/.test(lower)) {
      resultParts.push("!");
      i += 1;
      continue;
    }
    if (/^colon$/.test(lower)) {
      resultParts.push(":");
      i += 1;
      continue;
    }
    if (/^semicolon$/.test(lower)) {
      resultParts.push(";");
      i += 1;
      continue;
    }
    if (/^dash$/.test(lower)) {
      resultParts.push("-");
      i += 1;
      continue;
    }
    if (/^(open\s?quote|open\s?quotes)$/.test(lower)) {
      resultParts.push("\"");
      i += 1;
      continue;
    }
    if (/^(close\s?quote|close\s?quotes)$/.test(lower)) {
      resultParts.push("\"");
      i += 1;
      continue;
    }
    if (/^(open\s?paren|open\s?bracket)$/.test(lower)) {
      resultParts.push("(");
      i += 1;
      continue;
    }
    if (/^(close\s?paren|close\s?bracket)$/.test(lower)) {
      resultParts.push(")");
      i += 1;
      continue;
    }

    resultParts.push(current);
    i += 1;
  }

  // Join with spaces, then fix spacing around punctuation/newlines
  let output = resultParts.join(" ");
  output = output.replace(/\s+([.,!?;:)\]])/g, "$1");
  output = output.replace(/(\()\s+/g, "$1");
  output = output.replace(/\s*\n\s*/g, "\n");
  // Ensure a space follows periods when not ending a line.
  output = output.replace(/\.([^\s\n])/g, ". $1");

  // Capitalize first letter after newlines
  output = output
    .split("\n")
    .map((line) => {
      const trimmed = line.replace(/^\s+/, "");
      if (!trimmed) return "";
      return trimmed.replace(/^([a-z])/, (m) => m.toUpperCase());
    })
    .join("\n");

  return output.trim();
}

export async function handleQuery(
  request: QueryRequest,
  ctx: PipelineContext
): Promise<QueryResponse> {
  const { sessionId, text } = request;
  const logger = ctx.logger || console;
  const ctxState = sessionContext.get(sessionId) || {};
  sessionContext.set(sessionId, ctxState);

  const trimmedText = (text || "").trim();
  if (!sessionId) {
    throw new Error("sessionId is required");
  }
  if (!trimmedText) {
    return {
      mode: "ANSWER",
      replyText: "I didn’t catch that. Say that again, sir.",
      toolCalls: [],
      ttsAudioBase64: null,
    };
  }

  const toolRegistry = ctx.tools || getToolRegistry();

  // Dictation start/stop should take precedence and not be blocked by noise filters.
  if (DICTATION_STOP_PATTERN.test(trimmedText) && ctxState.dictationMode) {
    ctxState.dictationMode = false;
    return {
      mode: "ANSWER",
      replyText: "Dictation stopped, sir.",
      toolCalls: [],
      ttsAudioBase64: null,
    };
  }
  if (DICTATION_START_PATTERN.test(trimmedText)) {
    ctxState.dictationMode = true;
    return {
      mode: "ANSWER",
      replyText: "Dictation started. I’ll type what you say. Say “stop dictation” to exit, sir.",
      toolCalls: [],
      ttsAudioBase64: null,
    };
  }
  if (ctxState.dictationMode) {
    // While in dictation, always type the text verbatim (with dictation formatting) and ignore noise filters.
    const formattedText = formatDictationInput(trimmedText);
    if (!formattedText) {
      return {
        mode: "ACTION",
        replyText: "",
        toolCalls: [],
        ttsAudioBase64: null,
      };
    }
    const toolResult = await executeTool(
      "uiType",
      { text: formattedText, appName: undefined },
      { db: ctx.db, config: ctx.config, logger, userId: "local-user" },
      toolRegistry
    );
    ctx.db.logAction({
      sessionId,
      name: "uiType",
      status: toolResult.ok ? "success" : "error",
      input: { text: formattedText },
      output: toolResult,
    });
    return {
      mode: "ACTION",
      replyText: toolResult.ok ? "" : toolResult.message || "Typing failed.",
      toolCalls: [
        {
          name: "uiType",
          args: { text: formattedText },
          success: toolResult.ok,
          message: toolResult.message,
        },
      ],
      ttsAudioBase64: null,
    };
  }

  const simplified = trimmedText.toLowerCase().replace(/[^a-z\s]/g, " ").trim();
  const simplifiedTokens = simplified.split(/\s+/).filter(Boolean);
  const hasAsciiLetter = /[a-z]/i.test(trimmedText);
  const asciiOnly = /^[\x00-\x7F]+$/.test(trimmedText);

  // Ignore pure pleasantries/noise to avoid self-triggered chatter
  if (
    PLEASANTRY_PATTERN.test(trimmedText) ||
    (simplifiedTokens.length === 1 && NOISE_WORDS.has(simplifiedTokens[0])) ||
    (!hasAsciiLetter && trimmedText.length < 40) // ignore short non-Latin noise
  ) {
    return {
      mode: "ANSWER",
      replyText: "",
      toolCalls: [],
      ttsAudioBase64: null,
    };
  }

  // Log user message
  const loggedId = ctx.db.logMessage({
    sessionId,
    role: "user",
    mode: "USER_INPUT",
    text: trimmedText,
  });

  // Best-effort indexing for user messages
  if (loggedId) {
    indexMessage(ctx.db, loggedId, trimmedText).catch((err) => {
      logger.error(
        `[pipeline] Failed to index message for RAG: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    });
  }

  let mode: MessageMode = "ANSWER";
  let replyText = "";
  const toolCalls: ToolCallResultEntry[] = [];
  let ttsAudioBase64: string | null = null;
  const isFirstAssistantReply = !ctx.db.hasAssistantMessagesForSession(sessionId);
  const isFactRequest = FACT_REQUEST_PATTERN.test(trimmedText);
  const isJokeRequest = JOKE_REQUEST_PATTERN.test(trimmedText);
  const lastFact = ctx.db.getPreference ? ctx.db.getPreference("lastFunFact") : null;
  const lastJoke = ctx.db.getPreference ? ctx.db.getPreference("lastJoke") : null;
  let actionFailed = false;

  const runTool = async (name: string, args: any) => {
    try {
      const toolResult = await executeTool(
        name,
        args,
        { db: ctx.db, config: ctx.config, logger, userId: "local-user" },
        toolRegistry
      );

      toolCalls.push({
        name,
        args,
        success: toolResult.ok,
        message: toolResult.message,
      });
      if (!toolResult.ok) {
        actionFailed = true;
      }

      ctx.db.logAction({
        sessionId,
        name,
        status: toolResult.ok ? "success" : "error",
        input: args,
        output: toolResult,
      });

      if (toolResult.ok && name === "openApplication") {
        const openedName =
          (toolResult.data as any)?.opened?.toString() || (args && args.name);
        if (openedName) {
          ctxState.lastFocusedApp = openedName;
        }
      }

      return toolResult;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `${name} execution failed.`;
      logger.error(`[pipeline] Tool execution failed: ${message}`);

      toolCalls.push({
        name,
        args,
        success: false,
        message,
      });
      actionFailed = true;

      ctx.db.logAction({
        sessionId,
        name,
        status: "error",
        input: args,
        output: { error: message },
      });

      return { ok: false, message };
    }
  };

  // Quick deterministic actions (avoid planner ambiguity)
  const quickActionResponse = async (): Promise<QueryResponse | null> => {
    const respond = (text: string): QueryResponse => ({
      mode: "ACTION",
      replyText: text,
      toolCalls,
      ttsAudioBase64: null,
    });

    if (CAPABILITY_PATTERN.test(trimmedText)) {
      return respond(CAPABILITY_SUMMARY);
    }

    if (CLICK_PATTERN.test(trimmedText)) {
      const m = CLICK_PATTERN.exec(trimmedText);
      const raw = (m?.[2] || "").trim().replace(/[.?!]+$/, "");
      if (raw.length === 0) {
        return respond("I'm afraid I can't do that, sir. Check terminal for details.");
      }
      const target = raw;
      const axResult = await runTool("uiFindAndClick", { target, appName: ctxState.lastFocusedApp });
      if (axResult.ok) return respond("");
      const ocrResult = await runTool("uiOcrClick", { target });
      return respond(formatToolReply("uiOcrClick", { target }, ocrResult));
    }

    if (COPY_CLIPBOARD_PATTERN.test(trimmedText)) {
      const toolResult = await runTool("copyClipboard", { sessionId });
      return respond(formatToolReply("copyClipboard", { sessionId }, toolResult));
    }
    if (SELECT_TEXT_PATTERN.test(trimmedText)) {
      const toolResult = await runTool("uiKeys", {
        key: "a",
        modifiers: ["command"],
        appName: ctxState.lastFocusedApp,
      });
      return respond(formatToolReply("uiKeys", { key: "a", modifiers: ["command"] }, toolResult));
    }
    if (CUT_PATTERN.test(trimmedText)) {
      const toolResult = await runTool("uiKeys", {
        key: "x",
        modifiers: ["command"],
        appName: ctxState.lastFocusedApp,
      });
      return respond(formatToolReply("uiKeys", { key: "x", modifiers: ["command"] }, toolResult));
    }
    if (COPY_PATTERN.test(trimmedText)) {
      const toolResult = await runTool("uiKeys", {
        key: "c",
        modifiers: ["command"],
        appName: ctxState.lastFocusedApp,
      });
      return respond(formatToolReply("uiKeys", { key: "c", modifiers: ["command"] }, toolResult));
    }
    if (PASTE_PATTERN.test(trimmedText)) {
      const toolResult = await runTool("uiKeys", {
        key: "v",
        modifiers: ["command"],
        appName: ctxState.lastFocusedApp,
      });
      return respond(formatToolReply("uiKeys", { key: "v", modifiers: ["command"] }, toolResult));
    }
    if (NEWLINE_PATTERN.test(trimmedText)) {
      const toolResult = await runTool("uiKeys", {
        key: "enter",
        modifiers: [],
        appName: ctxState.lastFocusedApp,
      });
      return respond(formatToolReply("uiKeys", { key: "enter", modifiers: [] }, toolResult));
    }
    if (CLOSE_APP_PATTERN.test(trimmedText)) {
      const match = CLOSE_APP_PATTERN.exec(trimmedText);
      const app = (match?.groups?.app || "").trim() || ctxState.lastFocusedApp || "";
      if (!app) {
        return respond("Please specify which app to close.");
      }
      // Primary: Cmd+Q to quit, fallback is implicit if app ignores it.
      // Bring app frontmost, then quit keys.
      await runTool("openApplication", { name: app });
      await runTool("uiKeys", { key: "q", modifiers: ["command"], appName: app });
      await new Promise((r) => setTimeout(r, 300));
      await runTool("uiKeys", { key: "w", modifiers: ["command"], appName: app });
      if (ctxState.lastFocusedApp?.toLowerCase() === app.toLowerCase()) {
        ctxState.lastFocusedApp = undefined;
      }
      return respond("");
    }
    if (CLOSE_TAB_PATTERN.test(trimmedText)) {
      const targetApp = ctxState.lastFocusedApp || "Google Chrome";
      const toolResult = await runTool("closeTab", { appName: targetApp });
      return respond(formatToolReply("closeTab", { appName: targetApp }, toolResult));
    }
    if (SIGN_OFF_PATTERN.test(trimmedText)) {
      const closingLine = "Signing off now, sir. Closing the app.";
      // Quit Jarvis itself (front-end app) after a short delay for TTS to finish.
      await new Promise((r) => setTimeout(r, 3000));
      await runTool("uiKeys", { key: "q", modifiers: ["command"], appName: "JarvisApp" });
      await new Promise((r) => setTimeout(r, 300));
      await runTool("uiKeys", { key: "w", modifiers: ["command"], appName: "JarvisApp" });
      ctxState.lastFocusedApp = undefined;
      return respond(closingLine);
    }
    if (REWRITE_PATTERN.test(trimmedText)) {
      // Capture text via OCR (or selection), rephrase, paste back.
      const scan = await runTool("screenRead", {});
      let rewritten = "";
      if (scan.ok) {
        const screenText = (scan.data as any)?.text || "";
        if (screenText) {
          try {
            const recent = ctx.db
              .getRecentMessages(sessionId, 3)
              .map((m) => ({ role: m.role, content: m.text }));
            const preferences = ctx.db.getAllPreferences();
            rewritten = await generateAnswer({
              text: `Rewrite the following text to be clearer, more polished, and concise. Keep meaning intact. Return ONLY the rewritten text with no preamble, headers, or commentary.\n\n${screenText}`,
              recentMessages: recent,
              preferences,
              isFirstReply: false,
              jokeRequest: false,
              factRequest: false,
              lastFact,
              lastJoke,
              styleHint: "Tone: crisp, polished, concise. Preserve meaning. Avoid lists unless already present.",
            });
          } catch {
            rewritten = "";
          }
        }
      }
      if (rewritten) {
        await runTool("copyClipboard", { text: rewritten, sessionId });
        await runTool("uiKeys", { key: "v", modifiers: ["command"], appName: ctxState.lastFocusedApp });
        return respond(rewritten);
      }
      return respond("I'm afraid I can't do that, sir. Check terminal for details.");
    }
    if (EMBEDDED_FLOW_PATTERN.test(trimmedText)) {
      const m = EMBEDDED_FLOW_PATTERN.exec(trimmedText);
      const app = (m?.[1] || "").trim() || "Microsoft Word";
      const steps: { name: string; args: any }[] = [];
      steps.push({ name: "openApplication", args: { name: app } });
      steps.push({ name: "uiKeys", args: { key: "v", modifiers: ["command"], appName: app } });
      // Screen read then summarize
      const scan = await runTool("screenRead", {});
      let summary = "";
      if (scan.ok) {
        const screenText = (scan.data as any)?.text || "";
        if (screenText) {
          try {
            const recent = ctx.db
              .getRecentMessages(sessionId, 3)
              .map((m) => ({ role: m.role, content: m.text }));
            const preferences = ctx.db.getAllPreferences();
            summary = await generateAnswer({
              text: `Summarize this text in 100-140 words, clear and concise:\n\n${screenText}`,
              recentMessages: recent,
              preferences,
              isFirstReply: false,
              jokeRequest: false,
              factRequest: false,
              lastFact,
              lastJoke,
              styleHint: DEBATE_STYLE_HINT,
            });
          } catch (err) {
            summary = "";
          }
        }
      }
      if (summary) {
        await runTool("copyClipboard", { text: summary, sessionId });
        return respond(summary);
      }
      return respond("I'm afraid I can't do that, sir. Check terminal for details.");
    }
    if (EMBEDDED_PASTE_SUMMARY_PATTERN.test(trimmedText)) {
      const m = EMBEDDED_PASTE_SUMMARY_PATTERN.exec(trimmedText);
      const app = (m?.[1] || "").trim() || "Microsoft Word";
      const wantsClipboard = !!m?.[4];

      // Open app
      const openResult = await runTool("openApplication", { name: app });
      if (openResult.ok) {
        ctxState.lastFocusedApp =
          (openResult.data as any)?.opened?.toString() || app;
      }

      // Paste into app (best-effort)
      await runTool("uiKeys", { key: "v", modifiers: ["command"], appName: app });

      // Screen read + summarize
      const scan = await runTool("screenRead", {});
      let summary = "";
      if (scan.ok) {
        const screenText = (scan.data as any)?.text || "";
        if (screenText) {
          try {
            const recent = ctx.db
              .getRecentMessages(sessionId, 3)
              .map((m) => ({ role: m.role, content: m.text }));
            const preferences = ctx.db.getAllPreferences();
            summary = await generateAnswer({
              text: `Summarize this text in 100-140 words, clear and concise:\n\n${screenText}`,
              recentMessages: recent,
              preferences,
              isFirstReply: false,
              jokeRequest: false,
              factRequest: false,
              lastFact,
              lastJoke,
              styleHint: DEBATE_STYLE_HINT,
            });
          } catch {
            summary = "";
          }
        }
      }

      if (summary) {
        if (wantsClipboard) {
          await runTool("copyClipboard", { text: summary, sessionId });
        }
        return respond(summary);
      }
      return respond("I'm afraid I can't do that, sir. Check terminal for details.");
    }
    if (SEQUENTIAL_PATTERN.test(trimmedText) && /open\s+[a-zA-Z0-9 ._-]+/.test(trimmedText)) {
      const segments = trimmedText
        .split(/\bthen\b/gi)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 2);

      let currentApp = ctxState.lastFocusedApp || "";
      let summaryText = "";
      let didAnything = false;
      const delay = async (ms = 200) => new Promise((r) => setTimeout(r, ms));
      const status: string[] = [];

      for (const seg of segments) {
        // Isolate intent: strip stopwords and punctuation for matching
        const lower = seg
          .toLowerCase()
          .replace(/[.,!?;:]/g, " ")
          .replace(/\b(and|then|please|kindly|now|sir)\b/g, " ")
          .trim();

        if (lower.includes("open")) {
          const target =
            extractOpenTarget(seg) ||
            seg.replace(/open/i, "").replace(/,.*$/, "").trim();
          const appName = target || "Microsoft Word";
          const openResult = await runTool("openApplication", { name: appName });
          if (!openResult.ok) return respond(formatToolReply("openApplication", { name: appName }, openResult));
          currentApp = (openResult.data as any)?.opened?.toString() || appName;
          ctxState.lastFocusedApp = currentApp;
          didAnything = true;
          status.push(`Opened ${currentApp || appName}.`);
          await delay();
          continue;
        }

        if (lower.includes("blank document") || lower.includes("blank doc") || lower.includes("new document")) {
          const clickResult = await runTool("uiFindAndClick", {
            target: "Blank Document",
            appName: currentApp || ctxState.lastFocusedApp,
          });
          if (!clickResult.ok) {
            status.push("Could not click Blank Document.");
            return respond(status.join(" "));
          }
          didAnything = true;
          status.push("Clicked Blank Document.");
          await delay();
          continue;
        }

        if (lower.includes("paste")) {
          await runTool("uiKeys", { key: "v", modifiers: ["command"], appName: currentApp || ctxState.lastFocusedApp });
          didAnything = true;
          status.push("Pasted clipboard.");
          await delay();
          continue;
        }

        if (lower.includes("summarize")) {
          const scan = await runTool("screenRead", {});
          if (scan.ok) {
            const screenText = (scan.data as any)?.text || "";
            if (screenText) {
              try {
                const recent = ctx.db
                  .getRecentMessages(sessionId, 3)
                  .map((m) => ({ role: m.role, content: m.text }));
                const preferences = ctx.db.getAllPreferences();
                summaryText = await generateAnswer({
                  text: `Summarize this text in 100-140 words, clear and concise:\n\n${screenText}`,
                  recentMessages: recent,
                  preferences,
                  isFirstReply: false,
                  jokeRequest: false,
                  factRequest: false,
                  lastFact,
                  lastJoke,
                  styleHint: DEBATE_STYLE_HINT,
                });
                status.push("Summarized on-screen text.");
              } catch {
                summaryText = "";
                status.push("Summarize failed.");
              }
            } else {
              status.push("Skipped summarize (no text read).");
            }
          } else {
            status.push("Screen read failed.");
          }
          didAnything = true;
          await delay();
          continue;
        }

        if (lower.includes("copy") && lower.includes("clipboard")) {
          if (summaryText) {
            await runTool("copyClipboard", { text: summaryText, sessionId });
            status.push("Copied summary to clipboard.");
            didAnything = true;
          } else {
            status.push("No summary to copy.");
          }
          await delay();
          continue;
        }
      }

      if (summaryText) {
        return respond(summaryText);
      }
      if (didAnything) {
        return respond(status.join(" "));
      }
      // otherwise fall through to planner
    }
    return null;
  };

  const formatToolReply = (
    name: string,
    args: any,
    result: any
  ): string => {
    switch (name) {
      case "openApplication": {
        const appName = args.name;
        const openedName = result?.data?.opened || appName;
        return result?.ok
          ? ""
          : "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "openUrl": {
        const url = args.url;
        return result?.ok
          ? ""
          : "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "createNote": {
        const filePath = result?.data?.filePath;
        return result?.ok
          ? `Created note at ${filePath || "notes directory"}.`
          : "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "listFiles": {
        if (result?.ok) {
          const files = result?.data?.files || [];
          const names = files.map((f: any) => f.name).join(", ") || "No files.";
          return `Files in ${args.path}: ${names}`;
        }
        return "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "getSystemInfo": {
        if (result?.ok) {
          const data = result.data as any;
          return `System info: ${data.platform} ${data.release} (${data.arch}), host ${data.hostname}, uptime ${data.uptimeSec}s.`;
        }
        return "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "addAgendaItem": {
        if (result?.ok) {
          const item = result.data as any;
          return `Added “${item.title}” for ${item.dueDate}.`;
        }
        return "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "listAgenda": {
        if (result?.ok) {
          const items = (result.data as any)?.items || [];
          if (!items.length) return "You have no items on your agenda for today.";
          const lines = items.map(
            (item: any) => `${item.title} (${item.status || "TODO"})`
          );
          return `Here’s your agenda for today:\n${lines.join("\n")}`;
        }
        return "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "getCurrentTime": {
        if (result?.ok) {
          const t = result.data as any;
          const spoken = t.timeSpoken || t.timeOnly || t.display || t.iso;
          return `Current time: ${spoken}`;
        }
        return "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "fetchNews": {
        if (result?.ok) {
          const headlines = (result.data as any)?.headlines || [];
          if (!headlines.length) return "No headlines found.";
          return `Top headlines:\n${headlines.map((h: string) => `- ${h}`).join("\n")}`;
        }
        return "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "fetchWeather": {
        if (result?.ok) {
          const summary = (result.data as any)?.summary || "";
          return summary || "";
        }
        return "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "uiKeys": {
        return result?.ok
          ? ""
          : "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "uiOcrClick": {
        return result?.ok
          ? `Clicked ${args.target || "target"} via OCR.`
          : "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "browserClickText": {
        return result?.ok
          ? `Clicked ${args.text || "target"} via browser DOM.`
          : "";
      }
      case "browserClickSelector": {
        return result?.ok ? "" : "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "closeTab": {
        return result?.ok ? "" : "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "screenRead": {
        if (result?.ok) {
          const txt = (result.data as any)?.text || "";
          const preview = txt.slice(0, 1200);
          return preview
            ? `Screen text (OCR):\n${preview}`
            : "Screen read completed but no text was detected.";
        }
        return "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "playMusic": {
        return result?.ok ? "" : "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "copyClipboard": {
        return result?.ok ? "Copied to clipboard." : "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "closeApplication": {
        return result?.ok ? "" : "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "uiFindAndClick": {
        return result?.ok
          ? ""
          : "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "uiScroll": {
        return result?.ok
          ? ""
          : "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      case "updateAgendaByTitle": {
        if (result?.ok) {
          const item = result.data as any;
          if (item.status === "MOVED") {
            return `Moved “${item.title}” to ${item.dueDate}.`;
          }
          if (item.status === "DONE") {
            return `Marked “${item.title}” as done.`;
          }
          return `Updated “${item.title}” to ${item.status}.`;
        }
        return (
          result?.message ||
          `I couldn’t find any agenda item matching “${args.titleSubstring}” for today.`
        );
      }
      case "updateAgendaStatus": {
        if (result?.ok) {
          return `Updated agenda item ${args.id} to ${args.status}.`;
        }
        return "I'm afraid I can't do that, sir. Check terminal for details.";
      }
      default:
        return result?.ok
          ? `Completed ${name}.`
          : "I'm afraid I can't do that, sir. Check terminal for details.";
    }
  };

  let handled = false;

  // Early shortcut handling
  const quick = await quickActionResponse();
  if (quick) {
    return quick;
  }

  // LLM planner path
  try {
    const availableTools = (Object.values(toolRegistry) as any[]).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters?.properties || {},
    }));
    const recentForPlanner = ctx.db
      .getRecentMessages(sessionId, 5)
      .map((m) => ({ role: m.role, content: m.text }));

    const planResult: PlanResult = await planWithLlm({
      text: trimmedText,
      availableTools,
      recentMessages: recentForPlanner,
    });

    const validPlans = (planResult.plannedTools || []).filter(
      (p) => !!toolRegistry[p.name]
    );

    if (validPlans.length > 0) {
      mode = "ACTION";
      const lines: string[] = [];
      const executed: { name: string; args: any; result: any }[] = [];
      for (const plan of validPlans) {
        const result = await runTool(plan.name, plan.args || {});
        executed.push({ name: plan.name, args: plan.args, result });
        lines.push(formatToolReply(plan.name, plan.args, result));
      }

      const summary = lines.filter((l) => l && l.trim()).join(" ");
      if (planResult.mode === "MIXED" || planResult.mode === "TASK") {
        if (summary) {
          try {
            const preferences = ctx.db.getAllPreferences();
            const llmReply = await generateAnswer({
              text: `${trimmedText}\nContext: ${summary}`,
              recentMessages: [...recentForPlanner],
              preferences,
              isFirstReply: false,
              jokeRequest: isJokeRequest,
              factRequest: isFactRequest,
              lastFact,
              lastJoke,
            });
            replyText = lines.join("\n");
            if (llmReply) {
              replyText = replyText
                ? `${replyText}\n\n${llmReply}`
                : llmReply;
            }
          } catch (error) {
            logger.error(
              `[pipeline] LLM follow-up failed: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            replyText = lines.join("\n");
          }
        } else {
          replyText = lines.join("\n");
        }
      } else {
        replyText = lines.join("\n");
      }

      handled = true;
    }
  } catch (error) {
    logger.error(
      `[pipeline] Planner failed, falling back to patterns: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  let normalizedSteps: NormalizedStep[] = [];
  if (!handled) {
    normalizedSteps = await normalizeIntent(trimmedText);
  }

  // Dictation mode handling
  if (DICTATION_STOP_PATTERN.test(trimmedText) && ctxState.dictationMode) {
    ctxState.dictationMode = false;
    return {
      mode: "ANSWER",
      replyText: "Dictation stopped, sir.",
      toolCalls,
      ttsAudioBase64: null,
    };
  }
  if (DICTATION_START_PATTERN.test(trimmedText)) {
    ctxState.dictationMode = true;
    return {
      mode: "ANSWER",
      replyText: "Dictation started. I’ll type what you say. Say “stop dictation” to exit, sir.",
      toolCalls,
      ttsAudioBase64: null,
    };
  }
  if (ctxState.dictationMode) {
    mode = "ACTION";
    const formattedText = formatDictationInput(trimmedText);
    if (!formattedText) {
      return {
        mode: "ACTION",
        replyText: "",
        toolCalls,
        ttsAudioBase64: null,
      };
    }
    const toolResult = await runTool("uiType", { text: formattedText, appName: undefined });
    replyText = toolResult.ok ? "" : toolResult.message || "Typing failed.";
    return {
      mode: "ACTION",
      replyText,
      toolCalls,
      ttsAudioBase64: null,
    };
  }

  const openTarget = extractOpenTarget(trimmedText);

  if (handled) {
    // no-op, continue to logging below
  } else if (normalizedSteps.length > 0) {
    mode = "ACTION";
    const lines: string[] = [];
    for (const step of normalizedSteps) {
      // Default appName for app-scoped actions if not provided.
      const stepParams = (step as any).params || {};
      if (
        !("appName" in stepParams) &&
        ["open_new_tab", "keypress", "click", "type_text"].includes((step as any).action) &&
        ctxState.lastFocusedApp
      ) {
        stepParams.appName = ctxState.lastFocusedApp;
        (step as any).params = stepParams;
      }

      const toolCall = normalizeStepToTool(step);
      if (!toolCall) continue;

      // For open_new_tab, ensure the app is frontmost before sending the shortcut.
      if (step.action === "open_new_tab") {
        const targetApp =
          (step.params as any)?.appName || ctxState.lastFocusedApp || "";
        if (targetApp) {
          const focusResult = await runTool("openApplication", { name: targetApp });
          if (focusResult.ok) {
            ctxState.lastFocusedApp = targetApp;
          } else {
            lines.push(
              `Failed to focus ${targetApp}: ${focusResult.message || "Unknown error."}`
            );
            break;
          }
          // Use uiKeys to send Cmd+T
          const keyResult = await runTool("uiKeys", {
            key: "t",
            modifiers: ["command"],
            appName: targetApp,
          });
          lines.push(formatToolReply("uiKeys", { key: "t", modifiers: ["command"] }, keyResult));
          if (!keyResult.ok) break;
          continue;
        } else {
          lines.push("No recent app to open a new tab in. Please specify the app.");
          break;
        }
      }

      if (step.action === "focus_app") {
        const focusResult = await runTool(toolCall.name, toolCall.args);
        if (focusResult.ok) {
          ctxState.lastFocusedApp =
            (focusResult.data as any)?.opened?.toString() || toolCall.args?.name;
        }
        lines.push(formatToolReply(toolCall.name, toolCall.args, focusResult));
        if (!focusResult.ok) break;
        continue;
      }

      // For find_and_click: skip DOM for now, do AX then OCR.
      if (step.action === "find_and_click") {
        // Try DOM click first; if it fails, do not surface the failure—fall back quietly.
        const domResult = await runTool("browserClickText", { text: (step as any).params.target });
        if (domResult.ok) {
          lines.push(formatToolReply("browserClickText", { text: (step as any).params.target }, domResult));
          continue;
        }

        const result = await runTool(toolCall.name, toolCall.args);
        lines.push(formatToolReply(toolCall.name, toolCall.args, result));
        if (result.ok) continue;

        const ocrResult = await runTool("uiOcrClick", { target: (step as any).params.target });
        lines.push(formatToolReply("uiOcrClick", { target: (step as any).params.target }, ocrResult));
        if (!ocrResult.ok) break;
        continue;
      }

      const result = await runTool(toolCall.name, toolCall.args);
      lines.push(formatToolReply(toolCall.name, toolCall.args, result));
      if (!result.ok) {
        // stop further steps on failure to avoid cascading errors
        break;
      }
    }
    replyText = lines.join("\n");
  } else if (SCREEN_SUMMARY_PATTERN.test(trimmedText)) {
    mode = "ACTION";
    let screenText = "";
    let scanMessage = "";

    // First try full-screen OCR
    const scanResult = await runTool("screenRead", {});
    if (scanResult.ok) {
      screenText = (scanResult.data as any)?.text || "";
      if (!screenText) {
        scanMessage = "OCR returned no text.";
      }
    } else {
      scanMessage = scanResult.message || "OCR failed.";
    }

    // Fallback: accessibility snapshot (names/roles) if OCR is empty/failed
    if (!screenText) {
      const snapResult = await runTool("uiSnapshot", {});
      if (snapResult.ok) {
        const items = (snapResult.data as any)?.items || [];
        const names = items
          .map((i: any) => `${i.window} ${i.role} ${i.name}`.trim())
          .filter(Boolean);
        screenText = names.join("\n");
        if (!screenText) {
          scanMessage = scanMessage || "Snapshot contained no readable names.";
        }
      } else {
        scanMessage = snapResult.message || scanMessage;
      }
    }

    if (screenText) {
      try {
        const recent = ctx.db
          .getRecentMessages(sessionId, 5)
          .map((m) => ({ role: m.role, content: m.text }));
        const preferences = ctx.db.getAllPreferences();
        replyText = await generateAnswer({
          text: `Summarize the on-screen text into a single paragraph of roughly 150–200 words (you may go up to ~220 words if needed for clarity). Keep it coherent, readable, and avoid bullet points. Use only the provided text as source.\n\nText:\n${screenText}`,
          recentMessages: recent,
          preferences,
          isFirstReply: false,
          jokeRequest: isJokeRequest,
          factRequest: isFactRequest,
          lastFact,
          lastJoke,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown LLM error";
        logger.error(`[pipeline] LLM error on screen summary: ${message}`);
        replyText = "I’m afraid I can’t do that, sir. Check terminal for details.";
      }
    } else {
      replyText =
        "I’m afraid I can’t do that, sir. Check terminal for details.";
    }
  } else if (COPY_CLIPBOARD_PATTERN.test(trimmedText)) {
    mode = "ACTION";
    const toolResult = await runTool("copyClipboard", { sessionId });
    replyText = formatToolReply("copyClipboard", { sessionId }, toolResult);
  } else if (SELECT_TEXT_PATTERN.test(trimmedText)) {
    mode = "ACTION";
    const toolResult = await runTool("uiKeys", {
      key: "a",
      modifiers: ["command"],
      appName: ctxState.lastFocusedApp,
    });
    replyText = formatToolReply("uiKeys", { key: "a", modifiers: ["command"] }, toolResult);
  } else if (CUT_PATTERN.test(trimmedText)) {
    mode = "ACTION";
    const toolResult = await runTool("uiKeys", {
      key: "x",
      modifiers: ["command"],
      appName: ctxState.lastFocusedApp,
    });
    replyText = formatToolReply("uiKeys", { key: "x", modifiers: ["command"] }, toolResult);
  } else if (COPY_PATTERN.test(trimmedText)) {
    mode = "ACTION";
    const toolResult = await runTool("uiKeys", {
      key: "c",
      modifiers: ["command"],
      appName: ctxState.lastFocusedApp,
    });
    replyText = formatToolReply("uiKeys", { key: "c", modifiers: ["command"] }, toolResult);
  } else if (PASTE_PATTERN.test(trimmedText)) {
    mode = "ACTION";
    const toolResult = await runTool("uiKeys", {
      key: "v",
      modifiers: ["command"],
      appName: ctxState.lastFocusedApp,
    });
    replyText = formatToolReply("uiKeys", { key: "v", modifiers: ["command"] }, toolResult);
  } else if (NEWLINE_PATTERN.test(trimmedText)) {
    mode = "ACTION";
    const toolResult = await runTool("uiKeys", {
      key: "enter",
      modifiers: [],
      appName: ctxState.lastFocusedApp,
    });
    replyText = formatToolReply("uiKeys", { key: "enter", modifiers: [] }, toolResult);
  } else if (CLOSE_TAB_PATTERN.test(trimmedText)) {
    mode = "ACTION";
    const targetApp = ctxState.lastFocusedApp || "Google Chrome";
    const toolResult = await runTool("closeTab", { appName: targetApp });
    replyText = formatToolReply("closeTab", { appName: targetApp }, toolResult);
  } else if (WEATHER_PATTERN.test(trimmedText)) {
    mode = "ACTION";
    const cityMatch = trimmedText.match(/in\s+([a-zA-Z\s]+)$/i);
    const city = cityMatch?.[1]?.trim();
    const toolResult = await runTool("fetchWeather", { city: city || "" });
    replyText = formatToolReply("fetchWeather", { city: city || "" }, toolResult);
  } else if (OPEN_URL_PREFIX.test(trimmedText)) {
    const url = trimmedText.replace(OPEN_URL_PREFIX, "").trim();
    mode = "ACTION";
    const toolResult = await runTool("openUrl", { url });
    replyText = toolResult.ok
      ? `Opening ${url}.`
      : `Failed to open URL: ${toolResult.message || "Unknown error."}`;
  } else if (OPEN_APP_PREFIX.test(trimmedText)) {
    const appName = trimmedText.replace(OPEN_APP_PREFIX, "").trim();
    mode = "ACTION";
    if (!appName) {
      replyText = "Please specify an application to open.";
    } else {
      const toolResult = await runTool("openApplication", { name: appName });
      const openedName =
        (toolResult.data as any)?.opened?.toString() || appName;
      replyText = toolResult.ok
        ? `Opening ${openedName}.`
        : `Failed to open ${appName}: ${toolResult.message || "Unknown error."}`;
    }
  } else if (openTarget) {
    mode = "ACTION";
    if (looksLikeUrl(openTarget)) {
      const toolResult = await runTool("openUrl", { url: openTarget });
      replyText = toolResult.ok
        ? `Opening ${openTarget}.`
        : `Failed to open URL: ${toolResult.message || "Unknown error."}`;
    } else {
      const toolResult = await runTool("openApplication", { name: openTarget });
      const openedName =
        (toolResult.data as any)?.opened?.toString() || openTarget;
      replyText = toolResult.ok
        ? `Opening ${openedName}.`
        : `Failed to open ${openTarget}: ${
            toolResult.message || "Unknown error."
          }`;
    }
  } else if (CREATE_NOTE_PREFIX.test(trimmedText)) {
    const content = trimmedText.replace(CREATE_NOTE_PREFIX, "").trim();
    mode = "ACTION";
    const title = `Note-${Date.now()}`;
    const toolResult = await runTool("createNote", { title, content });
    replyText = toolResult.ok
      ? `Created note at ${(toolResult.data as any)?.filePath || "notes directory"}.`
      : `Failed to create note: ${toolResult.message || "Unknown error."}`;
  } else if (LIST_FILES_PREFIX.test(trimmedText)) {
    const targetPath = trimmedText.replace(LIST_FILES_PREFIX, "").trim();
    mode = "ACTION";
    const toolResult = await runTool("listFiles", { path: targetPath });
    if (toolResult.ok) {
      const files = (toolResult.data as any)?.files || [];
      const names = files.map((f: any) => f.name).join(", ") || "No files.";
      replyText = `Files in ${targetPath}: ${names}`;
    } else {
      replyText = `Failed to list files: ${toolResult.message || "Unknown error."}`;
    }
  } else if (DELETE_AGENDA_FUZZY.test(trimmedText)) {
    const match = DELETE_AGENDA_FUZZY.exec(trimmedText);
    const title = match?.[2]?.trim();
    mode = "ACTION";
    if (!title) {
      replyText = "Please specify which agenda item to remove.";
    } else {
      const toolResult = await runTool("deleteAgendaByTitle", {
        titleSubstring: title,
      });
      replyText = toolResult.ok
        ? `Removed “${title}” from today’s agenda.`
        : toolResult.message ||
          `I couldn’t find any agenda item matching “${title}” for today.`;
    }
  } else if (ADD_AGENDA_FUZZY.test(trimmedText)) {
    const match = ADD_AGENDA_FUZZY.exec(trimmedText);
    const raw = match?.[2] || "";
    const parts = raw
      .split(/(?:,|\band\b)/i)
      .map((p) => p.trim())
      .filter(Boolean);
    mode = "ACTION";
    if (!parts.length) {
      replyText = "Please provide an agenda item to add.";
    } else {
      for (const item of parts) {
        const toolResult = await runTool("addAgendaItem", { title: item });
        ctx.db.logAction({
          sessionId,
          name: "addAgendaItem",
          status: toolResult.ok ? "success" : "error",
          input: { title: item, dueDate: "today" },
          output: toolResult,
        });
        if (!toolResult.ok) {
          replyText =
            toolResult.message ||
            `“${item}” is already on your agenda for today.`;
          return {
            mode: "ACTION",
            replyText,
            toolCalls,
            ttsAudioBase64: null,
          };
        }
      }
      replyText =
        parts.length === 1
          ? `Added 1 item to today’s agenda: ${parts[0]}.`
          : `Added ${parts.length} items to today’s agenda: ${parts.join(", ")}.`;
    }
  } else if (ADD_TODAY_AGENDA_PREFIXES.some((p) => p.test(trimmedText))) {
    const prefix = ADD_TODAY_AGENDA_PREFIXES.find((p) => p.test(trimmedText))!;
    const remainder = trimmedText.replace(prefix, "").trim();
    const parts =
      remainder.indexOf(",") >= 0
        ? remainder.split(",").map((p) => p.trim()).filter(Boolean)
        : [remainder].filter(Boolean);
    mode = "ACTION";
    if (parts.length === 0) {
      replyText = "Please provide at least one agenda item to add.";
    } else {
      for (const item of parts) {
        await runTool("addAgendaItem", { title: item });
        ctx.db.logAction({
          sessionId,
          name: "addAgendaItem",
          status: "success",
          input: { title: item, dueDate: "today" },
          output: { ok: true },
        });
      }
      replyText =
        parts.length === 1
          ? `Added 1 item to today’s agenda: ${parts[0]}.`
          : `Added ${parts.length} items to today’s agenda: ${parts.join(", ")}.`;
    }
  } else if (LIST_TODAY_AGENDA_PATTERNS.some((p) => p.test(trimmedText)) || LIST_AGENDA_FUZZY.test(trimmedText) || LIST_AGENDA_FUZZY_ALT.test(trimmedText)) {
    mode = "ACTION";
    const toolResult = await runTool("listAgenda", {});
    if (toolResult.ok) {
      const items = (toolResult.data as any)?.items || [];
      if (!items.length) {
        replyText = "You have no items on your agenda for today.";
        ctx.db.logAction({
          sessionId,
          name: "listAgenda",
          status: "success",
          input: { dueDate: "today" },
          output: { ok: true, items },
        });
      } else {
        const lines = items.map(
          (item: any) => `${item.title} (${item.status || "TODO"})`
        );
        replyText = `Here’s your agenda for today:\n${lines.join("\n")}`;
        ctx.db.logAction({
          sessionId,
          name: "listAgenda",
          status: "success",
          input: { dueDate: "today" },
          output: { ok: true, items },
        });
      }
    } else {
      replyText = `Failed to fetch agenda: ${toolResult.message || "Unknown error."}`;
    }
  } else if (MARK_DONE_PATTERN.test(trimmedText)) {
    const match = MARK_DONE_PATTERN.exec(trimmedText);
    const title = match?.[1]?.trim();
    mode = "ACTION";
    if (!title) {
      replyText = "Please specify which item to mark as done.";
    } else {
      const toolResult = await runTool("updateAgendaByTitle", {
        titleSubstring: title,
        status: "DONE",
        moveToTomorrow: false,
      });
      if (toolResult.ok) {
        replyText = `Marked “${title}” as done.`;
      } else {
        replyText =
          toolResult.message ||
          `I couldn’t find any agenda item matching “${title}” for today.`;
      }
    }
  } else if (MOVE_TOMORROW_PATTERN.test(trimmedText)) {
    const match = MOVE_TOMORROW_PATTERN.exec(trimmedText);
    const title = match?.[1]?.trim();
    mode = "ACTION";
    if (!title) {
      replyText = "Please specify which item to move to tomorrow.";
    } else {
      const toolResult = await runTool("updateAgendaByTitle", {
        titleSubstring: title,
        status: "MOVED",
        moveToTomorrow: true,
      });
      if (toolResult.ok) {
        replyText = `Moved “${title}” to tomorrow.`;
      } else {
        replyText =
          toolResult.message ||
          `I couldn’t find any agenda item matching “${title}” for today.`;
      }
    }
  } else if (/^(?:update|mark)\s+(.+?)\s+as\s+(todo|done|moved)$/i.test(trimmedText)) {
    const m = trimmedText.match(/^(?:update|mark)\s+(.+?)\s+as\s+(todo|done|moved)$/i);
    const title = m?.[1]?.trim();
    const status = m?.[2]?.toUpperCase() as "TODO" | "DONE" | "MOVED" | undefined;
    mode = "ACTION";
    if (!title || !status) {
      replyText = "Please specify an item and status (TODO, DONE, or MOVED).";
    } else {
      const toolResult = await runTool("updateAgendaByTitle", {
        titleSubstring: title,
        status,
        moveToTomorrow: status === "MOVED",
      });
      replyText = toolResult.ok
        ? `Updated “${title}” to ${status}.`
        : toolResult.message ||
          `I couldn’t find any agenda item matching “${title}” for today.`;
    }
  } else if (SYSTEM_INFO_PATTERN.test(trimmedText)) {
    mode = "ACTION";
    const toolResult = await runTool("getSystemInfo", {});
    if (toolResult.ok) {
      const data = toolResult.data as any;
      replyText = `System info: ${data.platform} ${data.release} (${data.arch}), host ${data.hostname}, uptime ${data.uptimeSec}s.`;
    } else {
      replyText = `Failed to retrieve system info: ${
        toolResult.message || "Unknown error."
      }`;
    }
  } else if (REMEMBER_NAME_PATTERN.test(trimmedText)) {
    mode = "ACTION";
    const match = REMEMBER_NAME_PATTERN.exec(trimmedText);
    const name = match?.[1]?.trim();
    if (name) {
      ctx.db.setPreference("userName", name);
      ctx.db.logAction({
        sessionId,
        name: "setPreference",
        status: "success",
        input: { key: "userName", value: name },
        output: { ok: true },
      });
      replyText = `Okay, I'll remember your name is ${name}.`;
    } else {
      replyText = "I couldn't catch the name to remember.";
    }
  } else if (KEEP_SHORT_PATTERN.test(trimmedText)) {
    mode = "ACTION";
    ctx.db.setPreference("verbosity", "short");
    ctx.db.logAction({
      sessionId,
      name: "setPreference",
      status: "success",
      input: { key: "verbosity", value: "short" },
      output: { ok: true },
    });
    replyText = "Got it. I'll keep answers short.";
  } else if (HELP_WITH_PATTERNS.some((p) => p.test(trimmedText))) {
    mode = "ANSWER";
    const matcher = HELP_WITH_PATTERNS.find((p) => p.test(trimmedText))!;
    const taskText = matcher.exec(trimmedText)?.[1]?.trim() || trimmedText;
    const today = new Date();
    const year = today.getFullYear();
    const month = `${today.getMonth() + 1}`.padStart(2, "0");
    const day = `${today.getDate()}`.padStart(2, "0");
    const todayISO = `${year}-${month}-${day}`;
    const agenda = ctx.db.findAgendaItemByTitleSubstring({
      userId: "local-user",
      search: taskText,
      dueDate: todayISO,
    });
    const recent = ctx.db
      .getRecentMessages(sessionId, 5)
      .map((m) => ({ role: m.role, content: m.text }));
    const ragSnippets = await getRagContext(ctx.db, trimmedText, { limit: 5 });
    const ragContextMessages = ragSnippets.map((snippet) => ({
      role: "assistant" as const,
      content: `Context: ${snippet}`,
    }));
  const preferences = ctx.db.getAllPreferences();
  const injectedContext = agenda
    ? [
        {
          role: "assistant" as const,
            content: `Agenda item: ${agenda.title} (status: ${agenda.status}, due: ${agenda.dueDate}).`,
          },
        ]
      : [];
    try {
      replyText = await generateAnswer({
        text: trimmedText,
        recentMessages: [...recent, ...ragContextMessages, ...injectedContext],
        preferences,
        isFirstReply: false,
        jokeRequest: isJokeRequest,
        factRequest: isFactRequest,
        lastFact,
        lastJoke,
        styleHint: DEBATE_STYLE_HINT,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown LLM error";
      logger.error(`[pipeline] LLM error: ${message}`);
      replyText =
        "I'm having trouble reaching my brain (LLM API). Please try again.";
    }
  } else {
    mode = "ANSWER";
    try {
      const recent = ctx.db
        .getRecentMessages(sessionId, 5)
        .map((m) => ({ role: m.role, content: m.text }));
      const ragSnippets = await getRagContext(ctx.db, trimmedText, { limit: 5 });
      const ragContextMessages = ragSnippets.map((snippet) => ({
        role: "assistant" as const,
        content: `Context: ${snippet}`,
      }));
      const preferences = ctx.db.getAllPreferences();
      replyText = await generateAnswer({
        text: trimmedText,
        recentMessages: [...recent, ...ragContextMessages],
        preferences,
        isFirstReply: isFirstAssistantReply,
        jokeRequest: isJokeRequest,
        factRequest: isFactRequest,
        lastFact,
        lastJoke,
        styleHint: DEBATE_STYLE_HINT,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown LLM error";
      logger.error(`[pipeline] LLM error: ${message}`);
      replyText =
        "I'm afraid I can't do that, sir. Check terminal for details.";
    }
  }

  ctx.db.logMessage({
    sessionId,
    role: "assistant",
    mode,
    text: replyText,
  });

  if (isFactRequest && replyText) {
    ctx.db.setPreference("lastFunFact", replyText.slice(0, 300));
  }
  if (isJokeRequest && replyText) {
    ctx.db.setPreference("lastJoke", replyText.slice(0, 300));
  }

  if (ctx.config.ttsStubEnabled) {
    ttsAudioBase64 = Buffer.from(`TTS:${replyText}`, "utf8").toString("base64");
  } else {
    ttsAudioBase64 = await synthesizeSpeech(replyText);
  }

  return {
    mode: mode === "ACTION" ? "ACTION" : "ANSWER",
    replyText,
    toolCalls,
    ttsAudioBase64: ttsAudioBase64 ?? null,
  };
}
