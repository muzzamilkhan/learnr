# Narration — design

A child who cannot read yet cannot use this app at all. Every question is a
sentence, and the only things on the play screen that don't need reading are the
door, the lightbulb and the tick. Narration is what makes the question itself
one of those things.

## What it is

A speaker button in the play screen's header, beside the door. Tapping it turns
narration on and reads the question at once; tapping it again turns it off. While
it is on, every new question is read aloud as it arrives, and a revealed hint is
read as it appears.

Tapping the question itself repeats it, and only while narration is on: a child
who missed it reaches for the words rather than for an icon, and a child who can
read never finds a button where the question is.

That is the whole feature. There is no voice picker and no speed control.

## Why the child's screen and not the parent's

Whether a child can read is a property of the child, so the tidy place for it
would be `User.narrate` beside the daily target. It isn't there for two reasons.

A non-reader is the person who needs to turn it on, and a setting on a screen
they cannot reach - behind a parent's sign-in, one nav away - is a setting they
cannot use. The door and the lightbulb are already on the play screen for exactly
this reason: the controls a child needs are where the child is.

And iOS will not speak without a gesture. `speechSynthesis.speak` from an effect
on a page the child has only navigated to is refused on iPad Safari, silently.
A tap that both enables narration *and* speaks the question is the gesture, so the
control has to be the thing that starts it. A stored flag would have needed a tap
to prime it anyway, and then there would be two switches for one feature.

The preference is kept in `localStorage` per device. The cost is a shared family
iPad, where a younger child turns it on and an older one turns it off again - one
tap each, which is the same tap either of them would make to correct a stored
setting they disagreed with.

## Why on-device speech

`speechSynthesis` is free, works offline, needs no key and no cache, and iPadOS
ships en-AU voices. The alternative was a cloud voice - Google's standard tier is
$4 per million characters with four million free a month, which at ~45 characters
a prompt is about 88,000 questions a month for nothing - but it buys consistency
at the price of an API key, a blob cache keyed by prompt, a network round trip in
front of a child waiting, and a failure path.

The seam is left open: `speak()` in `src/components/speech.ts` is the only thing
that touches the browser API, and the text it is handed is built by a pure
function. Swapping in a fetched audio URL is a change to one file.

## Speaking a question is not reading its characters

Prompts are generated, so there is no fixed set of sentences to record - and once
the holes are filled they still contain symbols no synthesiser reads:
`+ − × ÷ = / % ° $`, and a bare `?` standing for the gap in
`Fill in the gap: 12, 13, ?, 15`. Handed over raw, "What is 7 − 3?" is spoken
"What is 7 3?", which is worse than silence.

So `src/lib/speech/narration.ts` is a pure function turning rendered prompt text
into words, tested like everything else in `lib`:

| in | out |
| --- | --- |
| `+ − × ÷ =` | plus, minus, times, divided by, equals |
| `/` between numbers | "out of" - every `/` in the shipped content is a fraction; division is `÷` |
| `%` `°` | percent, degrees |
| `$5` | "5 dollars" - the symbol leads and the word trails, so it moves |
| a standalone `?` | "what" |
| a `?` after a word | left alone; it is the sentence's own question mark |
| `10 cm`, `6 m` | centimetres, metres - "ten see em" is what a voice makes of the abbreviation |
| `$2 coin`, `50c coins` | singular: an amount in front of a coin describes it rather than counts it |

A `?` is a gap when nothing wordlike precedes it. That is what separates the two
in `What goes in the box? 4 + ? = 9`, where one `?` is punctuation and the other
is the thing being asked for.

**Options are read too, when they are words.** A K-3 word answer is a `choice`
question precisely because the child cannot spell it, and three unread buttons
labelled "triangle", "square", "circle" leave that question exactly as unanswerable
as before. So a tapped question whose labels are not all numeric has them appended:
"Is it triangle, square, or circle?". Numeric options are left alone - a child
reads numerals long before words, and reading four numbers back is noise. So are
options the prompt has already named: "Which ribbon is longer, red or blue?" does
not need "Is it red or blue?" after it.

## Where it sits

- `src/lib/speech/narration.ts` - pure. `spokenText(text)`, and
  `questionNarration(question)` which is the prompt plus the options when they
  are words. No React, no browser, no clock.
- `src/components/speech.ts` - the browser shim and the device's setting, beside `sounds.ts` and for the
  same reason: it touches `speechSynthesis`, so it could never be pure. Speaking
  is best-effort - a refused utterance is caught and dropped, never thrown into
  the middle of a question. A new utterance cancels the one before it, the way a
  sound is rewound rather than stacked: the newest question is the one worth
  hearing. The setting is a store read through `useSyncExternalStore`, like the
  streak and the day's total: only the browser knows it, so the server renders
  silence rather than guessing, and there is nothing to load in an effect.
- `src/components/speaker-icon.tsx` - the glyph, struck through when off, like
  the eye on a parent's child card.
- `src/components/play-session.tsx` - the toggle in the header, and the effects
  that read a new question and a revealed hint.

## What is not narrated

The right/wrong feedback, the stars, the streak and the target. The sounds
already say right and wrong without words, the celebrations are pictures, and a
voice reading a score to a child is the running tally this app deliberately does
not keep.

## Testing

`narration.test.ts` covers the symbol table, the two kinds of `?`, the dollar
move, and when options are appended. The shim and the component are not unit
tested - as with `sounds.ts`, there is nothing there but the browser API.
