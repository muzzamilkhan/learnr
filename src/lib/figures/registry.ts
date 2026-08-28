import type { Scope } from '../expr';
import type { Rng } from '../rng';
import type { FieldReader } from './fields';
import type { Expr, FigureKind, FigureSpec, Mark } from './types';
import { angleModule } from './angle-kind';
import { arrayModule } from './array-kind';
import { barModule } from './bar-kind';
import { clockModule } from './clock-kind';
import { fractionShapeModule } from './fraction-shape-kind';
import { gridModule } from './grid-kind';
import { numberLineModule } from './number-line-kind';
import { pictographModule } from './pictograph-kind';
import { polygonModule } from './polygon-kind';
import { solidModule } from './solid-kind';
import { spinnerModule } from './spinner-kind';
import { timelineModule } from './timeline-kind';

/**
 * Whether a kind can be drawn without one of its parameters. Two words rather
 * than a boolean because the states are read very differently and a bare `true`
 * at the call site says which one it is only to whoever wrote it: an absent
 * *optional* parameter is what asks for jitter, and an absent *required* one is
 * an authoring mistake worth a sentence in front of somebody who can fix it.
 */
export type FieldRequirement = 'required' | 'optional';

/** Every parameter an author may write on one kind, and which of the two it is. */
export type FigureFields<K extends FigureKind> = {
  [P in Exclude<keyof Extract<FigureSpec, { kind: K }>, 'kind'>]-?: FieldRequirement;
};

/**
 * One kind of figure, in one place: how it is drawn and what an author can get
 * wrong about it.
 *
 * `buildFigure` used to be a ternary over the kind and `figureIssues` a branch
 * beside it, which is fine for two kinds and is a queue for eleven - every new
 * kind an edit to the same two functions, and every kind's drawing and its
 * validation written a hundred lines apart with nothing but discipline keeping
 * them describing the same fields. A module puts a kind's two halves next to
 * each other and reduces adding one to a file and a line here.
 */
export interface FigureKindModule<K extends FigureKind> {
  kind: K;
  /**
   * Every parameter an author may write on this kind. It is what
   * `validateTemplate` walks to check that each one parses and reads only
   * variables the template binds - the check that used to be a ternary over the
   * kind in `validate.ts`, which is the third place a new kind would otherwise
   * have had to be added.
   *
   * **A record rather than a list, so it cannot be written short.** The mapped
   * type strips the spec's `?` markers, which makes every optional parameter a
   * required *key here*: a field added to this kind's `FigureSpec` variant and
   * forgotten in this table is a type error, where a list would simply have
   * left it unvalidated for good. A key the spec does not declare is refused
   * from the other side by the same type.
   *
   * The order it is written in is the order the errors come out in, since
   * string keys iterate in insertion order.
   *
   * This is a table of *names*, not a validator: what a field means, what type
   * it has to evaluate to and what values are drawable is `issues`' business,
   * where the wording and the geometry are.
   */
  fields: FigureFields<K>;
  /**
   * The marks this kind draws, in the **maths frame**: x right, y *up*, degrees
   * anticlockwise from east, at whatever scale suits the shape. `fit` in
   * `build.ts` turns y over and scales the lot into the box afterwards, so that
   * flip stays at the one boundary rather than being remembered by eleven kinds.
   *
   * Like `buildFigure` itself, it **never throws**: it runs mid-session with a
   * child waiting, so a field it cannot read degrades into something drawable.
   */
  build(spec: Extract<FigureSpec, { kind: K }>, scope: Scope, rng: Rng): Mark[];
  /**
   * Authoring mistakes in this kind's own fields, in words. Never throws - it
   * is handed content written outside the app, where a mistake is reported and
   * never thrown.
   *
   * `read` reports field-level mistakes itself (see `FieldReader`), so what
   * this returns is only what the kind judged about values that read back
   * clean - a degrees outside 1-359, a mirror the shape has no room for.
   * `figureIssues` puts the two together.
   */
  issues(spec: Extract<FigureSpec, { kind: K }>, scope: Scope, read: FieldReader): string[];
  /**
   * Authoring mistakes only visible by reading the *answer* alongside this
   * kind's own fields - optional, and implemented by `array` and `grid`.
   *
   * `issues` above is deliberately blind to `answer`: it is handed a bound
   * `scope`, not the template around it, so a kind whose jitter can silently
   * pick a *different* answer from the one the template committed to (see
   * `array-kind.ts`'s `orientation`, and `grid-kind.ts`'s `axisLabels`, which
   * changes the notation the answer is *spelled* in) has nowhere else in the
   * module contract to say so. This is that seam - `validateTemplate` calls it
   * once, statically, with the raw `answer` expression string, no drawing and
   * no `Rng` involved.
   *
   * It stays optional rather than a required no-op on the other nine kinds
   * for the reason `figure-kind-author-notes.md` section 2b gives: their
   * jitters leave every possible question about them true, so there is
   * nothing for those kinds to say here - and a required method returning
   * `[]` nine times over is a fact about two kinds dressed up as one about
   * the interface.
   */
  answerIssues?(spec: Extract<FigureSpec, { kind: K }>, answer: Expr): string[];
}

/**
 * A module of any kind: what the registry holds, and what a lookup by a string
 * off untrusted content hands back.
 *
 * Structurally this is `FigureKindModule<FigureKind>` - `Extract<FigureSpec, {
 * kind: FigureKind }>` is `FigureSpec` - and it is written out again rather
 * than aliased to it because those two are not the same thing to the checker.
 * Two instantiations of one generic are compared by the variance of its
 * parameter, and `K` here measures as invariant: it is a property, and it is
 * inside the `Extract` on two method parameters. So
 * `FigureKindModule<'polygon'>` is not a `FigureKindModule<FigureKind>`,
 * however plainly it is one to a reader, and an alias or an `extends` inherits
 * that refusal. A declaration of its own drops back to the ordinary structural
 * check, where a method taking a polygon spec satisfies one taking any spec.
 *
 * That widening is the truth the `Map`'s key already guarantees: a module is
 * filed under its own `kind`, so the only spec `figureKindModule('polygon')`
 * can ever be handed back for is a polygon's.
 */
export interface AnyFigureKindModule {
  kind: FigureKind;
  fields: Record<string, FieldRequirement>;
  build(spec: FigureSpec, scope: Scope, rng: Rng): Mark[];
  issues(spec: FigureSpec, scope: Scope, read: FieldReader): string[];
  answerIssues?(spec: FigureSpec, answer: Expr): string[];
}

/**
 * Every kind, keyed by name. A `Map` rather than a record literal because the
 * lookup is by a string off untrusted content - `figureKindModule('__proto__')`
 * has to come back empty, the same reason `src/lib/expr` looks its variables up
 * on null-prototype tables.
 */
const modules = new Map<string, AnyFigureKindModule>();

export function registerFigureKind(kindModule: AnyFigureKindModule): void {
  modules.set(kindModule.kind, kindModule);
}

export function figureKindModule(kind: string): AnyFigureKindModule | undefined {
  return modules.get(kind);
}

/**
 * The registrations, listed here rather than run as a side effect inside each
 * kind's own file. Self-registration would mean this module importing the kinds
 * and the kinds importing it back, and the map above would still be in its
 * temporal dead zone when the first kind called `registerFigureKind` - a
 * circular import that fails at load rather than in a test. Listing them costs
 * a new kind one line, in the file whose test insists every kind has one.
 */
for (const kindModule of [
  polygonModule,
  angleModule,
  barModule,
  pictographModule,
  spinnerModule,
  solidModule,
  numberLineModule,
  clockModule,
  arrayModule,
  fractionShapeModule,
  gridModule,
  timelineModule,
]) {
  registerFigureKind(kindModule);
}
