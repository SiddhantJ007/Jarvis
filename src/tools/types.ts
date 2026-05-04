import { AppConfig } from "../config/env";
import { DatabaseClient } from "../db/sqlite";

export type JsonSchemaType = "string" | "number" | "boolean" | "object" | "array";

export interface ToolParameterSchema {
  type: JsonSchemaType;
  description?: string;
}

export interface ToolParametersSchema {
  type: "object";
  properties: Record<string, ToolParameterSchema>;
  required?: string[];
}

export interface ToolContext {
  db: DatabaseClient;
  config: AppConfig;
  logger?: Console;
  userId?: string;
}

export interface ToolResult<TResult = unknown> {
  ok: boolean;
  data?: TResult;
  message?: string;
}

export type ToolHandler<TArgs = any, TResult = any> = (
  args: TArgs,
  ctx: ToolContext
) => Promise<ToolResult<TResult>>;

export interface ToolDefinition<TArgs = any, TResult = any> {
  name: string;
  description: string;
  parameters: ToolParametersSchema;
  handler: ToolHandler<TArgs, TResult>;
}

export type ToolRegistry = Record<string, ToolDefinition<any, any>>;
