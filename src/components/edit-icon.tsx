/**
 * A pencil: change this child's name, picture or level.
 *
 * Drawn rather than written for a different reason from the tick on the Check
 * key - a parent can read perfectly well. Here it is room: the card's buttons
 * sit in one row beside the child's name, and the two that are always there and
 * never explain anything ("Edit", "Remove") were pushing the two that matter -
 * the report and the login code - onto a second line on a narrow screen.
 *
 * Sized to the parent's scale, like everything under `ParentShell`.
 */
export function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
