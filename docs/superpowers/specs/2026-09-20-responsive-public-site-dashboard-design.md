# AZURA Responsive Public Site and Dashboard Design

Date: 2026-09-20
Status: Approved for implementation

## Goal

Make the existing AZURA public website and local dashboard usable and visually coherent on phones, tablets, laptops, and desktops without redesigning the established desktop identity.

## Scope

- Public website: `index.html`, shared styles, and the existing interaction scripts.
- Local dashboard: `dashboard.html` and its embedded presentation behavior.
- English LTR and Arabic RTL layouts.
- Viewports from 320px upward, with primary checks at 320, 360, 390, 430, 768, 1024, and desktop widths.

## Non-goals

- Security remediation and Worker changes.
- Changing hosting or deployment architecture.
- Replacing the desktop visual design.
- Rebuilding the dashboard data model or analytics calculations.

## Responsive Strategy

Preserve the current desktop composition and add a focused responsive behavior layer. Layouts must adapt within their own containers, and the page itself must never gain horizontal overflow.

Use fluid sizing where it improves continuity, with explicit breakpoints only where the layout changes structurally. Interactive controls must have touch targets of at least 44 by 44 CSS pixels.

## Public Website

### Header and navigation

- Keep the desktop navigation unchanged above the existing mobile breakpoint.
- On smaller screens, retain a compact header with logo, essential controls, and hamburger navigation.
- Ensure the menu fits within the viewport, scrolls internally when needed, and supports Escape, outside-click, link-click, and viewport-resize closing behavior.
- Preserve correct placement in both LTR and RTL modes.

### Hero and content sections

- Scale the hero media without cropping essential content or producing horizontal overflow.
- Stack the philosophy, services, contact information, and RFQ form into a clear single-column reading order on phones.
- Use fluid typography and spacing so headings remain prominent without wrapping awkwardly.
- Ensure form controls fill their available width and remain easy to tap.

### Project presentation

- Preserve the current 3D voyage carousel on desktop.
- On mobile, use a simplified single-card presentation optimized for swipe and touch.
- Keep previous/next controls, dots, project title, category, and social actions visible and reachable.
- Side cards must not create page overflow or obscure the active card.
- Maintain the existing analytics events when navigation occurs.

### Motion and accessibility

- Honor `prefers-reduced-motion: reduce` for the hero, carousel, and decorative animations.
- Preserve semantic controls, visible focus states, useful ARIA state, and keyboard navigation.

## Local Dashboard

### Layout

- Stack the top header, filter controls, date inputs, and action buttons when horizontal space is limited.
- Display KPI cards in a responsive grid: four columns on wide screens, two on typical phones, and one only where the content cannot fit safely.
- Resize charts to their containers and prevent labels or legends from forcing page overflow.

### Dense data

- Keep the existing table semantics.
- Place wide tables in dedicated horizontal scroll containers rather than allowing the entire page to scroll sideways.
- Keep table controls and headings visible and usable on narrow screens.
- Do not hide business data solely to make a table fit.

## Error and Empty States

Existing application behavior remains unchanged in this responsive task. Any loading, empty, or error message that is already rendered must wrap and remain readable at supported viewport widths.

## Verification

- Confirm no page-level horizontal overflow at all target widths.
- Test the mobile navigation, theme and language controls, project swipe/navigation, social actions, and RFQ form.
- Test dashboard filters, charts, RFQ table, and session table.
- Test portrait and landscape layouts.
- Check both English LTR and Arabic RTL.
- Check keyboard focus and reduced-motion behavior.
- Inspect the rendered pages in a browser and check for console errors.
- Run available syntax and whitespace checks before handoff.

## Acceptance Criteria

1. Both `index.html` and `dashboard.html` are usable from 320px through desktop widths.
2. Neither page has unintended page-level horizontal scrolling.
3. The public project experience becomes a clear single-card touch interaction on mobile while desktop retains the 3D presentation.
4. Dashboard charts and controls stay within the viewport, and tables scroll only inside their own containers.
5. Navigation, forms, slider controls, and dashboard controls remain keyboard- and touch-usable.
6. English and Arabic layouts remain functional.
7. Desktop visual behavior does not regress.
