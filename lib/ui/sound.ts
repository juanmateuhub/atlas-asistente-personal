/**
 * Soft chimes from the redesign (Web Audio, no files): "done" is two sine notes
 * (C6 then G6), "add" a single G5, "levelup" a rising arpeggio. Short, quiet, and silently skipped where
 * audio isn't available.
 */
let ctx: AudioContext | null = null;

const NOTES = {
  done: [
    [1046.5, 0],
    [1568, 0.07],
  ],
  add: [[784, 0]],
  /** Fitness level up: a rising C major arpeggio, like a game fanfare. */
  levelup: [
    [523.25, 0],
    [659.25, 0.09],
    [783.99, 0.18],
    [1046.5, 0.27],
    [1568, 0.4],
  ],
} as const;

export function playChime(kind: keyof typeof NOTES) {
  if (typeof window === "undefined") return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    const t = ctx.currentTime;
    for (const [freq, delay] of NOTES[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(0.07, t + delay + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.45);
    }
  } catch {
    // Audio is a nicety; never break the action.
  }
}
