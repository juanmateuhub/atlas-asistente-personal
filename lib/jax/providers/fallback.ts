import { ProviderError, type ChatRequest, type LLMProvider } from "./types";

/** Errors worth retrying on another model (overload or per-model quota). */
const RETRYABLE: ProviderError["kind"][] = ["unavailable", "rate_limit"];

/**
 * Tries each provider in order. Falls through only if a provider fails before
 * producing any text; once an answer has started streaming, errors propagate
 * (switching models mid-answer would mix two different responses).
 */
export function withFallback(providers: LLMProvider[]): LLMProvider {
  if (providers.length === 0) throw new Error("withFallback needs at least one provider");
  return {
    name: providers.map((p) => p.name).join(" > "),
    async *stream(request: ChatRequest) {
      let lastError: unknown;
      for (const provider of providers) {
        let started = false;
        try {
          for await (const event of provider.stream(request)) {
            started = true;
            yield event;
          }
          return;
        } catch (err) {
          lastError = err;
          const retryable = err instanceof ProviderError && RETRYABLE.includes(err.kind);
          if (started || !retryable || request.signal?.aborted) throw err;
        }
      }
      throw lastError;
    },
  };
}
