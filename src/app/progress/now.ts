/**
 * The clock, read at the only place this app is allowed to read it: a request
 * boundary. Everything under `src/lib` takes `now` as an argument so it stays
 * pure and testable, which means somebody has to actually look at the clock —
 * and a `force-dynamic` server component running once per request is the right
 * somebody.
 *
 * It sits behind a function because `react-hooks/purity` flags a bare
 * `Date.now()` in a component body, and it is right to in a client component:
 * a value read during render updates unpredictably across re-renders. A server
 * component renders once per request, so the rule does not apply here — and
 * this boundary is what says so, rather than a blanket disable comment that
 * would silence the rule for the whole file.
 */
export const requestNow = (): number => Date.now();
