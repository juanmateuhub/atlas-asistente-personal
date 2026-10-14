/** Provider-agnostic chat request. The domain never imports an SDK directly. */
export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ToolDeclaration = { name: string; description: string; parametersJsonSchema: unknown };

export type ChatRequest = {
  system: string;
  history: ChatTurn[];
  tools?: readonly ToolDeclaration[];
  signal?: AbortSignal;
};

/** What a provider streams: text deltas and/or tool calls the model wants to make. */
export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "call"; name: string; args: Record<string, unknown> };

export interface LLMProvider {
  readonly name: string;
  /** Yields events as they arrive. Throws ProviderError on failure. */
  stream(request: ChatRequest): AsyncIterable<StreamEvent>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: "config" | "rate_limit" | "unavailable" | "blocked" | "unknown",
  ) {
    super(message);
  }
}
