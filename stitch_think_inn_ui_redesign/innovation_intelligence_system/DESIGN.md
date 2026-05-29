---
name: Innovation Intelligence System
colors:
  surface: '#f9f9ff'
  surface-dim: '#ccdafc'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e8eeff'
  surface-container-high: '#e0e8ff'
  surface-container-highest: '#d7e2ff'
  on-surface: '#0c1b34'
  on-surface-variant: '#424655'
  inverse-surface: '#22304a'
  inverse-on-surface: '#ecf0ff'
  outline: '#737687'
  outline-variant: '#c2c6d8'
  surface-tint: '#0054d7'
  primary: '#004cc5'
  on-primary: '#ffffff'
  primary-container: '#1463f3'
  on-primary-container: '#f0f1ff'
  inverse-primary: '#b3c5ff'
  secondary: '#4e5e81'
  on-secondary: '#ffffff'
  secondary-container: '#c6d7ff'
  on-secondary-container: '#4c5d80'
  tertiary: '#005f6e'
  on-tertiary: '#ffffff'
  tertiary-container: '#00798d'
  on-tertiary-container: '#dbf7ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b3c5ff'
  on-primary-fixed: '#00184a'
  on-primary-fixed-variant: '#003fa5'
  secondary-fixed: '#d7e2ff'
  secondary-fixed-dim: '#b5c7ee'
  on-secondary-fixed: '#071b3a'
  on-secondary-fixed-variant: '#364768'
  tertiary-fixed: '#aaedff'
  tertiary-fixed-dim: '#39d8f7'
  on-tertiary-fixed: '#001f26'
  on-tertiary-fixed-variant: '#004e5c'
  background: '#f9f9ff'
  on-background: '#0c1b34'
  surface-variant: '#d7e2ff'
typography:
  display-lg:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Montserrat
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Montserrat
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

This design system establishes a visual language for a high-performance corporate innovation ecosystem. The brand personality is rooted in **Intelligent Systematics**, balancing the rigor of corporate structure with the fluid, participatory nature of modern AI. 

The visual style is **Modern Corporate with a Dynamic Edge**. It utilizes a clean SaaS aesthetic characterized by spacious layouts, card-based organization, and a "Chat-first" interaction model. To differentiate from standard enterprise tools, the system incorporates "Connectivity Nodes"—subtle hexagonal patterns and network-inspired lines—that represent the ecosystem's collaborative power. The emotional response should be one of reliability and productivity, flavored with the visionary excitement of AI-driven discovery.

## Colors

The palette is anchored by **Primary Blue (#1463F3)** and **Deep Navy (#071B3A)** to establish authority and trust. Innovation and AI interactivity are signaled through a "Vibrancy Gradient" composed of **Cyan (#18C9E8)** and **Violet (#7A5CFF)**.

- **Primary & Secondary:** Use for core branding, primary actions, and navigational anchors.
- **Accents:** Use Cyan and Violet primarily for AI-driven insights, progress indicators, and active states.
- **Neutrals:** Slate Text (#33415C) ensures high legibility against the Soft Background (#F8FAFF).
- **Gradients:** Use a linear 135-degree gradient (Cyan -> Blue -> Violet) for high-impact elements like primary buttons or AI status headers to suggest movement and evolution.

## Typography

The typography strategy pairs geometric strength with humanist readability. **Montserrat** is utilized for headlines to provide a bold, architectural feel that mirrors the logo's structural integrity. **Manrope** is the workhorse for UI and body text, chosen for its modern proportions and excellent legibility in data-dense corporate environments.

For labels and category chips, use `label-md` in all-caps with increased letter spacing to differentiate metadata from conversational content. In chat interfaces, prioritize `body-md` for user messages and `body-lg` for AI-generated insights to provide a subtle visual hierarchy of "intelligence."

## Layout & Spacing

The layout utilizes a **12-column fluid grid** for dashboard views, transitioning to a **centered fixed-width container (800px-1000px)** for the chat-first innovation workspace.

- **Spacing Rhythm:** An 8px base unit drives all dimensions.
- **Chat Interface:** Use a "Safe Bubble" model where message containers have 16px internal padding and 24px vertical separation.
- **Desktop:** 40px outer margins with 24px gutters.
- **Mobile:** 16px outer margins. Content should stack vertically, with cards expanding to full width.
- **Network Layouts:** When displaying connection nodes or hexagons, use a hexagonal grid coordinate system to maintain mathematical symmetry.

## Elevation & Depth

This design system uses **Tonal Layering** combined with **Ambient Shadows** to create a structured sense of depth.

- **Surface 0 (Background):** Soft Background (#F8FAFF) - the base canvas.
- **Surface 1 (Cards/Chat Bubbles):** Pure White (#FFFFFF) with a 1px border in a lightened Slate (#E2E8F0) and a very soft, diffused shadow (0px 4px 20px rgba(7, 27, 58, 0.05)).
- **Surface 2 (Popovers/Modals):** Pure White (#FFFFFF) with a more pronounced shadow (0px 12px 32px rgba(7, 27, 58, 0.12)) to suggest immediate focus.
- **AI Elements:** Elements specifically driven by AI (like score indicators) may use a subtle backdrop blur (8px) when overlaid on connection networks to maintain a "Glassmorphic" hi-tech feel.

## Shapes

The shape language is defined by "Approachable Precision." High corner radii convey friendliness and modernity, while the inclusion of hexagonal nodes provides a systematic, geometric counterpoint.

- **Standard Cards:** 16px to 24px border radius (`rounded-lg` or `rounded-xl`).
- **Buttons & Inputs:** 8px radius (`rounded-md`) to maintain a professional, sturdy feel.
- **Innovation Nodes:** Distinct 6-sided hexagonal shapes used for data points, AI scores, and avatars.
- **Chips:** Fully rounded (pill-shaped) for category tags and status indicators.

## Components

### Buttons
- **Primary:** Gradient fill (Cyan to Violet), white text, bold weight.
- **Secondary:** Deep Navy outline, 1px stroke, Slate text.
- **Ghost:** No background, Primary Blue text, for low-priority actions.

### Cards
- White background, 24px padding, 16px radius.
- Must include a subtle 1px border.
- AI Score Indicator: A small hexagon in the top-right corner containing a numerical value, color-coded by the vibrancy gradient.

### Chat Interface
- **User Messages:** Slate background, white text, 16px radius, aligned right.
- **AI Messages:** White background, Navy text, 16px radius, aligned left, featuring a subtle Cyan left-border accent.

### Category Chips
- Small, pill-shaped elements.
- Light tint of the category color with high-contrast text (e.g., Light Cyan background with Deep Navy text).

### Connection Networks
- Visual connectors (lines) should be 1px wide, using a gradient or a light slate color, connecting hexagonal nodes to represent the "Ecosystem" flow.