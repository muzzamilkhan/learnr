/**
 * The clock, read where this app allows it to be read: once, at a request
 * boundary. `src/lib` takes `now` as an argument all the way down so it stays
 * pure, which leaves somebody at the edge to actually look at it, and a server
 * component rendering one request is that somebody.
 *
 * A sibling of `src/app/play/now.ts` and `src/app/(parent)/progress/now.ts`
 * rather than an import of either - each is its own route's boundary, and
 * reaching across route groups for a one-line function would tie unrelated
 * screens together to save nothing.
 *
 * It is a function so that `react-hooks/purity` is satisfied honestly, rather
 * than with a disable comment that would switch the rule off for the rest of
 * the file too.
 */
export const requestNow = (): number => Date.now();
