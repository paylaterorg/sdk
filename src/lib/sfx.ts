/**
 * @dev Widget sound effects powered by Tone.js.
 *
 * Five sounds, all synthesised — no audio files, no network requests.
 * Tone.js gives us proper ADSR envelopes, FM synthesis, pluck models and
 * built-in effects (reverb, chorus) that produce smooth, musical results.
 *
 * All synths and effects are singletons, constructed once and reused so
 * repeated calls don't leak nodes into the AudioContext.
 */

import * as Tone from "tone";

/* --------------------------------------------------------------------------
 * Shared effects chain (reverb tail shared across all sounds for cohesion).
 * -------------------------------------------------------------------------- */
const reverb = new Tone.Reverb({ decay: 0.8, wet: 0.18 }).toDestination();
const limiter = new Tone.Limiter(-3).connect(reverb);

/* --------------------------------------------------------------------------
 * 1. Slider tick — neutral micro-click, pitch tracks position.
 * -------------------------------------------------------------------------- */
const tickSynth = new Tone.Synth({
  oscillator: { type: "triangle" },
  envelope: { attack: 0.001, decay: 0.018, sustain: 0, release: 0.008 },
  volume: -40,
}).connect(limiter);

/**
 * @title Slider tick
 * @description Fires on every slider step. Frequency scales linearly from
 * 480 Hz (min) to 1200 Hz (max) — a neutral, clean pitch shift that reads
 * as "ascending" without sounding musical or childish.
 * @param t Normalised position 0 (min) → 1 (max).
 */
export function playSliderTick(t: number): void {
  Tone.start().catch(() => undefined);
  const clamped = Math.max(0, Math.min(1, t));
  const freq = 480 + clamped * 720; // 480 Hz → 1200 Hz, linear
  tickSynth.triggerAttackRelease(freq, "32n");
}

/* --------------------------------------------------------------------------
 * 2. Continue — clean, dry sine tap. Confident without being loud.
 * -------------------------------------------------------------------------- */
const snapSynth = new Tone.Synth({
  oscillator: { type: "triangle" },
  envelope: { attack: 0.001, decay: 0.028, sustain: 0, release: 0.01 },
  volume: -36,
}).connect(limiter);

/**
 * @title Continue press
 * @description Single gentle triangle tick — barely there, just enough to confirm.
 */
export function playSnap(): void {
  Tone.start().catch(() => undefined);
  snapSynth.triggerAttackRelease(720, "64n");
}

/* --------------------------------------------------------------------------
 * 2b. Preset chip click — even lighter tap, slightly lower pitch.
 * -------------------------------------------------------------------------- */
const presetSynth = new Tone.Synth({
  oscillator: { type: "sine" },
  envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
  volume: -36,
}).connect(limiter);

/**
 * @title Preset chip click
 * @description Lighter than Continue — just enough to acknowledge the tap.
 */
export function playPreset(): void {
  Tone.start().catch(() => undefined);
  presetSynth.triggerAttackRelease(680, "32n");
}

/* --------------------------------------------------------------------------
 * 3. Scanned — rising two-note chime. QR confirmed, now processing.
 * -------------------------------------------------------------------------- */
const chimeReverb = new Tone.Reverb({ decay: 1.4, wet: 0.35 }).toDestination();
const chimeSynth = new Tone.Synth({
  oscillator: { type: "triangle" },
  envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.6 },
  volume: -20,
}).connect(chimeReverb);

/**
 * @title QR scanned
 * @description QR scanned / "scanned" phase. Two quick ascending notes — feels like
 * "got it, hang on".
 */
export function playScanned(): void {
  Tone.start().catch(() => undefined);
  const now = Tone.now();
  chimeSynth.triggerAttackRelease("E5", "16n", now);
  chimeSynth.triggerAttackRelease("A5", "8n", now + 0.13);
}

/* --------------------------------------------------------------------------
 * 4. Success — warm three-note ascending arpeggio. Transaction confirmed.
 * -------------------------------------------------------------------------- */
const successReverb = new Tone.Reverb({ decay: 2.2, wet: 0.4 }).toDestination();
const successChorus = new Tone.Chorus({ frequency: 1.5, delayTime: 2.5, depth: 0.4, wet: 0.3 })
  .connect(successReverb)
  .start();
const successSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine" },
  envelope: { attack: 0.01, decay: 0.4, sustain: 0.2, release: 1.2 },
  volume: -18,
}).connect(successChorus);

/**
 * @title Success
 * @description "Done" phase. Warm C major arpeggio — universally reads as "success".
 */
export function playSuccess(): void {
  Tone.start().catch(() => undefined);
  const now = Tone.now();
  successSynth.triggerAttackRelease("C5", "8n", now);
  successSynth.triggerAttackRelease("E5", "8n", now + 0.1);
  successSynth.triggerAttackRelease("G5", "4n", now + 0.2);
}

/* --------------------------------------------------------------------------
 * 5. Close — soft descending tone. Gentle, not punishing.
 * -------------------------------------------------------------------------- */
const closeSynth = new Tone.Synth({
  oscillator: { type: "sine" },
  envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.18 },
  volume: -24,
}).connect(limiter);

/**
 * @title Close
 * @description X button / close popup. Single soft descending glide — feels like
 * something quietly folding away.
 */
export function playClose(): void {
  Tone.start().catch(() => undefined);
  const now = Tone.now();
  closeSynth.triggerAttackRelease("A4", "16n", now);
  closeSynth.triggerAttackRelease("E4", "16n", now + 0.09);
}
