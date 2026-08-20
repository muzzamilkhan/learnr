import { describe, expect, it } from 'vitest';
import { axisLabels, CHART_INSETS, LABEL_ANGLE, MIN_CHARS } from './axis-labels';

/** A phone's report panel: the page's padding and the well's, off a 390px screen. */
const PHONE = 310;
/** The same panel on a laptop, where `max-w-5xl` and the padding leave this. */
const DESKTOP = 960;

/** The longest topic the course ships, and one of the shorter ones. */
const LONG = 'addition and subtraction'.length;
const SHORT = 'fractions'.length;

const evenly = (count: number, length: number) => Array.from({ length: count }, () => length);

describe('axisLabels', () => {
  it('lays labels flat where a bar is wide enough to hold one', () => {
    const labels = axisLabels({ width: DESKTOP, lengths: evenly(6, 14), wide: true });

    expect(labels.angled).toBe(false);
    expect(labels.maxChars).toEqual(evenly(6, 14));
    expect(labels.gutter).toBe(0);
  });

  it('angles them on a narrow screen, where flat labels would collide', () => {
    const labels = axisLabels({ width: PHONE, lengths: evenly(8, 14), wide: false });

    expect(labels.angled).toBe(true);
  });

  it('angles them on a wide screen once the bars are too narrow for flat ones', () => {
    const flat = axisLabels({ width: DESKTOP, lengths: evenly(8, 20), wide: true });
    const many = axisLabels({ width: DESKTOP, lengths: evenly(40, 20), wide: true });

    expect(flat.angled).toBe(false);
    expect(many.angled).toBe(true);
  });

  it('keeps a long label readable on a phone, where vertical was the only way before', () => {
    const labels = axisLabels({ width: PHONE, lengths: evenly(8, LONG), wide: false });

    expect(labels.angled).toBe(true);
    expect(Math.min(...labels.maxChars)).toBeGreaterThan(MIN_CHARS);
  });

  it('asks for no gutter at all when only the far bars carry a long name', () => {
    const onTheLeft = axisLabels({
      width: PHONE,
      lengths: [LONG, SHORT, SHORT, SHORT, SHORT, SHORT, SHORT, SHORT],
      wide: false,
    });
    const onTheRight = axisLabels({
      width: PHONE,
      lengths: [SHORT, SHORT, SHORT, SHORT, SHORT, SHORT, SHORT, LONG],
      wide: false,
    });

    // The same eight names either way: only where the long one sits decides
    // what the chart spends, since over the last bar it leans across the plot.
    expect(onTheRight.gutter).toBe(0);
    expect(onTheLeft.gutter).toBeGreaterThan(onTheRight.gutter);
  });

  it('elides the cramped label without trimming the roomy one beside it', () => {
    // Narrow enough that the gutter hits its ceiling and the leftmost label is
    // genuinely short of room - the only case where anything is elided for
    // want of width rather than height.
    const labels = axisLabels({ width: 160, lengths: evenly(4, LONG), wide: false });

    expect(labels.maxChars[0]).toBeLessThan(labels.maxChars[3]);
  });

  it('never spends more than a corner of the width on the gutter', () => {
    const labels = axisLabels({ width: PHONE, lengths: evenly(8, 60), wide: false });

    expect(labels.gutter).toBeLessThan(PHONE / 3);
  });

  it('reserves less height for short labels than for long ones', () => {
    const short = axisLabels({ width: PHONE, lengths: evenly(8, 5), wide: false });
    const long = axisLabels({ width: PHONE, lengths: evenly(8, LONG), wide: false });

    expect(short.gutter).toBe(0);
    expect(short.height).toBeLessThan(long.height);
  });

  it('elides to the label rather than past it', () => {
    const labels = axisLabels({ width: DESKTOP, lengths: evenly(4, 9), wide: false });

    expect(labels.maxChars).toEqual(evenly(4, 9));
  });

  it('survives an unmeasured box without dividing by nothing', () => {
    const labels = axisLabels({ width: 0, lengths: [], wide: false });

    expect(labels.maxChars).toEqual([]);
    expect(labels.gutter).toBe(0);
    expect(Number.isFinite(labels.height)).toBe(true);
  });

  it('brings the type size down to keep a tilted label off the one below it', () => {
    // More bars than the report itself draws, which is the point: the type is
    // what gives way when the bars get too close for a label to fit between.
    const tight = axisLabels({ width: PHONE, lengths: evenly(16, LONG), wide: false });
    const roomy = axisLabels({ width: PHONE, lengths: evenly(8, LONG), wide: false });

    const band = (PHONE - 44 - tight.gutter) / 16;
    expect(tight.fontSize).toBeLessThan(roomy.fontSize);
    expect(tight.fontSize).toBeLessThanOrEqual(band * Math.sin((LABEL_ANGLE * Math.PI) / 180));
  });

  it('never leans a label off the left of the chart, at any width', () => {
    const radians = (LABEL_ANGLE * Math.PI) / 180;
    const clipped: string[] = [];

    for (const width of [240, 280, 310, 390, 430, 560, 744, 960, 1120, 1440]) {
      for (const count of [1, 3, 6, 8, 12]) {
        for (const wide of [false, true]) {
          const labels = axisLabels({ width, lengths: evenly(count, 40), wide });
          if (!labels.angled) continue;

          const plot = width - CHART_INSETS.valueAxis - CHART_INSETS.right - labels.gutter;

          labels.maxChars.forEach((chars, bar) => {
            const room = labels.gutter + CHART_INSETS.valueAxis + (plot / count) * (bar + 0.5);
            // The far corner of the label: its length across the tilt, plus the
            // half of the line standing above its own baseline.
            const reach =
              chars * labels.fontSize * 0.55 * Math.cos(radians) +
              (labels.fontSize / 2) * Math.sin(radians);

            if (reach > room + 0.5) clipped.push(`${width}px, ${count} bars, bar ${bar}`);
          });
        }
      }
    }

    expect(clipped).toEqual([]);
  });

  it('is a tilt rather than a turn, and not so flat it eats the left margin', () => {
    // Flatter reads more easily and reaches further sideways, so the gutter it
    // needs grows as the angle falls - which is what settled on this one.
    expect(LABEL_ANGLE).toBe(45);
  });
});
