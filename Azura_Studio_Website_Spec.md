# Azura Studio Website — Starter Specification

## 1. Purpose
Build a premium, minimal website for **Azura Studio**. The website is primarily a credibility and brand destination, while Instagram and Facebook remain important portfolio/social channels.

The agent will receive the **Azura logo** separately and must derive the website design system from it: colours, typography direction, visual language, spacing, shapes, and overall premium identity.

The first delivery is a polished working **HTML website mockup/starter**. No additional assets will be supplied, so generate tasteful placeholder/mockup imagery and content where required.

## 2. Overall Experience
- Premium, minimal, architectural/interior-design aesthetic.
- Strong Azura blue identity inspired by a **blue diamond**, without overusing it.
- Subtle moving background inspired by blue stars / diamond-like particles.
- Motion must remain elegant and restrained rather than distracting.
- Responsive desktop/mobile design.
- **English + Arabic**, including correct RTL behaviour for Arabic.
- **Dark Mode + Light Mode**.
- Smooth page loading and transitions.
- Hero fades in on first load.
- Remaining sections use subtle **scroll-to-reveal** animation.

## 3. Navigation
Keep the navbar clean and minimal.

Include:
- Azura logo / wordmark
- Main navigation
- Language switcher: EN / AR
- Light/Dark mode control
- **Contact Us** CTA

`Contact Us` must smoothly scroll to the final Contact / RFQ section rather than opening a separate page.

## 4. Hero Section
The hero is the main visual statement.

### Hero visual
Create a short seamless looping architectural animation.

It should show the **same architectural scene transitioning between a 2D sketch and a photorealistic render** using a **split-screen wipe transition**.

- A refined Azura-blue divider/wipe line travels across the scene.
- One side of the moving line remains the 2D architectural sketch.
- The revealed side becomes the finished realistic visualisation.
- The camera itself should make a slow cinematic pan/movement rather than remain at one fixed angle.
- Maintain spatial continuity during the transformation.
- Keep the animation subtle enough that hero text remains readable.
- The loop should restart seamlessly.

Use generated/mock imagery for this first prototype.

### Hero copy
Use a very short, memorable English hook — **maximum four words**. Treat the exact slogan as placeholder copy that can be refined later.

Add a restrained supporting line only if it improves the composition.

## 5. Blue Diamond Signature
The blue diamond is a recurring **Azura signature**, not decoration to scatter everywhere.

Potential uses:
- elegant initial loader/spinner;
- tiny transition motif;
- subtle section separator;
- restrained micro-interaction.

Do not overuse it.

## 6. Selected Projects
The website is **not intended to duplicate the complete social-media portfolio**.

Create **8 selected project cards** using generated architectural/interior mockup images.

### Layout
- Use an editorial/asymmetric grid rather than eight identical boxes.
- Mix larger feature images with smaller cards where appropriate.
- Keep generous whitespace.
- No carousel for the primary project presentation.
- Reveal cards smoothly while scrolling.
- Each card should contain only essential information such as project name/category.
- Cards may provide an **Explore** action that can later link to the relevant Instagram/Facebook project or destination.

The website should tease the strongest work and then direct visitors towards Azura's active platforms for deeper exploration.

## 7. Contact / Request for Quotation
The final major section is the destination of the navbar `Contact Us` CTA.

### RFQ form
Heading: **Request for Quotation**

Fields:
- Name
- Email
- Phone Number
- **I am a:** selector
  - Property Owner
  - Real Estate Developer
  - Contracting Company
- **Inquiry / Project Brief** — free-text area
- Submit button

Keep the form short and premium; do not add unnecessary fields.

### Social/contact platforms
Below the form, show Azura's platform/contact icons horizontally:
- Instagram
- Facebook
- WhatsApp Chat

Use placeholders for URLs/contact details until real links are provided.

## 8. Technical Architecture

### Hosting model
The main website should remain a **client-side dynamic website hosted on GitHub Pages** and connected to the custom Azura domain.

The browser may contain:
- HTML
- CSS
- JavaScript
- UI state
- animations/interactions
- public configuration that is genuinely safe to expose

Assume all frontend code delivered to the browser can be inspected by visitors.

### Secure server-side layer
Use a **Cloudflare Worker** as the small secure backend/API layer.

Frontend flow:

`Browser -> Cloudflare Worker endpoint -> Google Sheets / required service`

Rules:
- The frontend may know the public Worker endpoint.
- **Never place private API keys, Google credentials, service-account credentials, or other secrets in frontend code.**
- Store secrets in the Worker's environment/secrets.
- Validate and sanitise RFQ and analytics payloads in the Worker.
- Restrict accepted methods/origins where practical.
- Add basic anti-spam/rate-limiting protection to public write endpoints.
- Do not expose the Google Sheet directly to the browser.

### Google Sheets
Use Google Sheets as the initial lightweight data destination instead of Supabase.

At minimum, organise:
1. **RFQ / Contact Requests**
2. **Analytics Events / Sessions**

The architecture should make it easy to replace Sheets with a proper database later without rewriting the entire frontend.

## 9. Session & Event Analytics
Implement first-party session/event tracking through the Cloudflare Worker into Google Sheets.

Track useful product/portfolio behaviour such as:
- anonymous session ID;
- session start;
- session end or best-effort duration;
- page/section views;
- selected project viewed;
- project/card clicks;
- Explore/social-link clicks;
- Contact Us clicks;
- RFQ form started;
- RFQ submitted;
- language selection;
- theme selection;
- useful timestamps and page/referrer context.

The goal is to answer questions such as:
- How long do visitors engage with the website?
- Which projects attract the most attention?
- Which sections are actually viewed?
- Which links/CTAs are clicked?
- How many visitors begin or submit an RFQ?

### Privacy / data minimisation
Do **not** attempt invasive surveillance or collect unnecessary sensitive information. Do not record keystrokes or form-field contents as analytics events. RFQ data belongs only in the RFQ submission itself. Prefer anonymous/pseudonymous session identifiers and collect only analytics needed for business decisions. Provide a structure that can accommodate consent/privacy requirements where applicable.

## 10. Prototype Requirements for the Agent
For the initial build:
- Do not wait for image assets other than the logo.
- Generate tasteful placeholder/mock architectural images.
- Generate the hero sketch-to-render mock visual.
- Produce a complete visual starter rather than empty grey placeholder boxes.
- Keep components modular and code clean.
- Prioritise premium visual quality, responsiveness, performance, and restrained motion.
- Respect `prefers-reduced-motion` where possible.
- Optimise hero/media loading so the animated experience does not make the site feel slow.
- Use semantic HTML and accessible controls.

## 11. Design Principle
**Azura should feel expensive because it is controlled, not because it is busy.**

The blue diamond, moving background, hero wipe, and scroll reveals are signature details. They should support the architectural work rather than compete with it.
