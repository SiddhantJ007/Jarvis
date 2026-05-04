import { ToolDefinition } from "./types";
import {
  AgendaItem,
  AgendaStatus,
} from "../db/sqlite";

const USER_ID_DEFAULT = "local-user";

function todayISODate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function tomorrowISODate(): string {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const addAgendaItemTool: ToolDefinition<{
  title: string;
  dueDate?: string;
}> = {
  name: "addAgendaItem",
  description: "Add a new agenda item with an optional due date (defaults to today).",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Task title" },
      dueDate: { type: "string", description: "Due date YYYY-MM-DD (optional)" },
    },
    required: ["title"],
  },
  handler: async (args, ctx) => {
    const userId = ctx.userId || USER_ID_DEFAULT;
    const dueDate = args.dueDate?.trim() || todayISODate();
    const existing = ctx.db.listAgendaItems({ userId, dueDate });
    const normalizedTitle = args.title.trim().toLowerCase();
    const dup = existing.find((i) => i.title.trim().toLowerCase() === normalizedTitle);
    if (dup) {
      return { ok: false, message: `“${args.title}” is already on your agenda for ${dueDate}.` };
    }

    const id = ctx.db.addAgendaItem({ userId, title: args.title, dueDate });
    const items = ctx.db.listAgendaItems({ userId, dueDate });
    const created = items.find((i) => i.id === id) as AgendaItem | undefined;
    return {
      ok: true,
      data:
        created || {
          id,
          title: args.title,
          status: "TODO" as AgendaStatus,
          dueDate,
          userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
    };
  },
};

export const listAgendaTool: ToolDefinition<{
  dueDate?: string;
}> = {
  name: "listAgenda",
  description: "List agenda items for a given date (defaults to today).",
  parameters: {
    type: "object",
    properties: {
      dueDate: { type: "string", description: "Date YYYY-MM-DD (optional)" },
    },
  },
  handler: async (args, ctx) => {
    const userId = ctx.userId || USER_ID_DEFAULT;
    const dueDate = args.dueDate?.trim() || todayISODate();
    const items = ctx.db.listAgendaItems({ userId, dueDate });
    return { ok: true, data: { items } };
  },
};

export const updateAgendaStatusTool: ToolDefinition<{
  id: number;
  status: AgendaStatus;
  newDueDate?: string;
}> = {
  name: "updateAgendaStatus",
  description: "Update the status (and optional due date) of an agenda item by id.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "number", description: "ID of the agenda item" },
      status: { type: "string", description: "TODO | DONE | MOVED" },
      newDueDate: { type: "string", description: "Optional new due date YYYY-MM-DD" },
    },
    required: ["id", "status"],
  },
  handler: async (args, ctx) => {
    ctx.db.updateAgendaStatusById(args.id, args.status, args.newDueDate ?? null);
    return { ok: true, data: { success: true } };
  },
};

export const updateAgendaByTitleTool: ToolDefinition<{
  titleSubstring: string;
  status: AgendaStatus;
  moveToTomorrow?: boolean;
}> = {
  name: "updateAgendaByTitle",
  description:
    "Update an agenda item by matching a substring in its title (defaults to today). Optionally move it to tomorrow when marking MOVED.",
  parameters: {
    type: "object",
    properties: {
      titleSubstring: { type: "string", description: "Substring to match in title" },
      status: { type: "string", description: "TODO | DONE | MOVED" },
      moveToTomorrow: { type: "boolean", description: "If true and MOVED, shift due date to tomorrow" },
    },
    required: ["titleSubstring", "status"],
  },
  handler: async (args, ctx) => {
    const userId = ctx.userId || USER_ID_DEFAULT;
    const dueDate = todayISODate();
    const found = ctx.db.findAgendaItemByTitleSubstring({
      userId,
      search: args.titleSubstring,
      dueDate,
    });
    if (!found) {
      throw new Error(`No agenda item found containing "${args.titleSubstring}" for ${dueDate}.`);
    }

    let newDueDate: string | null = null;
    if (args.moveToTomorrow && args.status === "MOVED") {
      newDueDate = tomorrowISODate();
    }

    ctx.db.updateAgendaStatusById(found.id, args.status, newDueDate);

    const updated: AgendaItem = {
      ...found,
      status: args.status,
      dueDate: newDueDate || found.dueDate,
      updatedAt: new Date().toISOString(),
    };

    return { ok: true, data: updated };
  },
};

export const deleteAgendaByTitleTool: ToolDefinition<{
  titleSubstring: string;
}> = {
  name: "deleteAgendaByTitle",
  description:
    "Delete an agenda item by matching a substring in its title (defaults to today).",
  parameters: {
    type: "object",
    properties: {
      titleSubstring: { type: "string", description: "Substring to match in title" },
    },
    required: ["titleSubstring"],
  },
  handler: async (args, ctx) => {
    const userId = ctx.userId || USER_ID_DEFAULT;
    const deleted = ctx.db.deleteAgendaItemByTitleSubstring({
      userId,
      search: args.titleSubstring,
      dueDate: todayISODate(),
    });
    return deleted
      ? { ok: true, data: { deleted: true } }
      : { ok: false, message: `No agenda item found containing "${args.titleSubstring}".` };
  },
};
