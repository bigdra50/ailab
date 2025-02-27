import type { z } from "npm:zod";

// 基本的なクエリ定義型
export type QueryBase<ArgType extends z.ZodTypeAny> = {
  type: ArgType;
  positional?: number | "...";
  short?: string;
  description?: string;
};

// 引数の型を抽出するヘルパー型
export type InferZodType<T extends z.ZodTypeAny> = z.infer<T>;
export type InferQueryType<T extends Record<string, QueryBase<any>>> = {
  [K in keyof T]: InferZodType<T[K]["type"]>;
};

// コマンド定義型
export type CommandDef<T extends Record<string, QueryBase<any>>> = {
  name: string;
  description: string;
  args: T;
};

// サブコマンド定義型
export type SubCommandMap = Record<string, CommandDef<any>>;

// 実行結果の型定義
export type CommandResult<T> =
  | { type: "success"; data: T }
  | { type: "help"; helpText: string }
  | { type: "error"; error: Error | z.ZodError; helpText: string };

export type SubCommandResult =
  | { type: "subcommand"; name: string; result: CommandResult<any> }
  | { type: "help"; helpText: string }
  | { type: "error"; error: Error; helpText: string };

// Node.jsのparseArgsと互換性のある型定義
export interface ParseArgsOptionConfig {
  type: "string" | "boolean";
  short?: string;
  multiple?: boolean;
}

export interface ParseArgsConfig {
  args?: string[];
  options?: Record<string, ParseArgsOptionConfig>;
  strict?: boolean;
  allowPositionals?: boolean;
}

// Zodスタイルの成功結果
export type ParseSuccess<T> = {
  ok: true;
  data: T;
};

// Zodスタイルのエラー結果
export type ParseError = {
  ok: false;
  error: Error | z.ZodError;
};

// Zodスタイルのパース結果
export type SafeParseResult<T> = ParseSuccess<T> | ParseError;

// サブコマンドのZodスタイル成功結果
export type SubCommandParseSuccess = {
  ok: true;
  data: {
    command: string;
    data: any;
  };
};

// サブコマンドのZodスタイルパース結果
export type SubCommandSafeParseResult = SubCommandParseSuccess | ParseError;
