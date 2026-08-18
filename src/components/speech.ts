/**
 * Reading the question out loud.
 *
 * This is a browser shim, not logic - it touches `speechSynthesis`, so it could
 * never be pure, which is why it sits beside the components rather than in
 * `src/lib`. The words it is given are built by `src/lib/speech/narration.ts`,
 * which is the tested half.
 *
 * Speaking is best-effort, like playing a sound and like recording an answer: a
 * browser with no voices, a refused utterance or a device that has decided it is
 * done talking must not throw into the middle of a child answering a question.
 *
 * It is also the seam. If the device voices ever disappoint, `speak` is the one
 * function that changes - a fetched audio URL from a cloud voice goes here, and
 * nothing above it knows the difference.
 */

/**
 * Slower than a synthesiser's default, which is pitched at an adult skimming a
 * page. This is a six-year-old hearing a question for the first time.
 */
const RATE = 0.9;

export function isSpeechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * The best English voice on the device, preferring the child's own accent: this
 * is Australian content, read to an Australian child, and "What is 7 minus 3?"
 * in a US voice is nobody's teacher. Voices arrive asynchronously on some
 * browsers, so this is asked afresh each time rather than cached - returning
 * null just means the platform default, which is not a failure.
 */
function voice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const english = voices.filter((v) => v.lang.startsWith('en'));
  return (
    english.find((v) => v.lang === 'en-AU') ??
    english.find((v) => v.lang === 'en-GB') ??
    english[0] ??
    null
  );
}

/**
 * Say something, stopping whatever was being said first. The same rule the
 * sounds follow, for the same reason: a child can move on faster than a sentence
 * finishes, and the question in front of them is the one worth hearing. Two
 * voices over each other is noise rather than help.
 */
export function speak(text: string) {
  if (!isSpeechAvailable() || text.trim() === '') return;

  try {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = RATE;
    utterance.lang = 'en-AU';

    const chosen = voice();
    if (chosen) utterance.voice = chosen;

    window.speechSynthesis.speak(utterance);
  } catch {
    // A device that will not speak is a screen a child can still play on.
  }
}

/** Stop talking - on the way out of a question, and on the way off the screen. */
export function stopSpeaking() {
  if (!isSpeechAvailable()) return;

  try {
    window.speechSynthesis.cancel();
  } catch {
    // Nothing to say about failing to stop something that never started.
  }
}

/**
 * Whether this device reads questions aloud, kept on the device rather than the
 * child's profile.
 *
 * The tidy home for it would be a column beside the daily target, but the person
 * who needs narration is the one who cannot read a settings screen, and a switch
 * behind a parent's sign-in is a switch they cannot reach. The cost is a shared
 * family iPad, where a younger child turns it on and an older one turns it off -
 * one tap each, which is the same tap either of them would make to correct a
 * stored setting they disagreed with.
 *
 * It is a store rather than state loaded in an effect, for the reason the play
 * streak and the target total are: this is something only the browser knows, so
 * the server renders nothing and the value arrives with the first client render
 * rather than one render later. Storage throws in a locked-down browser, so
 * reading is best-effort like the speaking itself - the fallback is silence, and
 * the button still works for as long as the screen is open.
 */
const NARRATION_KEY = 'learnr.narration';

let narration: boolean | null = null;
const listeners = new Set<() => void>();

export function subscribeNarration(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** The client snapshot: read from storage once, then held. */
export function narrationOn(): boolean {
  if (narration === null) {
    try {
      narration = window.localStorage.getItem(NARRATION_KEY) === 'on';
    } catch {
      narration = false;
    }
  }
  return narration;
}

/** The server knows nothing about this device, and silence is the safe guess. */
export function narrationOff(): boolean {
  return false;
}

export function setNarration(on: boolean) {
  narration = on;
  try {
    window.localStorage.setItem(NARRATION_KEY, on ? 'on' : 'off');
  } catch {
    // A preference that cannot be remembered is still a preference for now.
  }
  for (const listener of listeners) listener();
}
