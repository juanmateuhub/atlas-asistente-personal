import "server-only";
import { GoogleGenAI } from "@google/genai";
import { withFallback } from "./fallback";
import { ProviderError, type ChatRequest, type LLMProvider } from "./types";

const DEFAULT_MODEL = "gemini-3.8-flash";
/** Lighter free model, used when the main one is overloaded or out of quota. */
const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";

export function createGeminiProvider(): LLMProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ProviderError("Falta GEMINI_API_KEY en .env.local", "config");
  const ai = new GoogleGenAI({ apiKey });
  const primary = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const fallback = process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;

  const models = primary === fallback ? [primary] : [primary, fallback];
  return withFallback(models.map((model) => geminiModel(ai, model)));
}

function geminiModel(ai: GoogleGenAI, model: string): LLMProvider {
  return {
    name: `gemini:${model}`,
    async *stream({ system, history, tools, signal }: ChatRequest) {
      let response;
      try {
        response = await ai.models.generateContentStream({
          model,
          contents: history.map((turn) => ({
            role: turn.role === "assistant" ? "model" : "user",
            parts: [{ text: turn.content }],
          })),
          config: {
            systemInstruction: system,
            temperature: 0.4,
            maxOutputTokens: 1500,
            abortSignal: signal,
            ...(tools?.length
              ? {
                  tools: [{ functionDeclarations: tools.map((t) => ({ ...t })) }],
                  // We only collect the calls; nothing runs automatically.
                  automaticFunctionCalling: { disable: true },
                }
              : {}),
          },
        });
      } catch (err) {
        throw toProviderError(err);
      }

      try {
        for await (const chunk of response) {
          const parts = chunk.candidates?.[0]?.content?.parts ?? [];
          for (const part of parts) {
            if (part.text && !part.thought) yield { type: "text" as const, delta: part.text };
            if (part.functionCall?.name) {
              yield { type: "call" as const, name: part.functionCall.name, args: part.functionCall.args ?? {} };
            }
          }
        }
      } catch (err) {
        throw toProviderError(err);
      }
    },
  };
}

function toProviderError(err: unknown): ProviderError {
  const status = (err as { status?: number })?.status;
  if (status === 429) return new ProviderError("Límite de uso de Gemini alcanzado", "rate_limit");
  if (status === 401 || status === 403) return new ProviderError("Clave de Gemini no válida", "config");
  if (status && status >= 500) return new ProviderError("Gemini no está disponible", "unavailable");
  return new ProviderError("Error al contactar con Gemini", "unknown");
}

/**
 * One JSON answer that follows `schema` (no streaming, no tools), for background
 * jobs. Tries the main model, then the lighter one when the first is overloaded.
 */
export async function generateJson<T>({ system, prompt, schema }: { system: string; prompt: string; schema: unknown }): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ProviderError("Falta GEMINI_API_KEY", "config");
  const ai = new GoogleGenAI({ apiKey });
  const primary = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const fallback = process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;

  let lastError: ProviderError | undefined;
  for (const model of primary === fallback ? [primary] : [primary, fallback]) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: system,
          temperature: 0.1,
          maxOutputTokens: 2000,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
        },
      });
      return JSON.parse(res.text ?? "") as T;
    } catch (err) {
      lastError = err instanceof SyntaxError ? new ProviderError("Respuesta no válida", "unknown") : toProviderError(err);
      if (lastError.kind !== "unavailable" && lastError.kind !== "rate_limit") throw lastError;
    }
  }
  throw lastError;
}
