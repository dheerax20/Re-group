import * as React from "react";

/**
 * Makes every link inside a preview dead.
 *
 * Both previews render the REAL block tree, so a nav item is a real
 * `next/link` pointing at the church's own site — clicking one navigated the
 * dashboard away from the editor mid-edit. This intercepts the click instead
 * of setting `pointer-events: none` on the frame, so hovering, scrolling, text
 * selection and the tree's own interactive islands (the mobile hamburger in
 * `nav-links-block.tsx`, YouTube embeds) all keep working — the preview still
 * demonstrates the site, it just cannot leave.
 *
 * Capture phase and `preventDefault` only, deliberately no `stopPropagation`:
 * `next/link` bails out when the event is already default-prevented, the raw
 * `<a target="_blank">` in `SocialLinksView` is stopped by the same call, and
 * cmd/ctrl-click plus middle-click (`auxclick`) are covered too. Handlers that
 * are not navigation — the drawer closing itself on tap — still run. Nothing
 * inside the block renderer has to know it is being previewed.
 */
export function useInertLinks() {
  const block = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as Element | null;
    if (target?.closest?.("a[href]")) event.preventDefault();
  }, []);

  return { onClickCapture: block, onAuxClickCapture: block };
}
