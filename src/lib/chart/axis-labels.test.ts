import { describe, expect, it } from 'vitest';
import { axisLabels, CHART_INSETS, LABEL_ANGLE, MIN_CHARS } from './axis-labels';

/** A phone's report panel: the page's padding and the well's, off a 390px screen. */
const PHONE = 310;
/** The same panel on a laptop, where `max-w-5xl` and the padding leave this. */
const DESKTOP = 960;

describe('axisLabels', () => {
  it('lays labels flat where a bar is wide enough to hold one', () => {
    const labels = axisLabels({ width: DESKTOP, count: 6, longestChars: 14, wide: true });

    expect(labels.angled).toBe(false);
    expect(labels.maxChars).toBeGreaterThanOrEqual(14);
    expect(labels.gutter).toBe(0);
  });

  it('angles them on a narrow screen, where flat labels would collide', () => {
    const labels = axisLabels({ width: PHONE, count: 8, longestChars: 14, wide: false });

    expect(labels.angled).toBe(true);
  });

  it('angles them on a wide screen once the bars are too narrow for flat ones', () => {
    const flat = axisLabels({ width: DESKTOP, count: 8, longestChars: 20, wide: true });
    const many = axisLabels({ width: DESKTOP, count: 40, longestChars: 20, wide: true });

    expect(flat.angled).toBe(false);
    expect(many.angled).toBe(true);
  });

  it('keeps a long label readable on a phone, where vertical was the only way before', () => {
    // "addition and subtraction" is the longest topic the course ships.
    const labels = axisLabels({ width: PHONE, count: 8, longestChars: 24, wide: false });

    expect(labels.angled).toBe(true);
    expect(labels.maxChars).toBeGreaterThan(MIN_CHARS);
    expect(labels.gutter).toBeGreaterThan(0);
  });

  it('never spends more than a corner of the width on the gutter', () => {
    const labels = axisLabels({ width: PHONE, count: 8, longestChars: 60, wide: false });

    expect(labels.gutter).toBeLessThan(PHONE / 3);
  });

  it('asks for no gutter and little height when the labels are short', () => {
    const short = axisLabels({ width: PHONE, count: 8, longestChars: 5, wide: false });
    const long = axisLabels({ width: PHONE, count: 8, longestChars: 24, wide: false });

    expect(short.gutter).toBe(0);
    expect(short.height).toBeLessThan(long.height);
  });

  it('elides to the longest label rather than past it', () => {
    const labels = axisLabels({ width: DESKTOP, count: 4, longestChars: 9, wide: false });

    expect(labels.maxChars).toBe(9);
  });

  it('survives an unmeasured box without dividing by nothing', () => {
    const labels = axisLabels({ width: 0, count: 0, longestChars: 0, wide: false });

    expect(Number.isFinite(labels.maxChars)).toBe(true);
    expect(labels.maxChars).toBeGreaterThanOrEqual(0);
    expect(labels.gutter).toBe(0);
  });

  it('brings the type size down to keep a tilted label off the one below it', () => {
    const tight = axisLabels({ width: PHONE, count: 8, longestChars: 24, wide: false });
    const roomy = axisLabels({ width: DESKTOP, count: 8, longestChars: 24, wide: false });

    // The clearance between two tilted labels is the band across the tilt.
    const band = (PHONE - 44 - tight.gutter) / 8;
    expect(tight.fontSize).toBeLessThan(roomy.fontSize);
    expect(tight.fontSize).toBeLessThanOrEqual(band * Math.sin(Math.PI / 6));
  });

  it('leaves flat labels at full size, where nothing can collide with them', () => {
    const labels = axisLabels({ width: DESKTOP, count: 6, longestChars: 14, wide: true });

    expect(labels.fontSize).toBe(12);
  });

  it('never leans a label off the left of the chart, at any width', () => {
    const radians = (LABEL_ANGLE * Math.PI) / 180;
    const clipped: string[] = [];

    for (const width of [240, 280, 310, 390, 430, 560, 744, 960, 1120, 1440]) {
      for (const count of [1, 3, 6, 8, 12]) {
        for (const wide of [false, true]) {
          const labels = axisLabels({ width, count, longestChars: 40, wide });
          if (!labels.angled) continue;

          const plot = width - CHART_INSETS.valueAxis - CHART_INSETS.right - labels.gutter;
          const room = labels.gutter + CHART_INSETS.valueAxis + plot / count / 2;
          // The far corner of the leftmost label: its length across the tilt,
          // plus the half of the line standing above its own baseline.
          const reach =
            labels.maxChars * labels.fontSize * 0.55 * Math.cos(radians) +
            (labels.fontSize / 2) * Math.sin(radians);

          if (reach > room + 0.5) clipped.push(`${width}px, ${count} bars, wide=${wide}`);
        }
      }
    }

    expect(clipped).toEqual([]);
  });

  it('is a shallow angle, so a label is read without tilting your head', () => {
    expect(LABEL_ANGLE).toBe(30);
  });
});
