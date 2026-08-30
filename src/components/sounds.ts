/**
 * The three sounds the play screen makes: a right answer, a wrong one, and the
 * stars at the end of a round.
 *
 * This is a browser shim, not logic, which is why it sits beside the components
 * rather than in `src/lib` - it touches `Audio` and `AudioContext`, so it could
 * never be pure.
 *
 * Playing is deliberately best-effort, like recording an answer: an iPad that
 * refuses to play (silent switch, autoplay policy, a file that didn't load) must
 * not throw into the middle of a child answering a question.
 *
 * ## Why this is Web Audio and not an `<audio>` element
 *
 * It was one `HTMLAudioElement` per sound, rewound with `currentTime = 0` and
 * played again. That is the obvious way to do it and it was measured, on the
 * speed run, at a **p95 of 73-85ms and a peak of 149ms** - *per sound*, not
 * once. `playSound` is called synchronously inside the answer handler, so every
 * one of those milliseconds sat between a child's tap and the next question
 * being drawn: the tap funnel showed `soundMs` equal to `handlerMs` exactly,
 * meaning the entire cost of answering was this call. Forty-odd answers in
 * ninety seconds is forty-odd of those.
 *
 * **Deferring it would not have been enough.** Moving the call behind a
 * `setTimeout` gets it out from between the tap and the paint, but the main
 * thread is still blocked for 80ms immediately afterwards - which is exactly
 * when the next tap is arriving. The work had to stop existing, not move.
 *
 * So the files are fetched and decoded **once**, at prime time, and playing one
 * is building an `AudioBufferSourceNode` and starting it: no seek, no media
 * pipeline, no file to re-read. This is what the Web Audio API is for, and an
 * `<audio>` element is not - it is built for a track somebody plays, not for a
 * cue fired forty times a minute.
 *
 * **The element path is kept as the fallback** and is what runs where there is
 * no `AudioContext`, or before a decode has finished, or if one fails. A sound
 * played the slow way is better than silence, and this is the one file allowed
 * to be slow rather than absent.
 *
 * **iOS needs a gesture, and the gesture is the tap that asks for the sound.**
 * A context created on mount starts `suspended` there, so `resume()` is called
 * on play - where there is, by construction, a user gesture. It returns a
 * promise and is not waited on: the first sound of a session may be the one
 * that is lost, which is the same bargain the element path always made.
 */

const SOURCES = {
  correct: '/sounds/correct.m4a',
  incorrect: '/sounds/incorrect.m4a',
  tada: '/sounds/tada.m4a',
} as const;

export type SoundName = keyof typeof SOURCES;

const NAMES = Object.keys(SOURCES) as SoundName[];

/** Safari still only has this prefixed on some versions the app has to run on. */
type ContextCtor = typeof AudioContext;
function contextConstructor(): ContextCtor | null {
  if (typeof window === 'undefined') return null;
  const scoped = window as unknown as {
    AudioContext?: ContextCtor;
    webkitAudioContext?: ContextCtor;
  };
  return scoped.AudioContext ?? scoped.webkitAudioContext ?? null;
}

/**
 * One context for the whole app, made once.
 *
 * Safari has historically capped how many an page may create, and there is no
 * reason for a second: the play screen and a speed run never sound at once, and
 * both want the same three buffers.
 */
let context: AudioContext | null = null;
let contextTried = false;

function audioContext(): AudioContext | null {
  if (contextTried) return context;
  contextTried = true;

  const Ctor = contextConstructor();
  if (!Ctor) return null;

  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

const buffers = new Map<SoundName, AudioBuffer>();

/**
 * The node currently sounding for each name.
 *
 * A child can answer faster than a sound finishes, and the newest answer is the
 * one worth hearing - so the one before it is stopped rather than left to pile
 * up. That is the rule the rewound element enforced for free, kept here
 * deliberately rather than lost in the change.
 */
const sounding = new Map<SoundName, AudioBufferSourceNode>();

/**
 * The fallback, which is what this file used to be in its entirety. One element
 * per sound, rewound rather than stacked.
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

function playElement(name: SoundName) {
  const audio = element(name);
  if (!audio) return;

  audio.currentTime = 0;
  audio.play().catch(() => {});
}

/**
 * Fetch and decode the files before they are needed.
 *
 * Decoding is the expensive half and `decodeAudioData` does it off the main
 * thread, which is the whole trade: a few hundred milliseconds of work once, on
 * mount, in exchange for playback that costs nothing at the moment a child is
 * waiting.
 *
 * **It must return `undefined` and not a promise.** Both callers write
 * `useEffect(primeSounds, [])`, and React reads an effect's return value as its
 * cleanup - handing it a promise is an error rather than a wait. So the work is
 * started and not awaited, which is also what "best-effort" means here.
 *
 * The elements are primed too, since they are what plays until a decode lands
 * and what plays for good if none does.
 */
export function primeSounds(): void {
  for (const name of NAMES) element(name)?.load();

  const ctx = audioContext();
  if (!ctx) return;

  for (const name of NAMES) {
    if (buffers.has(name)) continue;

    void fetch(SOURCES[name])
      .then((response) => response.arrayBuffer())
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then((buffer) => {
        buffers.set(name, buffer);
      })
      .catch(() => {
        // Left undecoded on purpose: `playSound` finds no buffer and plays the
        // element instead, which is the slow sound rather than no sound.
      });
  }
}

export function playSound(name: SoundName) {
  const ctx = context;
  const buffer = buffers.get(name);

  // Not decoded yet, or nowhere to decode: the old way, which still works.
  if (!ctx || !buffer) {
    playElement(name);
    return;
  }

  try {
    // Suspended is what iOS hands back for a context built outside a gesture.
    // There is one here - a sound is asked for by a tap - and this is not
    // awaited, so it costs nothing on the answer path.
    if (ctx.state === 'suspended') void ctx.resume();

    const previous = sounding.get(name);
    if (previous) {
      previous.onended = null;
      previous.stop();
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      if (sounding.get(name) === source) sounding.delete(name);
    };
    sounding.set(name, source);
    source.start();
  } catch {
    // A stopped node, a closed context, a browser objecting: the sound is worth
    // nothing next to the answer it accompanies.
  }
}
