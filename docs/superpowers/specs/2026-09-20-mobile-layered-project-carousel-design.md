# Mobile Layered Project Carousel Design

## Goal

Restore the layered three-card appearance in the Projects carousel on phones without restoring the previous overlap bugs or sluggish swipe response.

## Mobile Layout

- Keep the current project card centered and fully readable.
- Show the previous card partially behind the current card on the left.
- Show the next card partially behind the current card on the right.
- Keep the current card above both neighboring cards at every point in the state update.
- Place neighboring cards slightly lower, smaller, and less prominent than the current card.
- Return the previous and next buttons to the sides of the card stack without covering the current card content.
- Keep the pagination dots below the card stage.

## Motion and Performance

- Animate only compositor-friendly transforms and opacity on mobile.
- Use `translate3d` and scaling without mobile perspective rotation or animated filters.
- Keep idle cards hidden and non-interactive.
- Match the JavaScript navigation lock to the CSS transition duration so a completed swipe is not blocked by a longer timer.
- Preserve reduced-motion behavior.

## Responsive Scope

- Apply the layered treatment at phone widths up to 768px.
- Preserve the existing desktop carousel design and interactions.
- Maintain left-to-right and right-to-left positioning.
- Prevent horizontal page overflow at 320px and 390px widths.

## Verification

- Render and inspect the carousel at 320px, 390px, and desktop width.
- Confirm the current card has the highest stacking level.
- Confirm previous and next cards remain visible behind it.
- Confirm swipes and arrow navigation advance one card without a stale input lock.
- Confirm the page has no horizontal overflow.
