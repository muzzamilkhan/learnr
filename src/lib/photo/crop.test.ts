import { describe, expect, it } from 'vitest';
import { clampOffset, coverScale, sourceRect } from './crop';

const landscape = { width: 400, height: 200 };
const portrait = { width: 200, height: 400 };

describe('coverScale', () => {
  it('scales the short side up to fill the window', () => {
    expect(coverScale(landscape, 100)).toBe(0.5);
    expect(coverScale(portrait, 100)).toBe(0.5);
  });

  it('scales a small picture up rather than leaving a gap', () => {
    expect(coverScale({ width: 50, height: 50 }, 100)).toBe(2);
  });
});

describe('clampOffset', () => {
  it('lets a wide picture slide sideways but not up and down', () => {
    // 400x200 at cover fills a 100 window: 200x100 on screen, 50px of slack each way.
    expect(clampOffset({ x: 999, y: 999 }, landscape, 100, 1)).toEqual({ x: 50, y: 0 });
    expect(clampOffset({ x: -999, y: -999 }, landscape, 100, 1)).toEqual({ x: -50, y: 0 });
  });

  it('leaves an offset inside the slack alone', () => {
    expect(clampOffset({ x: 20, y: 0 }, landscape, 100, 1)).toEqual({ x: 20, y: 0 });
  });

  it('gives both axes slack once zoomed in', () => {
    // Zoom 2 draws 400x200 on screen, so 150 and 50 of slack.
    expect(clampOffset({ x: 999, y: 999 }, landscape, 100, 2)).toEqual({ x: 150, y: 50 });
  });
});

describe('sourceRect', () => {
  it('takes the middle square at rest', () => {
    expect(sourceRect(landscape, 100, 1, { x: 0, y: 0 })).toEqual({ x: 100, y: 0, size: 200 });
  });

  it('takes a smaller square as the zoom goes up', () => {
    expect(sourceRect(landscape, 100, 2, { x: 0, y: 0 })).toEqual({ x: 150, y: 50, size: 100 });
  });

  it('moves the square opposite the drag', () => {
    // Dragging the picture right by 50 shows what was off its left edge.
    expect(sourceRect(landscape, 100, 1, { x: 50, y: 0 })).toEqual({ x: 0, y: 0, size: 200 });
  });

  it('never leaves the picture, however far it is dragged', () => {
    const rect = sourceRect(landscape, 100, 1, { x: 9999, y: 9999 });
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.size).toBeLessThanOrEqual(landscape.width);
    expect(rect.y + rect.size).toBeLessThanOrEqual(landscape.height);
  });

  it('is a square of the short side when nothing is zoomed', () => {
    expect(sourceRect(portrait, 100, 1, { x: 0, y: 0 })).toEqual({ x: 0, y: 100, size: 200 });
  });
});
