# The question's viewport

Four changes to the one screen a child actually plays on: the question is set
at one size whatever it says, a figure sits beside the question instead of
above it, the figure can be opened large, and a fraction is drawn with a
horizontal bar instead of a slash.

They are one piece of work because they are one box. The prompt's size, the
figure's size and the fraction's height are all decided by how the room between
the header and the pad is divided, and changing any one of them alone would be
tuning against the other two.

## Why

**The size of the question moves with its length, and that reads as the app
being unsteady.** `Prompt` measures its box and searches for the largest whole
pixel size at which *that question* still fits. It was the right fix for the
problem it was written for - a declared size can only ever be the worst case,
which left a short question small in the middle of a large screen - and it
solved that by making every question a different size. Over a session a child
watches the type jump between roughly 96px and roughly 33px, and the jump
carries no information: it is a fact about how many words the template's author
used, not about the maths.

**A figure is too small.** It shares the column with the prompt, so on a
landscape iPad - the shortest screen this app runs on, and the one it is built
for - the drawing comes out around 150px. That is barely above the ~64px
thumbnail the same component renders in a parent's report row. A bar graph with
five categories and a two-digit value axis is not readable at that size, and
those are exactly the questions the figure kinds were added to make askable.

**And a fraction is written `1/2`.** It is the notation the expression language
happens to produce, not the notation a child is taught. Every fraction in the
shipped content is a proper fraction being read as one thing; a slash makes it
look like a division, which in this content it never is - division is written
`÷`.

## What was measured first

Every one of the 350 shipped templates, generated **300 times each**, prompts
rendered with their holes filled:

| | chars |
| --- | --- |
| longest rendered prompt | **135** (`maths.5.chance.most-likely-from-trials`) |
| second | 133 (`maths.2.chance.bag-more-likely`) |
| p95 | 101 |
| p90 | 88 |
| median | 45 |
| shortest | 14 |
| longest hint | 102 |

Twelve templates ever show a fraction - ten in a prompt, two in a hint, two in
an answer or a choice - and **not one `/` in the whole catalogue is anything
but a fraction**. That claim was already load-bearing for narration, where it
lived in a comment; here it becomes a test.

The content is **not** being rewritten to shorten it. Trimming the thirty
templates over 90 characters would buy a larger fixed size, and it would also
be thirty rewrites of questions that read correctly today, judged against a
number nobody had defended. The worst case is taken as it stands.

## One size, fitted to a sentinel

`MAX_PROMPT_CHARS = 140`, in a new `src/lib/templates/limits.ts`.

**140 and not 135.** The observed worst case is 135, and a cap with no headroom
reds the suite the first time a number inside an existing template grows a
digit - which is a template being edited, not a template getting too long. Five
characters of slack costs under 2% of the rendered size, which is not visible;
a suite that goes red for a reason nobody meant is.

The size is found the way it always was, with one substitution: **the binary
search fits a constant sentinel string of `MAX_PROMPT_CHARS`, not the prompt in
hand.** The size it finds is then applied to the real prompt.

That keeps everything the fitter exists for. The room a question has depends on
the device, the orientation, whether a target bar is showing and whether this
question has a figure, and none of those are knowable when a stylesheet is
written - which is the whole argument against the obvious alternative of
deleting the fitter and declaring a `clamp()`. A declared size has to survive
the worst combination of all four on every device, so every device pays for the
worst one. The sentinel is fitted against the box that actually exists.

What it drops is the one thing that should never have varied: the *question*.

**The sentinel is prose, not a repeated letter.** It is 140 characters in the
shape the content is actually written in - words of ordinary length with a
couple of runs of digits - because a sentinel of `M`s would measure a width no
real prompt has and shrink every question to pay for it, and one of `l`s would
measure too little and clip. Its length is asserted against `MAX_PROMPT_CHARS`
by a test, so the two cannot drift.

**The fit test is "the sentinel fits **and** the prompt fits", and it reruns on
every question.** The sentinel is the longer string, so in practice it binds and
the size is constant. The second half is there because a sentinel is an
estimate of width - it is 140 characters of some particular letters, and a real
prompt of 140 different letters could be wider - and it is only a net against
clipping if it is checked against the prompt actually on screen, not against
whichever one happened to be there when the fit last ran.

Two things fall out:

- `Prompt`'s `key={session.askedCount}` goes: it remounted the component on
  every question, and the component holds no other state that a question
  boundary needs to reset. The layout effect's dependency list keeps `prompt`
  rather than dropping it, because with the remount gone that dependency is
  the only thing left that reruns the fit when the question does - the box's
  own height and width are the effect's other trigger, and neither changes
  when the text inside it does. Dropping it was tried first, on the argument
  that a rerun "re-derives an answer that cannot have changed" - which turned
  out to be the case *for* keeping it, not against: the sentinel binds in the
  normal run, so the search it triggers returns the identical size and nothing
  on screen moves. What the dependency buys is that the check above is
  measured against the prompt actually being shown, which is the only way it
  is a guarantee rather than a sample. The cost is one binary search per
  question, on the order of seven iterations - nothing against a question a
  child spends seconds reading.
- `promptSize()`'s three length branches collapse to one class. That function
  is what the server renders and what a browser with no JavaScript keeps, and a
  length-keyed size there was the same inconsistency arriving a frame early.

**The cost, stated plainly.** Short questions get smaller; that is not a side
effect to be tuned away, it is what "one size" means, and the only lever on how
big that size is is the cap above.

> **Corrected after measurement.** This paragraph predicted "near 54px" with no
> figure and "near 33px" with one. Measured in a browser at 1024x768, a
> no-figure question lands between **29px and 43px** and a figure question
> between **15px and 16px**. The arithmetic was wrong because it treated the
> whole space between header and pad as the prompt's: the middle column also
> carries the hint row (`min-h-12`/`sm:min-h-14`), the answer display
> (`h-16`/`sm:h-20` plus a 32px feedback line) and three gaps. It is a *range*
> rather than one number because the answer pad's shape decides how much of the
> column is left - a typed answer draws an 80px answer box a tapped one does
> not, and a two-option `ChoicePad` is shorter than a number pad - so a question
> is one size for every question of the same shape. The property this section
> exists for, independence from the prompt's length, holds exactly.

`catalog.test.ts` enforces the cap over many draws of every shipped template.

## Prompt left, figure right

One rule, at the `sm` width line:

- **Below `sm`** - a portrait phone - the column stays as it is: figure above at
  full width, prompt beneath it.
- **From `sm` up** - every tablet, every desktop, and a phone turned sideways -
  a row: prompt left, figure right, **40/60** in the figure's favour.

The prompt is a fixed size now and needs only the room its worst case takes, so
the wider half goes to the picture.

**A portrait phone keeps the column because a row would make the figure
smaller, not larger.** A row divides width, and a 390px-wide phone has none to
divide: side by side the drawing comes out around 195px against roughly 280px
stacked. The gain from a row is real on a landscape iPad (~150px to ~270px) and
a portrait iPad (~330px to ~384px), and negative here. The rule follows the
measurement rather than a preference for one shape.

**This deletes the `[@media(max-height:500px)]` rules from the figure-and-prompt
wrapper.** They existed to give a landscape phone a row, and a landscape phone
is wide, so the width query now gives it one. The `500px` line survives only in
the pad's own compound query - so this is one fewer place that number is
written, not a second short-viewport line beside it.

The `min(64px,100%)` floor and the `40vh`/`46vh` caps carry over unchanged.

> **Corrected after measurement: a landscape phone draws no figure at all, and
> never did.** This section assumed the width query would hand that viewport a
> usable row of around 180px. Measured at 844x390 it is **0px**, reproducibly,
> across every question shape sampled. At 390px tall the header (~56), the pad's
> 12rem floor (192, since 40vh = 156 falls below the minimum), the hint row (48)
> and the answer display with its feedback line (96) already total 392, so the
> flexible middle column resolves to nothing and the `min(64px,100%)` floor
> resolves to nothing with it. That is the documented pre-existing behaviour the
> floor is written that way to produce - a figure that does not draw at all,
> rather than one painted over the header's speaker button - and it was
> confirmed against the unmodified code, so this branch did not cause it. The
> honest consequence: on that one viewport a figure question cannot be answered,
> because the picture is the question. It also means retiring the
> `[@media(max-height:500px)]` rules cost nothing, since the row they granted
> had no height to lay anything out in either way. Fixing it is out of this
> branch's scope.

## The figure, opened large

Tapping the figure opens it over the whole screen, with the prompt set small
along the top and the drawing taking the rest. Tapping anywhere closes it;
Escape closes it too.

**It has to cover the screen, because the question area is bound by height and
not by width.** Expanding a figure into the prompt's half of the row buys
almost nothing: on a landscape iPad that area is around 270px tall whether the
figure has 60% of the width or all of it. The only room left to take is the
pad's, and taking the pad's room means covering the pad. So a child cannot
answer while the picture is open, and closing it is one tap anywhere - not a
target to find.

**The prompt rides along.** The questions this is for are the ones where the
picture carries the data - a bar graph, a coordinate grid - and reading a graph
against a question you are trying to remember is the thing that made the small
figure hard in the first place.

**A magnifier glyph in the figure's corner is what says it can be tapped.** A
child who cannot read has no other way to find out, and a picture is how
everything else on this screen says what it does - the door, the tick, the
lightbulb.

Where it lives:

- `src/components/figure-zoom.tsx` - a new client component. `play-session.tsx`
  is 1087 lines already, and this is a self-contained screen rather than another
  branch of that one.
- `src/components/magnify-icon.tsx` - beside the other glyphs.
- `ZOOM_LABEL_SIZE` joins `PLAY_LABEL_SIZE` in `src/lib/figures/labels.ts`,
  around 4, with a `strokeWidth` around 5.

**No figure geometry changes, and that is guaranteed rather than hoped.**
`labels.ts` says a kind must leave room for the *larger* of the label sizes it
will be drawn at, because a figure is built once for every call site. A third
size that is *smaller* than both existing ones asks for less room than the
budget already allows.

The overlay is `role="dialog"` with `aria-modal`; the figure that opens it is a
`role="button"` with an `aria-label`. Zoom state clears when the question
changes. With narration on, the prompt inside the overlay repeats on tap
exactly as the one on the play screen does - opening the zoom itself says
nothing, because it is a look and not a listen.

**This reverses a decision that is currently written down.** Both CLAUDE.md and
the diagrams spec say the figure "is not a second control: it takes no tap".
That sentence becomes false and has to be rewritten in both, not left to
disagree with the code.

## Fractions with a bar

**`src/lib/fractions.ts`** - pure and tested, beside the other boundary rules.
One export, `splitFractions(text)`, returning a list of `{ kind: 'text' }` and
`{ kind: 'fraction', numerator, denominator }` segments.

The rule for what a fraction is - a digit or a `?`, a slash, a digit - is the
one `src/lib/speech/narration.ts` already uses, and **narration imports it from
here** rather than keeping a second copy. The spoken form and the drawn form
must not be able to disagree about which slashes are fractions, and two regexes
in two files is exactly how they would.

The `?` is a numerator like any other: `?/12` draws as `?` over `12`, which is a
better picture of what is being asked than the slash was.

**`src/components/maths-text.tsx`** - `MathsText({ text })`, mapping segments to
spans and to a stacked `inline-flex` fraction with a `border-t` vinculum, sized
in `em` so it scales with whatever the fitter chose rather than needing to be
told.

It is used in four places, all on the play screen: `Prompt`, `Hint`,
`ChoicePad`'s labels, and `FeedbackLine` - the last because a tapped fraction
question reveals its right answer there, and `maths.5.fractions.equivalent-shaded`
and `maths.5.chance.spinner-fraction` are both `choice` templates whose answers
are fractions.

**The parent's report is deliberately untouched.** Its answered-question rows
are single-line and elided so the column can be read down, and a stacked
fraction is about 1.6 line-heights tall. The report's job is a weekly skim; the
play screen's is the notation a child is being taught. They are allowed to
differ, and the alternative is loosening the row height of the one screen built
for density.

Nothing stored, graded or spoken changes. The value is still the string `1/2` on
the `Attempt` and in `gradeAnswer`, and narration still reads the raw prompt.

`catalog.test.ts` gains the check that **every `/` in every rendered prompt,
hint, answer and choice is a fraction**. It passes across all 350 templates
today; what it buys is that the assumption the renderer and narration both rest
on stops being a comment.

## Testing

`src/lib/fractions.ts` and the `catalog.test.ts` additions are test-first, like
everything in `lib`.

The fitter, the layout and the zoom are browser behaviour, and vitest here is
node-only - the same reason `photo/crop.ts` has tests and `photo-crop.tsx` does
not. What is testable about them has been pushed into `lib` (`MAX_PROMPT_CHARS`,
the sentinel's length, `ZOOM_LABEL_SIZE`); the rest is checked by eye in both
orientations on a phone and on an iPad, which is what CLAUDE.md already asks for
after any change to this layout.

## Deliberately not in this pass

- **Pinch and pan inside the zoom.** The figures are 100-unit drawings that fit
  their box; there is nothing outside the frame to pan to, and a bigger picture
  was the whole request.
- **Shortening the long prompts.** A separate content pass with a separate
  argument, and the cap above is what would make it worth doing.
- **Fractions in the parent's report and the speed run.** The report is above;
  the speed run's four operations never produce one.
- **Answering while the zoom is open.** It would mean the overlay leaving the
  pad uncovered, which is the layout that was measured and rejected.

Two gaps were raised in review and deliberately left, so they are written down
rather than forgotten:

- **The zoom cannot be opened from a keyboard.** The tappable figure is a
  `role="button"` with no `tabIndex`, which is exactly what `Prompt`'s
  tap-to-repeat beside it already is. Giving one of the two a tab stop and not
  the other would leave the same screen inconsistent in the opposite direction,
  so both want doing together, with focus handling for the overlay, in a pass of
  their own.
- **`figure-zoom.tsx`'s Escape effect depends on `[onClose]`**, which arrives as
  a fresh inline arrow, so with a minutes-style daily target ticking the window
  listener is torn down and re-added about once a second while the zoom is open.
  Harmless - the cleanup always runs and there is only ever one listener - but a
  `useCallback` at the call site would avoid it.
