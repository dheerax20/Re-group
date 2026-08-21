"use client";

import { useEffect, useState, type RefObject } from "react";

type Box = { top: number; left: number; width: number; height: number };

/**
 * The dev-tools-style frame drawn over the previewed block.
 *
 * Measured relative to the preview FRAME rather than the viewport, so it needs
 * no scroll listener: the frame and the block scroll together inside the
 * canvas, and their difference is constant.
 *
 * The element it measures is `wrapper.firstElementChild` — `BlockTree`'s
 * annotate mode wraps each node in a `display: contents` div, which by
 * definition generates no box, so its own rect is empty.
 */
export function BlockHighlight({
  targetId,
  label,
  frameRef,
}: {
  targetId: string | null;
  label: string | null;
  frameRef: RefObject<HTMLDivElement | null>;
}) {
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !targetId) {
      setBox(null);
      return;
    }

    const measure = () => {
      const wrapper = frame.querySelector(`[data-block-id="${CSS.escape(targetId)}"]`);
      const element = wrapper?.firstElementChild ?? null;
      if (!element) {
        setBox(null);
        return;
      }
      const target = element.getBoundingClientRect();
      const origin = frame.getBoundingClientRect();
      setBox({
        top: target.top - origin.top,
        left: target.left - origin.left,
        width: target.width,
        height: target.height,
      });
    };

    measure();

    // Fonts loading, images arriving and the device toggle all move the block
    // after the first measurement. Watch the target too: a photo landing inside
    // a fixed-aspect container moves everything below it without changing the
    // frame's own height.
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    const target = frame.querySelector(`[data-block-id="${CSS.escape(targetId)}"]`)
      ?.firstElementChild;
    if (target) observer.observe(target);
    return () => observer.disconnect();
  }, [targetId, frameRef]);

  if (!box) return null;

  // A chip above a block sitting at the very top of the page would be clipped
  // by the frame's own `overflow-hidden`, so it flips inside.
  const chipInside = box.top < 22;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-20 rounded-sm outline outline-2 outline-offset-0 outline-accent"
      style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
    >
      {label ? (
        <span
          className="absolute left-0 whitespace-nowrap rounded-sm bg-accent px-1.5 py-0.5 font-mono text-[10px] leading-4 text-editor-shell"
          style={chipInside ? { top: 0 } : { top: -20 }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
