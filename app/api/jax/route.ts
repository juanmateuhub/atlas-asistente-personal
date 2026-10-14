import {
  buildDataBlock,
  extractCitations,
  normalizeHistory,
  noteRefs,
  stripUnknownRefs,
  systemPrompt,
} from "@/lib/jax/context";
import {
  DAILY_MESSAGE_LIMIT,
  MESSAGE_MAX,
  countRecentQuestions,
  listConversation,
  pruneOldMessages,
  type JaxMessage,
} from "@/lib/jax/conversation";
import { applyAction } from "@/lib/jax/apply";
import { timeIn } from "@/lib/jax/dates";
import { createGeminiProvider } from "@/lib/jax/providers/gemini";
import { ProviderError, type ChatTurn, type LLMProvider } from "@/lib/jax/providers/types";
import { retrieveData } from "@/lib/jax/retrieval";
import { encodeEvent } from "@/lib/jax/sse";
import { TOOL_DECLARATIONS, toProposal, type Proposal } from "@/lib/jax/tools";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/tasks/dates";

const HISTORY_TURNS = 16;
/** A single answer can't propose an unbounded batch of changes. */
const MAX_ACTIONS = 10;

/** Server-side trace of each request: stage names and timings only, never user content. */
function tracer() {
  const id = crypto.randomUUID().slice(0, 8);
  const t0 = Date.now();
  return {
    step: (stage: string, extra?: Record<string, unknown>) =>
      console.info(`[jax ${id}] ${stage} +${Date.now() - t0}ms`, extra ?? ""),
    fail: (stage: string, err: unknown) =>
      console.error(`[jax ${id}] FAILED at ${stage} +${Date.now() - t0}ms`, err instanceof Error ? `${err.name}: ${err.message}` : err),
  };
}

function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

const PROVIDER_MESSAGES: Record<ProviderError["kind"], string> = {
  config: "Jax no está configurado todavía: falta la clave de Gemini.",
  rate_limit: "Jax ha llegado al límite de uso gratuito de Gemini. Prueba de nuevo en un rato.",
  unavailable: "Gemini no responde ahora mismo. Prueba de nuevo en unos minutos.",
  blocked: "Gemini no ha querido responder a esta pregunta.",
  unknown: "No he podido responder. Inténtalo de nuevo.",
};

const STATUS_WORD = {
  pending: "pendiente",
  applied: "hecho",
  dismissed: "descartado",
  failed: "falló",
  undone: "deshecho por el usuario",
} as const;

/** Past turns for the model; assistant turns mention what they proposed and what happened. */
function toTurns(conversation: JaxMessage[]): ChatTurn[] {
  return conversation.map((m) => ({
    role: m.role,
    content: m.actions.length
      ? `${m.content}\n\n(Cambios: ${m.actions.map((a) => `${a.summary} [${STATUS_WORD[a.status]}]`).join("; ")})`
      : m.content,
  }));
}

/**
 * Ask Jax. Streams Server-Sent Events:
 *   draft  { delta }                            ephemeral text as it is generated
 *   final  { id, content, citations, actions }  the persisted answer
 *   error  { message }
 * Tool calls become validated jax_actions that are applied right away (the user
 * chose this); each one keeps undo data so it can be reverted from the chat.
 */
export async function POST(request: Request) {
  const trace = tracer();
  // 1. Session: authenticated users only. RLS scopes every query below.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return jsonError(401, "Inicia sesión para hablar con Jax.");

  // 2. Validate input.
  const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return jsonError(400, "Escribe una pregunta.");
  if (message.length > MESSAGE_MAX) return jsonError(400, `La pregunta no puede pasar de ${MESSAGE_MAX} caracteres.`);

  if ((await countRecentQuestions(supabase)) >= DAILY_MESSAGE_LIMIT) {
    return jsonError(429, "Has hecho muchas preguntas hoy. Jax vuelve a estar disponible mañana.");
  }

  let provider: LLMProvider;
  try {
    provider = createGeminiProvider();
  } catch (err) {
    return jsonError(503, err instanceof ProviderError ? PROVIDER_MESSAGES[err.kind] : PROVIDER_MESSAGES.unknown);
  }

  // 3. Store the question, keep the 7-day window tidy.
  await pruneOldMessages(supabase);
  const { error: insertError } = await supabase.from("jax_messages").insert({ role: "user", content: message });
  if (insertError) {
    trace.fail("store question", insertError);
    return jsonError(500, "No he podido guardar tu pregunta. Inténtalo de nuevo.");
  }
  trace.step("question stored");

  // 4. Deterministic retrieval of the user's own data + conversation history.
  const now = new Date();
  let system: string;
  let history: ChatTurn[];
  let retrieved: Awaited<ReturnType<typeof retrieveData>>;
  try {
    const [r, conversation] = await Promise.all([
      retrieveData(supabase, message, todayIn(now), timeIn(now)),
      listConversation(supabase, HISTORY_TURNS),
    ]);
    retrieved = r;
    system = systemPrompt(buildDataBlock(r.data));
    history = normalizeHistory(toTurns(conversation));
  } catch (err) {
    trace.fail("retrieval", err);
    return jsonError(500, "No he podido leer tus datos. Inténtalo de nuevo.");
  }
  trace.step("retrieval done", { notes: retrieved.data.notes.length, turns: history.length });
  const available = noteRefs(retrieved.data.notes);

  // 5. Generate and stream; collect tool calls as proposals; persist only the final answer.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: unknown) => controller.enqueue(encodeEvent(event, payload));
      let answer = "";
      const proposals: Proposal[] = [];
      const rejected: string[] = [];
      let stage = "generate";
      try {
        for await (const event of provider.stream({ system, history, tools: TOOL_DECLARATIONS, signal: request.signal })) {
          if (event.type === "text") {
            answer += event.delta;
            send("draft", { delta: event.delta });
          } else if (proposals.length < MAX_ACTIONS) {
            const result = toProposal(event.name, event.args, retrieved.refs);
            if (result.ok) proposals.push(result.proposal);
            else rejected.push(result.error);
          }
        }

        trace.step("generated", { chars: answer.length, calls: proposals.length + rejected.length });
        stage = "persist answer";
        let content = stripUnknownRefs(answer, available).trim();
        if (rejected.length) {
          content += `${content ? "\n\n" : ""}No he podido preparar algún cambio: ${[...new Set(rejected)].join(" ")}`;
        }
        if (!content && proposals.length) {
          content = proposals.length === 1 ? "Hecho." : "Hecho, aquí tienes los cambios.";
        }
        if (!content) throw new ProviderError("empty", "blocked");
        const citations = extractCitations(content, available);

        const { data: saved, error } = await supabase
          .from("jax_messages")
          .insert({ role: "assistant", content, citations })
          .select("id")
          .single();
        if (error) throw error;

        const actions: { id: string; kind: string; summary: string; status: string; href: string | null; error?: string }[] = [];
        if (proposals.length) {
          const { data: rows, error: actionsError } = await supabase
            .from("jax_actions")
            .insert(proposals.map((p) => ({ message_id: saved.id, kind: p.kind, payload: p.payload, summary: p.summary })))
            .select("id,kind,summary");
          if (actionsError) throw actionsError;
          stage = "apply actions";
          // In order: a later change may depend on an earlier one.
          for (const row of rows) {
            const outcome = await applyAction(supabase, row.id);
            actions.push({ ...row, status: outcome.status, href: outcome.href ?? null, error: outcome.error });
          }
        }
        send("final", { id: saved.id, content, citations, actions });
        trace.step("done", { actions: actions.map((a) => a.status) });
      } catch (err) {
        trace.fail(stage, err);
        if (!request.signal.aborted) {
          send("error", {
            message: err instanceof ProviderError ? PROVIDER_MESSAGES[err.kind] : PROVIDER_MESSAGES.unknown,
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
