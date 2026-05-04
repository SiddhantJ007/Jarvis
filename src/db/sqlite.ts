import Database from "better-sqlite3";
import path from "path";
import { AppConfig } from "../config/env";

export type MessageRole = "user" | "assistant";
export type MessageMode = "ACTION" | "ANSWER" | string;
export type AgendaStatus = "TODO" | "DONE" | "MOVED";

export type AgendaItem = {
  id: number;
  userId: string;
  title: string;
  status: AgendaStatus;
  dueDate: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
};

export interface MessageEmbedding {
  messageId: number;
  embedding: number[];
  text?: string;
}

export interface NoteEmbedding {
  path: string;
  embedding: number[];
  content?: string;
}

export interface DatabaseClient {
  logMessage: (entry: {
    sessionId: string;
    role: MessageRole;
    mode: MessageMode;
    text: string;
    timestamp?: number;
  }) => number;
  getRecentMessages: (
    sessionId: string,
    limit?: number
  ) => { role: MessageRole; text: string }[];
  getLastAssistantMessage: (
    sessionId: string
  ) => { role: MessageRole; text: string } | null;
  setPreference: (key: string, value: string) => void;
  getPreference: (key: string) => string | undefined;
  getAllPreferences: () => Record<string, string>;
  hasAssistantMessagesForSession: (sessionId: string) => boolean;
  addAgendaItem: (params: { userId: string; title: string; dueDate: string }) => number;
  listAgendaItems: (params: { userId: string; dueDate: string }) => AgendaItem[];
  updateAgendaStatusById: (
    id: number,
    status: AgendaStatus,
    newDueDate?: string | null
  ) => void;
  findAgendaItemByTitleSubstring: (params: {
    userId: string;
    search: string;
    dueDate?: string | null;
  }) => AgendaItem | null;
  deleteAgendaItemByTitleSubstring: (params: {
    userId: string;
    search: string;
    dueDate?: string | null;
  }) => boolean;
  upsertMessageEmbedding: (embedding: { messageId: number; vector: number[] }) => void;
  listMessageEmbeddings: () => MessageEmbedding[];
  upsertNoteEmbedding: (embedding: { path: string; vector: number[] }) => void;
  listNoteEmbeddings: () => NoteEmbedding[];
  logAction: (entry: {
    sessionId: string;
    name: string;
    status: string;
    input: unknown;
    output: unknown;
    timestamp?: number;
  }) => void;
  close: () => void;
  filePath: string;
}

function ensureSchema(db: Database) {
  const createMessages = `
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      mode TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    )
  `;

  const createActions = `
    CREATE TABLE IF NOT EXISTS actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      input_json TEXT,
      output_json TEXT,
      timestamp INTEGER NOT NULL
    )
  `;

  const createPreferences = `
    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `;

  const createAgendaItems = `
    CREATE TABLE IF NOT EXISTS agenda_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      due_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createMessageEmbeddings = `
    CREATE TABLE IF NOT EXISTS message_embeddings (
      message_id INTEGER PRIMARY KEY,
      embedding BLOB NOT NULL
    )
  `;

  const createNoteEmbeddings = `
    CREATE TABLE IF NOT EXISTS note_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      embedding BLOB NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  const createNoteEmbeddingsPathUnique = `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_note_embeddings_path
    ON note_embeddings(path)
  `;

  db.exec(createMessages);
  db.exec(createActions);
  db.exec(createPreferences);
  db.exec(createAgendaItems);
  db.exec(createMessageEmbeddings);
  db.exec(createNoteEmbeddings);
  db.exec(createNoteEmbeddingsPathUnique);
}

export function createDatabase(config: AppConfig): DatabaseClient {
  const dbPath = path.resolve(config.dbPath);
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  ensureSchema(db);

  const insertMessage = db.prepare(
    `INSERT INTO messages (session_id, role, mode, text, timestamp)
     VALUES (@sessionId, @role, @mode, @text, @timestamp)`
  );

  const selectRecentMessages = db.prepare(
    `SELECT role, text
     FROM messages
     WHERE session_id = ?
     ORDER BY timestamp DESC
     LIMIT ?`
  );

  const selectLastAssistant = db.prepare(
    `SELECT role, text
     FROM messages
     WHERE session_id = ? AND role = 'assistant'
     ORDER BY timestamp DESC
     LIMIT 1`
  );

  const selectAssistantMessageExists = db.prepare(
    `SELECT 1 FROM messages WHERE session_id = ? AND role = 'assistant' LIMIT 1`
  );

  const insertAction = db.prepare(
    `INSERT INTO actions (session_id, name, status, input_json, output_json, timestamp)
     VALUES (@sessionId, @name, @status, @input_json, @output_json, @timestamp)`
  );

  const upsertPreference = db.prepare(
    `INSERT INTO preferences (key, value)
     VALUES (@key, @value)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`
  );

  const selectPreference = db.prepare(`SELECT value FROM preferences WHERE key = ?`);
  const selectAllPreferences = db.prepare(`SELECT key, value FROM preferences`);

  const insertAgenda = db.prepare(
    `INSERT INTO agenda_items (user_id, title, status, due_date)
     VALUES (@user_id, @title, @status, @due_date)`
  );

  const selectAgendaByDate = db.prepare(
    `SELECT id, user_id, title, status, due_date, created_at, updated_at
     FROM agenda_items
     WHERE user_id = ? AND due_date = ?
     ORDER BY created_at ASC`
  );

  const deleteAgendaByIdStmt = db.prepare(
    `DELETE FROM agenda_items WHERE id = ?`
  );

  const updateAgendaStatus = db.prepare(
    `UPDATE agenda_items
     SET status = @status,
         updated_at = CURRENT_TIMESTAMP,
         due_date = COALESCE(@due_date, due_date)
     WHERE id = @id`
  );

  const findAgendaBySubstring = db.prepare(
    `SELECT id, user_id, title, status, due_date, created_at, updated_at
     FROM agenda_items
     WHERE user_id = @user_id
       AND title LIKE '%' || @search || '%'
       AND (@due_date IS NULL OR due_date = @due_date)
     ORDER BY created_at ASC
     LIMIT 1`
  );

  const upsertMessageEmbeddingStmt = db.prepare(
    `INSERT INTO message_embeddings (message_id, embedding)
     VALUES (@message_id, @embedding)
     ON CONFLICT(message_id) DO UPDATE SET embedding=excluded.embedding`
  );

  const listMessageEmbeddingsStmt = db.prepare(
    `SELECT me.message_id as messageId, me.embedding as embedding, m.text as text
     FROM message_embeddings me
     JOIN messages m ON m.id = me.message_id`
  );

  const upsertNoteEmbeddingStmt = db.prepare(
    `INSERT INTO note_embeddings (path, embedding)
     VALUES (@path, @embedding)
     ON CONFLICT(path) DO UPDATE SET embedding=excluded.embedding`
  );

  const listNoteEmbeddingsStmt = db.prepare(
    `SELECT path, embedding FROM note_embeddings ORDER BY created_at DESC`
  );

  const logMessage: DatabaseClient["logMessage"] = ({
    sessionId,
    role,
    mode,
    text,
    timestamp,
  }) => {
    const ts = timestamp ?? Date.now();
    const result = insertMessage.run({
      sessionId,
      role,
      mode,
      text,
      timestamp: ts,
    });
    return Number(result.lastInsertRowid);
  };

  const logAction: DatabaseClient["logAction"] = ({
    sessionId,
    name,
    status,
    input,
    output,
    timestamp,
  }) => {
    const ts = timestamp ?? Date.now();
    insertAction.run({
      sessionId,
      name,
      status,
      input_json: input ? JSON.stringify(input) : null,
      output_json: output ? JSON.stringify(output) : null,
      timestamp: ts,
    });
  };

  const getRecentMessages: DatabaseClient["getRecentMessages"] = (
    sessionId,
    limit = 5
  ) => {
    const rows = selectRecentMessages.all(sessionId, limit) as {
      role: MessageRole;
      text: string;
    }[];
    return rows.reverse(); // return chronological order
  };

  const getLastAssistantMessage: DatabaseClient["getLastAssistantMessage"] = (
    sessionId
  ) => {
    const row = selectLastAssistant.get(sessionId) as
      | { role: MessageRole; text: string }
      | undefined;
    return row || null;
  };

  const setPreference: DatabaseClient["setPreference"] = (key, value) => {
    upsertPreference.run({ key, value });
  };

  const getPreference: DatabaseClient["getPreference"] = (key) => {
    const row = selectPreference.get(key) as { value?: string } | undefined;
    return row?.value;
  };

  const getAllPreferences: DatabaseClient["getAllPreferences"] = () => {
    const rows = selectAllPreferences.all() as { key: string; value: string }[];
    return rows.reduce<Record<string, string>>((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  };

  const hasAssistantMessagesForSession: DatabaseClient["hasAssistantMessagesForSession"] = (
    sessionId
  ) => {
    const row = selectAssistantMessageExists.get(sessionId) as { 1?: number } | undefined;
    return !!row;
  };

  const addAgendaItem: DatabaseClient["addAgendaItem"] = ({ userId, title, dueDate }) => {
    const result = insertAgenda.run({
      user_id: userId,
      title,
      status: "TODO",
      due_date: dueDate,
    });
    return Number(result.lastInsertRowid);
  };

  const listAgendaItems: DatabaseClient["listAgendaItems"] = ({ userId, dueDate }) => {
    const rows = selectAgendaByDate.all(userId, dueDate) as {
      id: number;
      user_id: string;
      title: string;
      status: string;
      due_date: string;
      created_at: string;
      updated_at: string;
    }[];
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      status: r.status as AgendaStatus,
      dueDate: r.due_date,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  };

  const updateAgendaStatusById: DatabaseClient["updateAgendaStatusById"] = (
    id,
    status,
    newDueDate = null
  ) => {
    updateAgendaStatus.run({
      id,
      status,
      due_date: newDueDate ?? null,
    });
  };

  const findAgendaItemByTitleSubstring: DatabaseClient["findAgendaItemByTitleSubstring"] = ({
    userId,
    search,
    dueDate = null,
  }) => {
    const row = findAgendaBySubstring.get({
      user_id: userId,
      search,
      due_date: dueDate ?? null,
    }) as
      | {
          id: number;
          user_id: string;
          title: string;
          status: string;
          due_date: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      status: row.status as AgendaStatus,
      dueDate: row.due_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  };

  const deleteAgendaItemByTitleSubstring: DatabaseClient["deleteAgendaItemByTitleSubstring"] = ({
    userId,
    search,
    dueDate = null,
  }) => {
    const target = findAgendaItemByTitleSubstring({
      userId,
      search,
      dueDate,
    });
    if (!target) return false;
    deleteAgendaByIdStmt.run(target.id);
    return true;
  };

  const upsertMessageEmbedding: DatabaseClient["upsertMessageEmbedding"] = ({
    messageId,
    vector,
  }) => {
    const embeddingBuffer = Buffer.from(JSON.stringify(vector));
    upsertMessageEmbeddingStmt.run({ message_id: messageId, embedding: embeddingBuffer });
  };

  const listMessageEmbeddings: DatabaseClient["listMessageEmbeddings"] = () => {
    const rows = listMessageEmbeddingsStmt.all() as {
      messageId: number;
      embedding: Buffer;
      text?: string;
    }[];
    return rows.map((r) => ({
      messageId: r.messageId,
      embedding: JSON.parse(r.embedding.toString()) as number[],
      text: r.text,
    }));
  };

  const upsertNoteEmbedding: DatabaseClient["upsertNoteEmbedding"] = ({
    path,
    vector,
  }) => {
    const embeddingBuffer = Buffer.from(JSON.stringify(vector));
    upsertNoteEmbeddingStmt.run({ path, embedding: embeddingBuffer });
  };

  const listNoteEmbeddings: DatabaseClient["listNoteEmbeddings"] = () => {
    const rows = listNoteEmbeddingsStmt.all() as { path: string; embedding: Buffer }[];
    return rows.map((r) => ({
      path: r.path,
      embedding: JSON.parse(r.embedding.toString()) as number[],
    }));
  };

  return {
    logMessage,
    getRecentMessages,
    getLastAssistantMessage,
    setPreference,
    getPreference,
    getAllPreferences,
    hasAssistantMessagesForSession,
    addAgendaItem,
    listAgendaItems,
    updateAgendaStatusById,
    findAgendaItemByTitleSubstring,
    deleteAgendaItemByTitleSubstring,
    upsertMessageEmbedding,
    listMessageEmbeddings,
    upsertNoteEmbedding,
    listNoteEmbeddings,
    logAction,
    close: () => db.close(),
    filePath: dbPath,
  };
}
