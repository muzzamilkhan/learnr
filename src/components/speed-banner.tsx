'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { dismissRecordsAction } from '@/app/speed/actions';
import type { ChildRecord } from '@/lib/dto';
import { recordBanners } from '@/lib/speedrun/banner';
import { StarIcon } from './star-icon';

/**
 * "Shanaaya scored her personal best..." - never your own. `readUnseenRecords`
 * is scoped to this parent's *children*, so a parent who beats their own best
 * on `/speed` produces no row here at all; there is nothing this
 * component needs to do to keep that true.
 *
 * One row per child rather than one per achievement: dismissing marks every
 * unseen record for that child seen in one write (`dismissSpeedRecords`), so a
 * second, independently-dismissable row for the same child would promise an
 * interaction the server does not have. The sentence itself - which mode gets
 * named, which gets its difficulty spelled out instead - is `recordBanners`'
 * job, in `lib` and tested there rather than judged by eye here.
 */
export function SpeedBanner({ records }: { records: ChildRecord[] }) {
  const banners = useMemo(() => recordBanners(records), [records]);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [, startTransition] = useTransition();
  const router = useRouter();

  const visible = banners.filter((banner) => !dismissed.has(banner.childId));
  if (visible.length === 0) return null;

  const dismiss = (childId: string) => {
    // Hidden the moment it is tapped rather than after the round trip - the
    // same reason the play screen's star total corrects itself before the
    // server confirms it. `router.refresh()` then re-fetches `records` with
    // that child's row already marked seen, so nothing flickers back in.
    setDismissed((prev) => new Set(prev).add(childId));
    startTransition(async () => {
      await dismissRecordsAction(childId);
      router.refresh();
    });
  };

  return (
    <div className="mb-6 flex flex-col gap-2">
      {visible.map((banner) => (
        <div
          key={banner.childId}
          className="flex items-center gap-3 rounded-xl border border-(--color-star) bg-(--color-star-soft) px-4 py-3"
        >
          <StarIcon filled className="h-5 w-5 shrink-0 text-(--color-star)" />
          <p className="min-w-0 flex-1 text-sm font-medium">{banner.message}</p>
          <button
            type="button"
            onClick={() => dismiss(banner.childId)}
            aria-label={`Dismiss ${banner.childName}'s speed run banner`}
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-(--color-ink-soft) transition hover:text-(--color-ink)"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
