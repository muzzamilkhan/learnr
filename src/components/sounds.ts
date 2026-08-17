/**
 * The three sounds the play screen makes: a right answer, a wrong one, and the
 * stars at the end of a round.
 *
 * This is a browser shim, not logic, which is why it sits beside the components
 * rather than in `src/lib` — it touches `Audio`, so it could never be pure.
 *
 * Playing is deliberately best-effort, like recording an answer: an iPad that
 * refuses to play (silent switch, autoplay policy, a file that didn't load) must
 * not throw into the middle of a child answering a question. `play()` returns a
 * promise that rejects in exactly those cases, so it is caught and dropped.
 */

const SOURCES = {
  correct: '/sounds/correct.m4a',
  incorrect: '/sounds/incorrect.m4a',
  tada: '/sounds/tada.m4a',
} as const;

export type SoundName = keyof typeof SOURCES;

/**
 * One element per sound, made once and rewound on each play. A child can answer
 * faster than a sound finishes, so restarting the same element is the point —
 * the newest answer is the one worth hearing, and a pile of overlapping clips is
 * noise rather than feedback.
 */
const elements = new Map<SoundName, HTMLAudioElement>();

function element(name: SoundName): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;

  const existing = elements.get(name);
  if (existing) return existing;

  const audio = new Audio(SOURCES[name]);
  audio.preload = 'auto';
  elements.set(name, audio);
  return audio;
}

/**
 * Fetch the files before they are needed. Playback needs a user gesture on iOS,
 * but loading does not — so doing this when the play screen mounts means the
 * first right answer is heard at once instead of after a round trip.
 */
export function primeSounds() {
  for (const name of Object.keys(SOURCES) as SoundName[]) element(name)?.load();
}

export function playSound(name: SoundName) {
  const audio = element(name);
  if (!audio) return;

  audio.currentTime = 0;
  audio.play().catch(() => {});
}
