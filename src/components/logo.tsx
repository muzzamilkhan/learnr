import Image from 'next/image';

/**
 * The app's mark, and the full lockup it was cut from.
 *
 * Both are derived from `public/logo.PNG`, the artwork as delivered: the white
 * page it was drawn on is flood-filled to transparency from the edges inwards,
 * so the white *inside* the mark - the book's pages, the eyes, the sparkles -
 * survives and the mark sits on `--color-paper` without a pale square around it.
 * The same mark is the tab icon and the iOS home-screen icon.
 *
 * The mark alone is what goes in a header, because the word "LearnR" is already
 * there in type beside it; the lockup carries its own wordmark and tagline, so
 * it is only used where nothing else is saying what this is - the landing hero.
 *
 * Neither appears on the play screen. That screen is one question at arm's
 * length with nothing else to look at, and a logo in the corner is exactly the
 * kind of thing a child watches instead of the question - the same reason the
 * header counts no time and no score.
 */

/** Height in pixels at the three scales the app is built at. */
const MARK_SIZES = { sm: 32, md: 40, lg: 56 } as const;

export function LogoMark({
  size = 'md',
  className = '',
}: {
  size?: keyof typeof MARK_SIZES;
  className?: string;
}) {
  const px = MARK_SIZES[size];
  return (
    <Image
      src="/logo-mark.png"
      alt=""
      aria-hidden
      width={px}
      height={px}
      priority
      className={`shrink-0 ${className}`}
      style={{ width: px, height: px }}
    />
  );
}

export function LogoLockup({ className = '' }: { className?: string }) {
  return (
    <Image
      src="/logo-lockup.png"
      alt="LearnR - practice today, shine tomorrow"
      width={1000}
      height={771}
      priority
      // Without this the browser is told to preload the 1080px source for a
      // slot that is never wider than 320.
      sizes="(min-width: 640px) 20rem, 14rem"
      className={`h-auto w-full ${className}`}
    />
  );
}
