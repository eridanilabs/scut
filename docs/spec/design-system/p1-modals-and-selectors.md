# Design Spec: P1 Modals and Selectors

**Scope**: `p1-modals-and-selectors`
**Status**: COMPLETE
**Date**: 2026-05-14
**Components**:
- Create Thread Modal (P1-31)
- Bob/Replicant Assignment Selector (P1-34)
- Thread Status Selector (P1-35)
- Login Screen

**Source of truth**: All values inferred from `packages/ui/src/index.css`, `packages/ui/src/components/ui/`, and live dev server screenshots at `http://localhost:5173`. Values marked `(inferred from codebase)` were read directly from source. Values marked `(standard default)` follow Tailwind v4 defaults where no explicit override exists.

---

## 1. Spacing Scale

The project uses Tailwind v4 with a 4px base grid. No custom spacing overrides found in the codebase.

| Token | Value | Tailwind class |
|-------|-------|----------------|
| space-0.5 | 2px | `gap-0.5`, `p-0.5` |
| space-1 | 4px | `gap-1`, `p-1` |
| space-1.5 | 6px | `gap-1.5` |
| space-2 | 8px | `gap-2`, `p-2` |
| space-2.5 | 10px | `px-2.5`, `py-2.5` |
| space-3 | 12px | `gap-3`, `p-3` |
| space-4 | 16px | `gap-4`, `p-4` |
| space-6 | 24px | `px-6`, `py-6` |
| space-8 | 32px | (rarely used at component level) |

**Common application patterns** (inferred from codebase):
- Label-to-input gap: 6px (`gap-1.5`)
- Form field stack gap: 16px (`gap-4`)
- Dialog padding: 16px (`p-4`)
- Board column padding: 12px (`p-3`)
- Sidebar/panel padding: 16px (`p-4`)

---

## 2. Typography

| Role | Font | Size | Weight | Line height | Notes |
|------|------|------|--------|-------------|-------|
| Base | Geist Variable | 14px (`text-sm`) | 400 | 1.5 | Body text in components |
| Small / label | Geist Variable | 12px (`text-xs`) | 500 | 1.5 | `text-muted-foreground` |
| Dialog title | Geist Variable | 16px (`text-base`) | 500 | 1 (`leading-none`) | `font-medium` |
| Card title | Geist Variable | 14px (`text-sm`) | 600 | 20px (`leading-5`) | `font-semibold` |
| Page heading | Geist Variable | 18px (`text-lg`) | 600 | snug | `font-semibold` |
| Timestamp / meta | Geist Variable | 12px (`text-xs`) | 400 | 1.5 | `text-muted-foreground` |

- `--font-sans`: `'Geist Variable', sans-serif` (inferred from codebase)
- `--font-heading`: same as `--font-sans` (inferred from codebase)
- Font loaded via `@fontsource-variable/geist`

---

## 3. Color Roles

All colors defined in `src/index.css` as OKLCH values. Both light and dark modes are specified.

### Semantic tokens

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--background` | oklch(1 0 0) = white | oklch(0.145 0 0) = near-black | Page background |
| `--foreground` | oklch(0.145 0 0) = near-black | oklch(0.985 0 0) = near-white | Default text |
| `--card` | white | oklch(0.205 0 0) = dark gray | Card/panel surfaces |
| `--popover` | white | oklch(0.205 0 0) = dark gray | Dropdown panels, dialog bg |
| `--primary` | oklch(0.205 0 0) = near-black | oklch(0.922 0 0) = light gray | Primary button bg |
| `--primary-foreground` | oklch(0.985 0 0) = near-white | oklch(0.205 0 0) | Text on primary |
| `--secondary` | oklch(0.97 0 0) = very light gray | oklch(0.269 0 0) | Secondary button bg |
| `--muted` | oklch(0.97 0 0) | oklch(0.269 0 0) | Muted backgrounds |
| `--muted-foreground` | oklch(0.556 0 0) = medium gray | oklch(0.708 0 0) | Labels, placeholders |
| `--accent` | oklch(0.97 0 0) | oklch(0.269 0 0) | Hover/focus states |
| `--accent-foreground` | oklch(0.205 0 0) | oklch(0.985 0 0) | Text on accent |
| `--destructive` | oklch(0.577 0.245 27.325) = red | oklch(0.704 0.191 22.216) | Error/danger |
| `--border` | oklch(0.922 0 0) = light gray | oklch(1 0 0 / 10%) = white 10% | Borders |
| `--input` | oklch(0.922 0 0) | oklch(1 0 0 / 15%) | Input borders |
| `--ring` | oklch(0.708 0 0) = medium-light gray | oklch(0.556 0 0) | Focus ring |
| `--sidebar` | oklch(0.985 0 0) = near-white | oklch(0.205 0 0) | Sidebar bg |

### Thread status colors (for selector display)

| Status | Badge style |
|--------|-------------|
| idea | border-dashed, text-muted-foreground, no fill |
| refining | bg-secondary text-secondary-foreground |
| ready | bg-emerald-600 text-white |
| in_progress | bg-sky-600 text-white |
| blocked | bg-rose-100 text-rose-800 (dark: bg-rose-500/20 text-rose-200) |
| done | border-emerald-300 text-emerald-700 (dark: border-emerald-500/40 text-emerald-300) |
| archived | text-muted-foreground, no fill |

### Bob status indicator colors

| Status | Color |
|--------|-------|
| online | bg-green-500 |
| offline | bg-red-500 |
| busy | bg-yellow-500 |
| unknown | bg-muted-foreground |

---

## 4. Components (Standard Table)

### Button

| Variant | Size | Height | Padding | Radius | Notes |
|---------|------|--------|---------|--------|-------|
| default | default | 32px (h-8) | px-2.5 | rounded-lg (10px) | Primary CTA |
| default | sm | 28px (h-7) | px-2.5 | ~8px (radius-md) | Compact CTA |
| default | lg | 36px (h-9) | px-2.5 | rounded-lg (10px) | Large CTA |
| outline | default | 32px | px-2.5 | rounded-lg | Secondary action |
| ghost | default | 32px | px-2.5 | rounded-lg | Tertiary / icon area |
| destructive | default | 32px | px-2.5 | rounded-lg | Danger action |
| icon | - | 32x32px (size-8) | none | rounded-lg | Icon-only |
| icon-sm | - | 28x28px (size-7) | none | ~8px | Close button in dialog |

Focus: `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`

### Input

| Property | Value |
|----------|-------|
| Height | 32px (h-8) |
| Padding | px-2.5 py-1 |
| Border | 1px solid `--input` |
| Radius | rounded-lg (10px) |
| Background | transparent (light) / `bg-input/30` (dark) |
| Placeholder | `text-muted-foreground` |
| Focus ring | `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` |
| Error | `aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20` |
| Disabled | `bg-input/50 opacity-50 pointer-events-none` |
| Font size | 16px mobile / 14px (`md:text-sm`) desktop |

### Border Radius Scale

| Name | Value | Computed | Usage |
|------|-------|----------|-------|
| sm | calc(--radius * 0.6) | ~6px | badges, tight elements |
| md | calc(--radius * 0.8) | ~8px | small buttons |
| lg / base | --radius | 10px | inputs, buttons, cards |
| xl | calc(--radius * 1.4) | ~14px | dialog content (`rounded-xl`) |
| 2xl | calc(--radius * 1.8) | ~18px | large panels |

### Icon sizes

| Context | Size | Class |
|---------|------|-------|
| Default button icon | 16px | `size-4` |
| Small button icon | 14px | `size-3.5` |
| XS button icon | 12px | `size-3` |
| Bob status dot | 8x8px | `h-2 w-2` |
| Chevron in select | 16px | `size-4` |

---

## 5. Modal Dialog

### Overlay

| Property | Value | Source |
|----------|-------|--------|
| Background | `bg-black/10` | inferred from codebase |
| Backdrop blur | `backdrop-blur-xs` (supports-backdrop-filter only) | inferred from codebase |
| Z-index | z-50 | inferred from codebase |
| Animation | fade-in on open, fade-out on close (100ms) | inferred from codebase |

### Dialog Content (default)

| Property | Value | Source |
|----------|-------|--------|
| Position | fixed, centered via transform (-50% / -50%) | inferred from codebase |
| Width | 100% - 2rem max, sm breakpoint: max-w-sm (384px) default | inferred from codebase |
| Width - Create Thread Modal | sm:max-w-md = 448px (override in ThreadForm) | inferred from codebase |
| Background | `bg-popover` (white light / dark-gray dark) | inferred from codebase |
| Radius | `rounded-xl` = ~14px | inferred from codebase |
| Padding | 16px all sides (`p-4`) | inferred from codebase |
| Ring | `ring-1 ring-foreground/10` | inferred from codebase |
| Z-index | z-50 | inferred from codebase |
| Animation | zoom-in-95 + fade-in on open, zoom-out-95 + fade-out on close (100ms) | inferred from codebase |
| Gap between sections | 16px (`gap-4`) | inferred from codebase |

### Dialog Header

| Property | Value |
|----------|-------|
| Layout | flex-col |
| Gap | 8px (`gap-2`) |
| Title font | 16px, font-medium, leading-none |

### Dialog Footer

| Property | Value | Source |
|----------|-------|--------|
| Layout | flex-row at sm breakpoint, flex-col-reverse on mobile | inferred from codebase |
| Justification | `sm:justify-end` (right-aligned) | inferred from codebase |
| Gap | 8px (`gap-2`) | inferred from codebase |
| Background | `bg-muted/50` | inferred from codebase |
| Padding | 16px (`p-4`) | inferred from codebase |
| Top border | 1px solid `--border` | inferred from codebase |
| Radius | `rounded-b-xl` (bottom only) | inferred from codebase |
| Negative margin | `-mx-4 -mb-4` (bleeds to dialog edges) | inferred from codebase |

### Close Button

| Property | Value | Source |
|----------|-------|--------|
| Position | absolute top-2 right-2 = top: 8px, right: 8px | inferred from codebase |
| Size | 28x28px (`size-7` / `icon-sm`) | inferred from codebase |
| Variant | ghost | inferred from codebase |
| Icon | XIcon (lucide-react), 16px | inferred from codebase |

### Create Thread Modal - Specific Fields

| Field | Component | Notes |
|-------|-----------|-------|
| Title | Input (h-8) | required, autoFocus on open |
| Description | Textarea (3 rows) | optional |
| Label-input gap | 6px (gap-1.5) | between label and input |
| Field stack gap | 16px (gap-4) | between Title block and Description block |
| Cancel | Button outline, default size | closes dialog, disabled while submitting |
| Submit | Button default ("Create Thread") | disabled when title empty or submitting |
| Submit loading | Text changes to "Creating..." | no spinner added yet |
| Bob/Replicant selector | NOT present in current Create Thread Modal | P1-34 adds this field |

### P1-31 Create Thread Modal - Final Field Set (with P1-34 integrated)

The Create Thread modal (P1-31) must include the Bob/Replicant selector (P1-34). Final layout:

1. Title input (required)
2. Description textarea (optional, 3 rows)
3. Bob/Replicant selector (optional, "No bob assigned" as default)
4. Footer: Cancel (outline) | Create Thread (default)

---

## 6. Selector / Dropdown

This covers both the Thread Status Selector (P1-35) and Bob/Replicant Assignment Selector (P1-34). Both use the shared `Select` component in `src/components/ui/select.tsx` built on `@base-ui/react/select`.

### Trigger

| Property | Value | Source |
|----------|-------|--------|
| Height | 32px (`h-8`) | inferred from codebase (ThreadDetailPage explicit) |
| Padding | `py-2 pr-2 pl-2.5` | inferred from codebase |
| Border | 1px solid `--input` | inferred from codebase |
| Radius | rounded-lg (10px) | inferred from codebase |
| Background | transparent light / `bg-input/30` dark | inferred from codebase |
| Icon | ChevronDownIcon 16px, text-muted-foreground | inferred from codebase |
| Font size | 14px (`text-sm`) | inferred from codebase |
| Width | `w-fit` (auto-fits content) | inferred from codebase |
| Focus ring | `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` | inferred from codebase |
| Error | `aria-invalid:border-destructive` | inferred from codebase |

### Dropdown Panel (Popup)

| Property | Value | Source |
|----------|-------|--------|
| Width | matches trigger anchor width (`w-(--anchor-width)`) | inferred from codebase |
| Min width | 144px (`min-w-36`) | inferred from codebase |
| Max height | available viewport height (`max-h-(--available-height)`) | inferred from codebase |
| Background | `bg-popover` | inferred from codebase |
| Radius | rounded-lg (10px) | inferred from codebase |
| Shadow | `shadow-md` | inferred from codebase |
| Ring | `ring-1 ring-foreground/10` | inferred from codebase |
| Z-index | z-50 | inferred from codebase |
| Overflow | `overflow-y-auto overflow-x-hidden` | inferred from codebase |
| Animation | slide-in from top (bottom side), fade+zoom on open/close | inferred from codebase |
| Side offset | 4px | inferred from codebase |

### Option Item

| Property | Value | Source |
|----------|-------|--------|
| Height | auto, `py-1` + 14px text = ~28px effective | inferred from codebase |
| Padding | `py-1 pr-8 pl-1.5` | inferred from codebase |
| Font size | 14px (`text-sm`) | inferred from codebase |
| Radius | rounded-md (~8px) | inferred from codebase |
| Hover/focus | `focus:bg-accent focus:text-accent-foreground` | inferred from codebase |
| Disabled | `data-disabled:opacity-50 pointer-events-none` | inferred from codebase |

### Selected State

| Property | Value | Source |
|----------|-------|--------|
| Indicator | CheckIcon (16px) | inferred from codebase |
| Indicator position | absolute right-2 (8px from right) | inferred from codebase |
| Indicator size | 16px (`size-4`) | inferred from codebase |

### Scroll Arrows

Shown when content overflows. Top/bottom arrow buttons with ChevronUp/ChevronDown icons, sticky at panel edges, `bg-popover` background.

### Bob/Replicant Selector - Specific Options

| Option | Display | Notes |
|--------|---------|-------|
| None | "None" | value `__none__`, no indicator |
| Each bob | BobStatusIndicator dot + bob.name | inline flex gap-2 |

The Bob selector is NOT searchable in the current implementation (standard select, no typeahead). If the number of bobs exceeds 10, a searchable combobox should be used. For P1, assume <10 bobs: standard select is acceptable.

### Thread Status Selector - Specific Options

Options in order: Idea, Refining, Ready, In Progress, Blocked, Done, Archived. No status color indicators in the dropdown options (plain text). Status badge shown separately on thread cards.

### Group padding

The select group container has `scroll-my-1 p-1` applied, providing 4px padding around the option list.

---

## 7. Login Screen

The login screen does not exist in the current codebase. It is a new component required for P1. The following values are specified based on the existing design system tokens.

### Layout

| Property | Value | Rationale |
|----------|-------|-----------|
| Page layout | Centered card on background | Standard for auth flows; consistent with card pattern |
| Background | `bg-background` | Standard page background |
| Card width | 360px (max-w-sm) | Matches default dialog max-w-sm for visual consistency |
| Card padding | 24px (`p-6`) | Slightly more than dialog p-4 for breathing room |
| Card background | `bg-card` | Card surface token |
| Card border | `border border-border` | Standard card border |
| Card radius | `rounded-xl` | Matches dialog content radius |
| Card shadow | `shadow-md` | Elevation above background |
| Vertical position | centered (flex min-h-screen items-center justify-center) | Standard auth layout |

### Brand/Logo Area

| Property | Value | Rationale |
|----------|-------|-----------|
| Height | 48px reserved at top of card | Logo or wordmark |
| Logo alignment | centered | Consistent with single-column centered layout |
| App name | "Scut" (text-xl font-semibold) | Below logo/icon if present |
| Gap below brand | 24px (`gap-6`) | Separates brand from form |

### Form Fields

| Property | Value | Source |
|----------|-------|--------|
| Username label + input | standard Label + Input (h-8) | matches codebase Input component |
| Password label + input | standard Label + Input, type=password (h-8) | matches codebase |
| Label font | 14px, font-medium | matches Label component |
| Label-input gap | 6px (`gap-1.5`) | matches form pattern in ThreadForm |
| Field-to-field gap | 16px (`gap-4`) | matches form field stack gap |
| Submit button | Button default, full-width (w-full) | standard for login forms |
| Submit button text | "Sign In" | clear action label |

### Error State

| Property | Value | Rationale |
|----------|-------|-----------|
| Error placement | Top of form, above fields | Visible before user interacts; not buried per-field |
| Error component | `bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm` | Consistent with destructive button bg pattern |
| Error icon | none (keep simple) | Text message is sufficient for login errors |
| Field error | `aria-invalid` on input triggers border-destructive + ring | Uses existing input error pattern |

### Sizing Summary

| Element | Value |
|---------|-------|
| Card max-width | 360px |
| Card padding | 24px |
| Brand area | 48px height |
| Gap brand-to-form | 24px |
| Field stack gap | 16px |
| Label-input gap | 6px |
| Submit button | h-8, w-full |

---

## 8. Interaction Patterns

### Focus Management

| Trigger | Behavior |
|---------|----------|
| Dialog opens | Focus moves to first interactive element (title input in Create Thread) |
| Dialog closes | Focus returns to trigger element |
| Escape key | Closes dialog or dropdown |
| Tab | Cycles through interactive elements within dialog |
| Focus ring | `ring-3 ring-ring/50` visible on all focusable elements |

### Animation Timing

| Transition | Duration | Effect |
|-----------|---------|--------|
| Dialog overlay | 100ms | fade-in / fade-out |
| Dialog content | 100ms | zoom-in-95 + fade / zoom-out-95 + fade |
| Select dropdown | 100ms | slide-in-from-top + fade / zoom-out + fade |
| Button state | default Tailwind transition-colors | ~150ms |
| Hover | transition-colors | immediate perception |

### Loading/Submitting State

| Context | Behavior |
|---------|----------|
| Thread form submit | Submit button disabled + text "Creating..." |
| Bob selector loading | Selector shows "No bob assigned" until bobs are fetched |
| Login submit | Submit button disabled, text "Signing in..." (to be implemented) |

### Validation

| Rule | Implementation |
|------|---------------|
| Required fields | HTML `required` attribute + disabled submit until non-empty |
| Empty title | Submit button remains disabled while `title.trim()` is empty |
| API errors | Toast notification (sonner) for server-side errors |
| Login error | Inline error card at top of form, `aria-invalid` on fields |

---

## 9. Acceptance Criteria

Each criterion is binary: pass or fail. Playwright-verifiable criteria are marked (PW).

### Create Thread Modal (P1-31)

1. (PW) Clicking "New Thread" button opens a dialog with heading "New Thread"
2. (PW) Dialog overlay is visible at bg-black/10 opacity
3. (PW) Dialog max-width is 448px at viewport >= 640px (sm breakpoint)
4. (PW) Title input receives focus automatically when modal opens
5. (PW) Submit button is disabled when title input is empty
6. (PW) Submit button is enabled after typing at least one non-whitespace character in title
7. (PW) Clicking Cancel closes the dialog without creating a thread
8. (PW) Pressing Escape closes the dialog
9. (PW) Close (X) button in top-right corner closes the dialog
10. (PW) After successful submit, dialog closes and toast notification appears
11. (PW) Form fields are Title (text input), Description (textarea, 3 rows), and Bob selector
12. Close button is position absolute, top: 8px, right: 8px, size 28x28px
13. Footer is right-aligned with Cancel before Create Thread (Cancel left of submit)
14. Footer background is bg-muted/50 with top border

### Bob/Replicant Assignment Selector (P1-34)

15. (PW) Selector trigger has height 32px
16. (PW) Selector dropdown opens below trigger with 4px offset
17. (PW) First option is "None" (no bob assigned)
18. (PW) Each bob option shows a colored status dot and the bob name
19. (PW) Currently selected bob shows a CheckIcon (checkmark) at the right of its row
20. (PW) Selecting a bob closes the dropdown and updates the trigger display
21. (PW) Selecting "None" removes bob assignment
22. (PW) Dropdown options show focus highlight on keyboard navigation (bg-accent)
23. Dropdown panel has shadow-md and ring-1 ring-foreground/10
24. Dropdown panel width matches trigger width

### Thread Status Selector (P1-35)

25. (PW) Selector shows all 7 status options: Idea, Refining, Ready, In Progress, Blocked, Done, Archived
26. (PW) Current status is highlighted with CheckIcon
27. (PW) Selecting a status updates the thread (API call fires, trigger label updates)
28. (PW) Selector trigger height is 32px
29. (PW) Selecting same status as current does not fire a duplicate API call

### Login Screen

30. (PW) Login page renders at `/login` (or `/` when unauthenticated)
31. (PW) Login card max-width is 360px
32. (PW) Username and password fields are present with visible labels
33. (PW) Submit button is full-width
34. (PW) Submit button text is "Sign In"
35. (PW) With empty username or password, submit is disabled
36. (PW) On invalid credentials, an error message appears above the fields
37. (PW) Error message uses destructive color role (text-destructive)
38. (PW) Password input type is `password` (content is masked)
39. (PW) On successful login, user is redirected to `/` (projects page)
40. Focus goes to username input on page load

### Cross-Component

41. All interactive elements have visible focus rings (ring-3 ring-ring/50)
42. All interactive elements are keyboard accessible (Tab, Enter, Escape, Arrow keys)
43. Dark mode: all components render correctly with dark color tokens
44. (PW) No horizontal overflow at 375px viewport width (mobile)

---

## 10. Figma Sync Status

Figma sync is not configured for this project. No Figma token is set.

All values in this document are the source of truth for implementation. If a Figma file is created in the future, it must be updated to match these values - not the other way around.

---

## Appendix: Open Questions

1. **Bob selector searchability**: The current implementation uses a standard select (no typeahead). If the number of bobs grows beyond ~10, a combobox with search should replace it. No threshold is specified in P1. Decision: implement as standard select for P1, open a follow-up task if needed.

2. **Login route**: The login screen route (`/login` vs redirect from unauthenticated state) depends on the auth implementation, which is not yet designed. This spec assumes a dedicated `/login` route.

3. **Login - remember me**: Not specified in P1. Omit from login form for now.

4. **Thread form - bob selector default**: The spec says "No bob assigned" as default. Confirm with product whether the most recently used bob should be pre-selected.

5. **Status selector in modal**: P1-34 adds a bob selector to the create thread modal (P1-31). It is unclear whether a status selector should also appear in the create modal (letting users set initial status). Current spec: status selector is only on the thread detail page sidebar. Initial status defaults to `idea`.

