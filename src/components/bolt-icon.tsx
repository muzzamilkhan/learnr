/**
 * A lightning bolt: the mark of a speed run, wherever one is offered.
 *
 * Drawn rather than written for the same reason as the tick on the Check key and
 * the door in the header - the child this is aimed at may not read "90 seconds",
 * and a bolt has meant fast since long before they got here.
 */
export function BoltIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M13.4 2 4.8 13.1c-.4.5 0 1.2.6 1.2h4.3l-1.3 7.4c-.1.7.8 1.1 1.2.5l8.6-11.1c.4-.5 0-1.2-.6-1.2h-4.3l1.3-7.4c.1-.7-.8-1.1-1.2-.5Z" />
    </svg>
  );
}
