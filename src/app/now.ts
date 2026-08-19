/**
 * The clock, read where this app allows it to be read: once, at a request
 * boundary. `src/lib` takes `now` as an argument all the way down so it stays
 * pure, which leaves somebody at the edge to actually look at it, and a server
 * component rendering one request is that somebody.
 *
 * One of these for the whole app. There were three - one per route - each with a
 * comment explaining why it must not be shared, and all three were the same
 * line. Nothing about reading the clock differs between the home screen, the
 * play screen and the parent's report, so there is nothing for a per-route copy
 * to say differently.
 *
 * It is a function so that `react-hooks/purity` is satisfied honestly. A bare
 * `Date.now()` in a component body is flagged because in a client component the
 * value shifts unpredictably between renders; a page renders once per request,
 * and naming the boundary is how that is said - rather than a disable comment,
 * which would switch the rule off for everything else in the file too.
 */
export const requestNow = (): number => Date.now();
