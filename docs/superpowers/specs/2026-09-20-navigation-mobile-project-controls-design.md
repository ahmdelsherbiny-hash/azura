# AZURA Navigation and Mobile Project Controls Design

Date: 2026-09-20
Status: Approved for implementation

## Goal

Correct the public navigation order and make the mobile project carousel controls clear, separated, and comfortable to use without changing the desktop carousel.

## Navigation

The navigation order is:

1. Home
2. About
3. Projects
4. Contact Us

`Home` links to the hero section. `About` links to the signature section, which continues to contain the services content. The separate Services navigation item is removed.

The page section order remains Hero/Home, About, Projects, then Contact because the document already follows that structure.

## Mobile Project Carousel

- Preserve the desktop 3D carousel above the mobile breakpoint.
- Keep one centered project card on mobile.
- Remove the arrow controls from the sides of the project image.
- Place previous and next buttons in a dedicated control row below the card so they cannot overlap the image, social actions, or project text.
- Keep swipe navigation, dots, project information, social actions, RTL behavior, keyboard behavior, and analytics events.
- Size the card from its available container width rather than reserving horizontal space for overlay arrows.

## Verification

- Check navigation labels, order, anchors, English, and Arabic.
- Check the project card and controls at 320, 390, and 768 CSS pixels.
- Check swipe, both arrows, dots, RTL direction, and keyboard navigation.
- Confirm no page-level horizontal overflow.
- Confirm the desktop 3D carousel is unchanged.
