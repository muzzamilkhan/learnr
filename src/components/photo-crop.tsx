'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clampOffset,
  coverScale,
  sourceRect,
  type Offset,
  type Size,
} from '@/lib/photo/crop';
import { PHOTO_QUALITY, PHOTO_SIZE, parsePhoto } from '@/lib/photo/photo';

/**
 * The dialog a parent crops a child's face in, and the browser half of the photo
 * feature - the shim, beside `sounds.ts`, `speech.ts` and `clock.ts` and there
 * for the same reason. It touches a file input, `createImageBitmap`, pointer
 * events and a `<canvas>`, none of which exist in `src/lib`, where every module
 * is pure and every test runs in node. What *can* be asserted was pulled out
 * already: the geometry is `src/lib/photo/crop.ts` and what may be stored is
 * `src/lib/photo/photo.ts`. This file owns the pixels and nothing else, and it
 * writes no parallel maths - a rule that only holds if it keeps calling
 * `clampOffset` and `sourceRect` rather than re-deriving them beside the canvas.
 *
 * **Nothing but the crop ever leaves the browser.** The file is decoded here,
 * drawn here and encoded here, and what the form is handed back is a 256px WebP
 * data URL. The original never becomes a request.
 */

/** The square the circle is inscribed in, in CSS pixels. Fixed, because the
 *  offsets are in these pixels and a window that resized under a drag would move
 *  the picture without anyone touching it. */
const WINDOW = 256;

/** Four times the cover scale is as far in as a face is worth going; past it a
 *  phone photo is showing its own pixels. */
const MAX_ZOOM = 4;

/** A decoded picture, plus how to let go of it - an `ImageBitmap` holds memory
 *  until it is closed, and an object URL until it is revoked. */
interface Picture {
  source: CanvasImageSource;
  natural: Size;
  release: () => void;
}

/**
 * A picture is whatever the browser can decode. There is no byte limit and no
 * MIME allow-list here on purpose: a parent picks the photo of their child that
 * exists, not the one in a format an allow-list anticipated, and the honest test
 * of "is this a picture" is that it decoded. What comes out is 256px square
 * whatever went in, so a 12MP original costs a moment and nothing else.
 */
async function decode(file: File): Promise<Picture> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        natural: { width: bitmap.width, height: bitmap.height },
        release: () => bitmap.close(),
      };
    } catch {
      // Not a failure yet: some browsers refuse formats through
      // `createImageBitmap` that an `<img>` will still display, so the fallback
      // below gets its turn before anyone is told this is not a picture.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('not a picture'));
      element.src = url;
    });
    return {
      source: image,
      natural: { width: image.naturalWidth, height: image.naturalHeight },
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/**
 * The crop, drawn down to the stored square **in halving steps**.
 *
 * `drawImage` resamples by taking a handful of source pixels per destination
 * pixel, so a 3000px square asked for 256px in one hop reads about one pixel in
 * twelve and drops the rest - which is what makes a phone photo come out crunchy
 * and speckled. Never reducing by more than half at a time means every source
 * pixel is looked at on the way down, which is what a proper downscale is.
 */
function drawSquare(picture: Picture, zoom: number, offset: Offset): HTMLCanvasElement {
  const rect = sourceRect(picture.natural, WINDOW, zoom, offset);

  const step = (
    source: CanvasImageSource,
    sx: number,
    sy: number,
    ss: number,
    side: number,
  ): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext('2d');
    if (context) {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(source, sx, sy, ss, ss, 0, 0, side, side);
    }
    return canvas;
  };

  let source: CanvasImageSource = picture.source;
  let sx = rect.x;
  let sy = rect.y;
  let ss = rect.size;
  // A source already at or under the stored size is drawn once, scaled up:
  // `coverScale` would rather stretch a small picture than leave a gap in the
  // circle, and the same choice applies to the encode.
  let side = Math.max(PHOTO_SIZE, Math.round(rect.size));
  let canvas: HTMLCanvasElement | null = null;

  while (side > PHOTO_SIZE) {
    side = Math.max(PHOTO_SIZE, Math.round(side / 2));
    canvas = step(source, sx, sy, ss, side);
    source = canvas;
    sx = 0;
    sy = 0;
    ss = side;
  }

  return canvas ?? step(source, sx, sy, ss, PHOTO_SIZE);
}

export function PhotoCrop({
  onDone,
  onCancel,
}: {
  /** The cropped square, already through `parsePhoto` - a caller never has to check it. */
  onDone: (photo: string) => void;
  onCancel: () => void;
}) {
  const [picture, setPicture] = useState<Picture | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [problem, setProblem] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // The one picture held at a time is released when it is replaced or when the
  // dialog closes; a ref rather than the state value because the cleanup has to
  // see the *current* one, not the one the effect closed over.
  const held = useRef<Picture | null>(null);
  const take = useCallback((next: Picture | null) => {
    held.current?.release();
    held.current = next;
    setPicture(next);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);
  useEffect(() => () => held.current?.release(), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    setReading(true);
    try {
      take(await decode(file));
    } catch {
      take(null);
      setProblem("That isn't a picture this browser can read. Try a JPEG or a PNG.");
    } finally {
      setReading(false);
    }
  };

  // The preview is the same model the crop is: the whole picture drawn at the
  // cover scale times the zoom, slid by the offset, with the circle a mask over
  // the top. Nothing here decides what gets stored - `sourceRect` does that from
  // the same three numbers - so the preview cannot lie about the result.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !picture) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = WINDOW * ratio;
    canvas.height = WINDOW * ratio;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, WINDOW, WINDOW);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    const scale = coverScale(picture.natural, WINDOW) * zoom;
    const width = picture.natural.width * scale;
    const height = picture.natural.height * scale;
    context.drawImage(
      picture.source,
      WINDOW / 2 - width / 2 + offset.x,
      WINDOW / 2 - height / 2 + offset.y,
      width,
      height,
    );
  }, [picture, zoom, offset]);

  const changeZoom = (next: number) => {
    setZoom(next);
    // Zooming out can leave the picture short of an edge it was pinned to, so
    // the offset is re-clamped against the new zoom rather than on the next drag.
    if (picture) setOffset((was) => clampOffset(was, picture.natural, WINDOW, next));
  };

  /**
   * Pointers, mouse and touch through one path. Two down at once is a pinch, and
   * the ratio of the distance between them is a zoom - cheap here because zoom
   * and offset are already two numbers a slider and a drag write to.
   */
  const pointers = useRef(new Map<number, Offset>());
  const gesture = useRef<{ offset: Offset; zoom: number; spread: number } | null>(null);

  const spread = (): number => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  const start = (event: React.PointerEvent) => {
    if (!picture) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    gesture.current = { offset, zoom, spread: spread() };
  };

  const move = (event: React.PointerEvent) => {
    const anchor = gesture.current;
    if (!picture || !anchor || !pointers.current.has(event.pointerId)) return;
    const first = [...pointers.current.keys()][0];
    const before = pointers.current.get(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!before) return;

    if (pointers.current.size >= 2 && anchor.spread > 0) {
      const next = Math.min(MAX_ZOOM, Math.max(1, (anchor.zoom * spread()) / anchor.spread));
      setZoom(next);
      setOffset(clampOffset(offset, picture.natural, WINDOW, next));
      return;
    }

    // A pinch that lifts a finger leaves one pointer still down; only the first
    // one pans, so the picture doesn't jump to whichever finger survived.
    if (event.pointerId !== first) return;
    setOffset((was) =>
      clampOffset(
        { x: was.x + (event.clientX - before.x), y: was.y + (event.clientY - before.y) },
        picture.natural,
        WINDOW,
        zoom,
      ),
    );
  };

  const end = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    // Whatever is left restarts as its own gesture, so lifting one finger of a
    // pinch doesn't measure the next drag from where the pinch began.
    gesture.current = picture ? { offset, zoom, spread: spread() } : null;
  };

  const confirm = () => {
    if (!picture) return;
    const canvas = drawSquare(picture, zoom, offset);
    const photo = parsePhoto(canvas.toDataURL('image/webp', PHOTO_QUALITY));
    if (!photo) {
      // The real failure is silent: a browser with no WebP encoder returns a PNG
      // data URL from `toDataURL` rather than refusing, and storing that would
      // put a picture in the database that `parsePhoto` drops on the way back
      // out - a photo that saved, and then wasn't there.
      setProblem("This browser can't save the picture in the format we store. Try Safari or Chrome.");
      return;
    }
    onDone(photo);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop the photo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-(--color-ink)/40 p-4"
    >
      <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-xl border border-(--color-line) bg-(--color-card) p-4">
        <p className="text-base font-semibold">Photo</p>
        <p className="mt-0.5 text-sm text-(--color-ink-soft)">
          Drag to line up their face, and pinch or use the slider to zoom. Only the circle is
          saved, and it never leaves this device at full size.
        </p>

        {picture ? (
          <>
            <div
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              className="no-select mx-auto mt-3 touch-none overflow-hidden rounded-full border border-(--color-line)"
              style={{ width: WINDOW, height: WINDOW }}
            >
              <canvas
                ref={canvasRef}
                style={{ width: WINDOW, height: WINDOW }}
                className="block cursor-grab active:cursor-grabbing"
              />
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm">
              <span className="font-semibold">Zoom</span>
              <input
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(event) => changeZoom(Number(event.target.value))}
                className="w-full accent-(--color-brand)"
              />
            </label>
          </>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-(--color-line) px-3 py-6 text-center text-sm text-(--color-ink-soft)">
            {reading ? 'Opening the picture…' : 'Choose a picture to get started.'}
          </p>
        )}

        {problem ? <p className="mt-3 text-sm text-(--color-wrong)">{problem}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {/* Two ways in rather than one, because this is an iPad-first app and a
              parent standing in front of the child is more likely to take the
              photo than to find one. The rear camera, not the selfie one: the
              person being photographed is across the table. `capture` is ignored
              where there is no camera, so a laptop gets a second file picker. */}
          <FilePick label={picture ? 'Choose another' : 'Choose a picture'} onPick={choose} />
          <FilePick label="Take a photo" capture onPick={choose} />
          <button
            type="button"
            onClick={confirm}
            disabled={!picture}
            className="no-select rounded-lg bg-(--color-brand) px-3 py-1.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            Use this photo
          </button>
          {/* Cancel changes nothing: the form's photo is only written by `onDone`. */}
          <button
            type="button"
            onClick={onCancel}
            className="no-select rounded-lg border border-(--color-line) px-3 py-1.5 text-sm font-semibold transition hover:border-(--color-brand)"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A file input dressed as a button. The input itself stays in the page rather
 * than being clicked from script, so the tap the browser sees is the one on the
 * control - which is what iOS wants before it opens a camera.
 *
 * The value is cleared after every pick, or choosing the same file twice in a
 * row fires no `change` at all and the dialog looks broken.
 */
function FilePick({
  label,
  capture,
  onPick,
}: {
  label: string;
  capture?: boolean;
  onPick: (file: File | undefined) => void;
}) {
  return (
    <label className="no-select cursor-pointer rounded-lg border border-(--color-line) px-3 py-1.5 text-sm font-semibold transition hover:border-(--color-brand)">
      {label}
      <input
        type="file"
        accept="image/*"
        capture={capture ? 'environment' : undefined}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          onPick(file);
        }}
        className="sr-only"
      />
    </label>
  );
}
