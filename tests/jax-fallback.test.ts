import { describe, expect, it } from "vitest";
import { withFallback } from "@/lib/jax/providers/fallback";
import { ProviderError, type LLMProvider } from "@/lib/jax/providers/types";

function fake(name: string, behaviour: { chunks?: string[]; failWith?: ProviderError; failAfterFirst?: boolean }): LLMProvider & { calls: number } {
  const p = {
    name,
    calls: 0,
    async *stream() {
      p.calls++;
      const chunks = behaviour.chunks ?? [];
      for (const [i, c] of chunks.entries()) {
        if (behaviour.failAfterFirst && i === 1) throw behaviour.failWith;
        yield { type: "text" as const, delta: c };
      }
      if (behaviour.failWith && !behaviour.failAfterFirst) throw behaviour.failWith;
    },
  };
  return p;
}

async function collect(p: LLMProvider) {
  let out = "";
  for await (const e of p.stream({ system: "", history: [] })) if (e.type === "text") out += e.delta;
  return out;
}

describe("withFallback", () => {
  it("uses the first provider when it works", async () => {
    const a = fake("a", { chunks: ["ho", "la"] });
    const b = fake("b", { chunks: ["no"] });
    expect(await collect(withFallback([a, b]))).toBe("hola");
    expect(b.calls).toBe(0);
  });

  it("falls back when the first is overloaded before answering", async () => {
    const a = fake("a", { failWith: new ProviderError("503", "unavailable") });
    const b = fake("b", { chunks: ["respaldo"] });
    expect(await collect(withFallback([a, b]))).toBe("respaldo");
  });

  it("falls back on per-model quota errors", async () => {
    const a = fake("a", { failWith: new ProviderError("429", "rate_limit") });
    const b = fake("b", { chunks: ["ok"] });
    expect(await collect(withFallback([a, b]))).toBe("ok");
  });

  it("does not fall back on a bad key", async () => {
    const a = fake("a", { failWith: new ProviderError("401", "config") });
    const b = fake("b", { chunks: ["no"] });
    await expect(collect(withFallback([a, b]))).rejects.toMatchObject({ kind: "config" });
    expect(b.calls).toBe(0);
  });

  it("never switches model mid-answer", async () => {
    const a = fake("a", { chunks: ["empieza", "x"], failWith: new ProviderError("503", "unavailable"), failAfterFirst: true });
    const b = fake("b", { chunks: ["otra"] });
    await expect(collect(withFallback([a, b]))).rejects.toMatchObject({ kind: "unavailable" });
    expect(b.calls).toBe(0);
  });

  it("reports the last error when every provider fails", async () => {
    const a = fake("a", { failWith: new ProviderError("503", "unavailable") });
    const b = fake("b", { failWith: new ProviderError("429", "rate_limit") });
    await expect(collect(withFallback([a, b]))).rejects.toMatchObject({ kind: "rate_limit" });
  });
});
