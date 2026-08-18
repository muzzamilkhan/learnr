/**
 * The clock, read where this app allows it to be read: once, at a request
 * boundary. `src/lib` takes `now` as an argument all the way down so it stays
 * pure, which leaves somebody at the edge to actually look at it, and a server
 * component rendering one request is that somebody.
 *
 * A sibling of `src/app/(parent)/progress/now.ts` rather than an import of it -
 * that file is the progress route's own boundary, and reaching out of `play`
 * into another route group for a one-line function would tie two unrelated
 * screens together to save nothing.
 *
 * It is a function so that `react-hooks/purity` is satisfied honestly. A bare
 * `Date.now()` in a component body is flagged because in a client component the
 * value shifts unpredictably between renders; this page renders once per
 * request, and naming the boundary is how that is said - rather than a disable
 * comment, which would switch the rule off for everything else in the file too.
 */
export const requestNow = (): number => Date.now();
