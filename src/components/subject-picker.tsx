'use client';

import { useRouter } from 'next/navigation';

import { Select } from '@/components/select';

/**
 * Which subject this screen is about. A dropdown rather than tabs: it was
 * written while maths was the only subject, when a row of one tab would have
 * been a label pretending to be a control and a dropdown with one option was
 * honestly a dropdown. It reads the same now English has made it a real
 * choice, which is what that argument was for.
 *
 * The order the options arrive in is the caller's, and the report hands them
 * over maths-first (`compareSubjects`) rather than alphabetically.
 *
 * Like `ChildPicker`, the choice goes in the URL so a refresh keeps it.
 */
export function SubjectPicker({
  subjects,
  selected,
  child,
}: {
  subjects: string[];
  selected: string;
  child: string;
}) {
  const router = useRouter();

  if (subjects.length === 0) return null;

  return (
    <Select
      label="Subject"
      value={selected}
      options={subjects.map((subject) => ({ value: subject, label: titleCase(subject) }))}
      onChange={(subject) => router.replace(`/progress?child=${child}&subject=${subject}`)}
    />
  );
}

/** The options were capitalised in CSS while this was a native select; the
 *  custom one draws its own label text, so do it there. */
function titleCase(subject: string) {
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}
