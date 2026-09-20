# Mobile Layered Project Carousel Implementation Plan

## Goal

Deliver a smooth three-card mobile carousel where the active project stays above partially visible previous and next cards, while desktop behavior remains unchanged.

## Constraints and Definition of Done

- Modify only the carousel CSS, carousel state/timing JavaScript, and frontend cache version.
- Preserve all project content, links, analytics, keyboard support, RTL behavior, and desktop styling.
- At 320px and 390px, the active card is centered at the highest stacking level, adjacent cards remain visible behind it, controls remain usable, and the document has no horizontal overflow.
- The JavaScript input lock matches the CSS transition duration and respects reduced motion.

## Task 1: Mobile layered presentation

- Modify: `assets/css/style.css`
- Reproduction: the current mobile CSS hides both adjacent cards with zero opacity.
- Implementation: restore partial side-card visibility with mobile-only `translate3d`, scale, vertical offset, opacity, and fixed stacking order; return arrow controls to safe side positions.
- Verification: computed rectangles and stacking levels at 320px and 390px; desktop screenshot regression check.
- Rollback: revert the mobile media-query block only.

## Task 2: Navigation timing and stacking correctness

- Modify: `assets/js/voyage-slider.js`
- Reproduction: mobile CSS completes in 420ms while JavaScript rejects input for 750ms, and a transitioning side card can receive a higher inline z-index than the active card.
- Implementation: read the effective CSS duration when navigating and keep the active card above both adjacent cards.
- Verification: syntax check plus two sequential navigations after the computed transition duration; inspect active/adjacent z-index values.
- Rollback: restore the previous fixed timer and stacking values independently.

## Task 3: Deployment and live regression

- Modify: `index.html` cache-version query for changed frontend assets.
- Verification: `git diff --check`, JavaScript syntax check, mobile browser renders, desktop render, commit, push, then confirm the versioned assets and computed live layout from `azurastudio.site`.
- Cleanup: remove temporary browser profiles, scripts, and screenshots.
