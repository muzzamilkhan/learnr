'use client';

/**
 * The input for questions that are tapped rather than typed: true/false and
 * multiple choice. One tap answers - there is no Check button to press, because
 * a child has nothing to review before committing.
 *
 * At most four options (`MAX_CHOICES`), so every target stays thumb-sized on an
 * iPad in both orientations.
 */

export interface ChoiceOption {
  /** What gets graded and recorded, e.g. "true" or "12". */
  value: string;
  /** What the child reads, e.g. "True". */
  label: string;
}

interface Props {
  options: readonly ChoiceOption[];
  disabled: boolean;
  /** The option the child tapped, once they have. */
  chosen: string | null;
  /** The right answer, revealed only while feedback is showing. */
  reveal: string | null;
  onChoose: (value: string) => void;
}

const BASE =
  'flex h-full w-full items-center justify-center rounded-xl border-2 px-3 text-center text-2xl font-semibold break-words transition active:scale-95 sm:rounded-2xl sm:px-4 sm:text-4xl';

/** Two options sit side by side; three in a row; four as a 2x2 block. */
const layoutFor = (count: number) =>
  count <= 2 ? 'grid-cols-2 grid-rows-1' : count === 3 ? 'grid-cols-3 grid-rows-1' : 'grid-cols-2 grid-rows-2';

export function ChoicePad({ options, disabled, chosen, reveal, onChoose }: Props) {
  return (
    <div
      className={`mx-auto grid h-full w-full max-w-3xl gap-2 sm:gap-3 ${layoutFor(options.length)}`}
    >
      {options.map((option) => {
        const isChosen = chosen === option.value;
        const isAnswer = reveal === option.value;

        // Once feedback is up: the right answer always goes green, so a child who
        // picked wrong still sees which one was right; their own pick goes red.
        const tone = isAnswer
          ? 'border-(--color-right) bg-(--color-right-soft) text-(--color-right)'
          : isChosen
            ? 'border-(--color-wrong) bg-(--color-wrong-soft) text-(--color-wrong)'
            : 'border-(--color-line) bg-(--color-card) text-(--color-ink)';

        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={isChosen}
            onClick={() => onChoose(option.value)}
            className={`${BASE} ${tone} ${disabled && !isChosen && !isAnswer ? 'opacity-40' : ''}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
