import Image from 'next/image';
import type { Avatar } from '@/lib/avatars';
import { AvatarIcon } from './avatar-icon';

/**
 * Whoever this is, drawn as a round face.
 *
 * **The fallback order lives here and nowhere else**: the photograph a parent
 * cropped, then the picture Google gave a grown-up, then the preset animal, then
 * the initial, then a silhouette. Six screens draw a face - the child cards, the
 * two pickers, the profile menu, the add/edit form and the leaderboard - and the
 * order got copied into each of them the moment it was written twice. One
 * component is what keeps a photo from appearing on the report and not on the
 * board a week later.
 *
 * A photo is a `data:` URL, so it is a plain `<img>`: there is no remote host to
 * allow and nothing for the image optimiser to do. A Google picture stays with
 * `next/image`, which is the one host `next.config.ts` permits.
 */
export function ProfileFace({
  photo,
  avatar,
  image,
  name,
  className = 'size-10',
  /** The pixel side the photo is drawn at - only ever a hint to the browser. */
  px = 40,
  /** The colour the drawn fallbacks wear. The shared-children card passes grape,
   *  which is how a child somebody else owns is told apart at a glance. */
  tone = 'bg-(--color-brand-soft) text-(--color-brand)',
}: {
  /** The cropped photograph, if this child has one. */
  photo?: string | null;
  /** The preset animal, which is what stands in when there is no photo. */
  avatar?: Avatar | null;
  /** A Google account's own picture. */
  image?: string | null;
  name?: string | null;
  className?: string;
  px?: number;
  tone?: string;
}) {
  const round = `${className} shrink-0 rounded-full object-cover`;

  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element -- a data URL has nothing to optimise.
    return <img src={photo} alt={name ?? ''} width={px} height={px} className={round} />;
  }

  if (image) {
    return <Image src={image} alt={name ?? ''} width={px} height={px} className={round} />;
  }

  if (avatar) {
    return (
      <span
        className={`${className} ${tone} flex shrink-0 items-center justify-center rounded-full`}
        title={name ?? undefined}
      >
        <AvatarIcon avatar={avatar} className="size-[60%]" />
      </span>
    );
  }

  const initial = name?.trim()?.[0]?.toUpperCase();

  return (
    <span
      className={`${className} ${tone} flex shrink-0 items-center justify-center rounded-full font-bold`}
      title={name ?? undefined}
    >
      {initial ?? (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-[60%] opacity-70">
          <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 1.8c-4 0-7.5 2.2-7.5 5v.7c0 .8.7 1.5 1.5 1.5h12c.8 0 1.5-.7 1.5-1.5v-.7c0-2.8-3.5-5-7.5-5Z" />
        </svg>
      )}
    </span>
  );
}
