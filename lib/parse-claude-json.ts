/** Claude sometimes wraps JSON in fenced blocks; normalize before JSON.parse */

export function parseClaudeJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  const inner = fence ? fence[1].trim() : trimmed;
  return JSON.parse(inner);
}
