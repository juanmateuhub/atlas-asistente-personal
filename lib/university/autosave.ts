export type SaveStatus = "saved" | "dirty" | "saving" | "retrying" | "conflict" | "invalid";

export const SAVE_LABEL: Record<SaveStatus, string> = {
  saved: "Guardado",
  dirty: "Cambios sin guardar",
  saving: "Guardando…",
  retrying: "Sin conexión. Reintentando…",
  conflict: "Cambiado en otra pestaña",
  invalid: "No se puede guardar",
};

/** Statuses where leaving the page would lose work. */
export function hasUnsavedWork(status: SaveStatus) {
  return status === "dirty" || status === "saving" || status === "retrying";
}

export type SaveOutcome =
  | { ok: true; version: number }
  | { ok: false; reason: "conflict" | "invalid" | "error"; message: string };

type Options<T> = {
  /** Persist `doc` if the stored version is still `expectedVersion`. */
  save: (doc: T, expectedVersion: number) => Promise<SaveOutcome>;
  onStatus: (status: SaveStatus, message: string | null) => void;
  initialVersion: number;
  delayMs?: number;
  retryMs?: number;
};

/**
 * Debounced autosave with optimistic concurrency:
 * - edits within `delayMs` collapse into one save;
 * - only one save is in flight; edits made meanwhile are saved right after;
 * - network errors retry with the newest content;
 * - a version conflict or invalid content stops saving so nothing is overwritten.
 */
export class Autosaver<T> {
  private version: number;
  private pending: T | null = null;
  private inFlight = false;
  private blocked = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: Options<T>) {
    this.version = options.initialVersion;
  }

  change(doc: T) {
    if (this.blocked) return;
    this.pending = doc;
    this.options.onStatus("dirty", null);
    this.schedule(this.options.delayMs ?? 800);
  }

  /** Save now, skipping the debounce (e.g. when leaving the page). */
  flushNow() {
    this.clearTimer();
    void this.flush();
  }

  dispose() {
    this.clearTimer();
  }

  hasPending() {
    return this.pending !== null && !this.blocked;
  }

  private schedule(ms: number) {
    this.clearTimer();
    this.timer = setTimeout(() => void this.flush(), ms);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async flush(): Promise<void> {
    if (this.inFlight || this.blocked || this.pending === null) return;
    const doc = this.pending;
    this.pending = null;
    this.inFlight = true;
    this.options.onStatus("saving", null);

    let result: SaveOutcome;
    try {
      result = await this.options.save(doc, this.version);
    } catch {
      result = { ok: false, reason: "error", message: "" };
    }
    this.inFlight = false;

    if (result.ok) {
      this.version = result.version;
      if (this.pending !== null) return this.flush();
      this.options.onStatus("saved", null);
      return;
    }

    if (result.reason === "error") {
      this.pending ??= doc;
      this.options.onStatus("retrying", null);
      this.schedule(this.options.retryMs ?? 3000);
      return;
    }

    this.blocked = true;
    this.pending = null;
    this.options.onStatus(result.reason, result.message);
  }
}
