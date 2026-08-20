import type { Scope } from '../expr';
import type { Rng } from '../rng';
import { angleMarks } from './angle';
import { clamp, jitter, numberValue, readField, truthy } from './fields';
import type { FigureKindModule } from './registry';
import type { FigureSpec, Mark } from './types';

/**
 * The `angle` kind: a vertex, two arms and the sweep between them. The geometry
 * itself is `angle.ts`; this is the spec read into it, and the authoring rules
 * for the same fields sitting beside that reading rather than a file away.
 */

type AngleSpec = Extract<FigureSpec, { kind: 'angle' }>;

/** How long an angle's arms are drawn, before the fit rescales everything anyway. */
const ARM_BAND = [0.6, 1] as const;

/** Where a broken or missing `degrees` lands - still an angle, just not the asked one. */
const DEGREES_BAND = [15, 345] as const;

/** The angles that can be drawn at all: a zero is no angle and a full turn is none either. */
const DEGREES_RANGE = [1, 359] as const;

export const angleModule: FigureKindModule<'angle'> = {
  kind: 'angle',

  build(spec: AngleSpec, scope: Scope, rng: Rng): Mark[] {
    const asked = numberValue(readField(spec.degrees, scope));
    const degrees = asked === undefined ? jitter(rng, ...DEGREES_BAND) : clamp(asked, ...DEGREES_RANGE);
    const rotation = numberValue(readField(spec.rotation, scope)) ?? jitter(rng, 0, 360);

    // A pinned arm length makes both arms that length - pinning is pinning. What
    // it really says is "the same", since the fit rescales the drawing and only
    // the ratio between the two arms survives it.
    const pinned = numberValue(readField(spec.armLength, scope));
    const arms: [number, number] =
      pinned !== undefined && pinned > 0
        ? [pinned, pinned]
        : [jitter(rng, ...ARM_BAND), jitter(rng, ...ARM_BAND)];

    const arc = readField(spec.arc, scope);
    return angleMarks(degrees, rotation, arms, arc === undefined ? true : truthy(arc));
  },

  issues(spec, scope, read) {
    const issues: string[] = [];

    const degrees = read(spec.degrees, 'figure.degrees', 'number', true);
    if (typeof degrees === 'number' && (degrees < DEGREES_RANGE[0] || degrees > DEGREES_RANGE[1])) {
      issues.push(
        `figure.degrees: ${degrees} is outside ${DEGREES_RANGE[0]}-${DEGREES_RANGE[1]}` +
          ` and would be clamped`,
      );
    }

    const armLength = read(spec.armLength, 'figure.armLength', 'number');
    if (typeof armLength === 'number' && armLength <= 0) {
      issues.push(`figure.armLength: ${armLength} is not a length`);
    }

    read(spec.rotation, 'figure.rotation', 'number');
    read(spec.arc, 'figure.arc', 'boolean');

    return issues;
  },
};
