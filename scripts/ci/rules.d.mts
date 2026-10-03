export type Change = { status: string; path: string; oldPath?: string };
export type AddedLine = { path: string; line: string };
export const AGENT_PROTECTED: RegExp[];
export function evaluateChanges(changes: Change[], addedLines: AddedLine[], options: { agent: boolean }): string[];
export function stripSql(sql: string): string;
export function findDestructiveSql(file: string, sql: string): string[];
