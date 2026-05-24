export interface ToolResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function successResult<T>(data: T): ToolResult<T> {
  return { success: true, data };
}

export function errorResult<T>(error: string): ToolResult<T> {
  return { success: false, error };
}
