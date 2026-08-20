import type { Scope } from '../expr';
import type { Rng } from '../rng';
import type { FieldReader } from './fields';
import type { FigureKind, FigureSpec, Mark } from './types';
import { angleModule } from './angle-kind';
import { polygonModule } from './polygon-kind';

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
  build(spec: FigureSpec, scope: Scope, rng: Rng): Mark[];
  issues(spec: FigureSpec, scope: Scope, read: FieldReader): string[];
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
for (const kindModule of [polygonModule, angleModule]) registerFigureKind(kindModule);
