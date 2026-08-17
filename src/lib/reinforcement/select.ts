import type { Rng } from '../rng';
import type { QuestionTemplate } from '../templates/types';
import {
  findSkill,
  hasPattern,
  skillStatus,
  type LearnerProfile,
  type SkillStatus,
} from '../analytics/profile';

/**
 * What to ask next.
 *
 * The rule in one line: until the answers form a pattern, ask at random; once
 * they do, lean towards what the child is finding hard without burying them in
 * it, and come back to what they have mastered once enough time has passed for
 * remembering it to be worth something.
 *
 * Three things keep the lean from becoming a swarm:
 *
 *  - a **status weight** per topic, which only tilts the odds — nothing is ever
 *    ruled out, so a session never turns into twenty subtractions in a row;
 *  - a **share of the questions** that weak topics are held between, so a child
 *    with one bad topic still spends most of their time elsewhere, and one with
 *    six bad topics does not get an easy ride;
 *  - a **cooldown** on the topics just asked, so the mix is spread through the
 *    session rather than clumped.
 *
 * Pure: the caller passes `now` and the RNG, so a whole session can be replayed
 * from its seed and starting profile.
 */

/** How much each status pulls a topic towards being asked, before any mixing. */
export const STATUS_WEIGHTS: Readonly<Record<SkillStatus, number>> = {
  /** Hard, and the point of the exercise. */
  struggling: 3,
  /** Known, but long enough ago to be worth confirming. */
  'review-due': 2,
  /** Not enough answers to say — worth finding out about. */
  new: 1.4,
  /** On its way; keep it coming at roughly its natural rate. */
  developing: 1.2,
  /** Known and fresh. Not silenced — a child should still get things right. */
  secure: 0.35,
};

/** Statuses that count as work to be done, and are held to a share of the session. */
const FOCUS: ReadonlySet<SkillStatus> = new Set<SkillStatus>(['struggling', 'review-due']);

/**
 * The healthy ratio. A fifth of the questions is enough for a weak topic to
 * improve; beyond a bit under half it stops feeling like practice and starts
 * feeling like being picked on — and there is more to a year than one topic.
 */
export const MIN_FOCUS_SHARE = 0.2;
export const MAX_FOCUS_SHARE = 0.45;

/**
 * How far a topic is held back for having just been asked: the last topic first.
 * Never zero — with a small pool the same topic sometimes has to come round
 * again, and it should be unlikely rather than impossible.
 */
export const COOLDOWN: readonly number[] = [0.1, 0.4, 0.75];

/** How many questions back the cooldown remembers. */
export const RECENT_MEMORY = COOLDOWN.length;

export interface SelectionContext {
  profile: LearnerProfile;
  now: number;
  /** Topics of the last questions asked, newest first. */
  recent?: readonly string[];
}

export interface WeightedTemplate {
  template: QuestionTemplate;
  status: SkillStatus;
  /** Relative odds of being drawn. Only meaningful against the others in the list. */
  weight: number;
}

const cooldownFactor = (topic: string, recent: readonly string[]): number => {
  const position = recent.indexOf(topic);
  return position === -1 ? 1 : COOLDOWN[position] ?? 1;
};

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

/**
 * The odds each template is drawn at, and why. Exported because it is the whole
 * policy: a test can read it, and so can anything that later wants to explain a
 * choice to a parent.
 */
export function weightTemplates(
  templates: readonly QuestionTemplate[],
  context: SelectionContext,
): WeightedTemplate[] {
  const recent = context.recent ?? [];

  const statuses = templates.map((template) =>
    skillStatus(findSkill(context.profile, template.topic, template.level), context.now),
  );

  // Nothing is known yet, so there is nothing to act on: draw at random rather
  // than build a diagnosis out of two answers.
  if (!hasPattern(context.profile)) {
    return templates.map((template, index) => ({ template, status: statuses[index], weight: 1 }));
  }

  const weighted = templates.map((template, index) => ({
    template,
    status: statuses[index],
    weight: STATUS_WEIGHTS[statuses[index]] * cooldownFactor(template.topic, recent),
  }));

  const focus = weighted.filter((entry) => FOCUS.has(entry.status));
  const rest = weighted.filter((entry) => !FOCUS.has(entry.status));
  if (focus.length === 0 || rest.length === 0) return weighted;

  const focusMass = sum(focus.map((entry) => entry.weight));
  const restMass = sum(rest.map((entry) => entry.weight));
  if (focusMass <= 0 || restMass <= 0) return weighted;

  // The floor is skipped when every topic needing work is the one just asked:
  // holding the ratio matters over a session, not at the cost of asking the same
  // thing twice running.
  const justAsked = recent[0];
  const floor = focus.some((entry) => entry.template.topic !== justAsked) ? MIN_FOCUS_SHARE : 0;

  const share = focusMass / (focusMass + restMass);
  const target = Math.min(Math.max(share, floor), MAX_FOCUS_SHARE);
  if (target === share) return weighted;

  const scale = (target * restMass) / ((1 - target) * focusMass);
  return weighted.map((entry) =>
    FOCUS.has(entry.status) ? { ...entry, weight: entry.weight * scale } : entry,
  );
}

/** Draws one template. The RNG is spent exactly once, whatever the weights are. */
export function selectTemplate(
  templates: readonly QuestionTemplate[],
  context: SelectionContext,
  rng: Rng,
): QuestionTemplate {
  if (templates.length === 0) throw new Error('Cannot select a question from an empty pool');

  const weighted = weightTemplates(templates, context);
  const total = sum(weighted.map((entry) => entry.weight));
  if (!(total > 0)) return rng.pick(templates);

  let roll = rng.next() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll < 0) return entry.template;
  }
  return weighted[weighted.length - 1].template;
}

/** The topics this pool would currently treat as work to be done. */
export function focusTopics(
  templates: readonly QuestionTemplate[],
  context: SelectionContext,
): string[] {
  const topics = weightTemplates(templates, context)
    .filter((entry) => FOCUS.has(entry.status))
    .map((entry) => entry.template.topic);
  return [...new Set(topics)].sort();
}
