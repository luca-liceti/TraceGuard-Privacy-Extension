# TraceGuard UI/UX Guidelines

## Overview
These guidelines establish strict rules for maintaining a consistent, premium, and unified theme across the TraceGuard Privacy Extension. All future development **must** adhere to these standards.

## 1. Zero Hardcoded Values
*   **Colors**: Never use hardcoded hex values (e.g., `#1e293b`), rgb/rgba, or arbitrary Tailwind colors (e.g., `text-blue-500`) outside of `tailwind.config.js`. 
    *   **Always** use the standard semantic theme variables: `var(--primary)`, `var(--secondary)`, `var(--muted)`, `var(--destructive)`, etc.
    *   **Always** use semantic Tailwind classes: `text-primary`, `bg-card`, `fill-muted-foreground`.
*   **Typography**: Never use inline `fontSize` or `fontWeight`. Use standard Tailwind classes (`text-sm`, `text-xs`, `font-medium`, `font-bold`).
*   **Animations/Transitions**: Never use arbitrary durations or inline transition CSS (e.g., `duration-[350ms]`, `style={{ transition: '0.3s' }}`).
    *   **Always** use standard Tailwind classes (e.g., `duration-200`, `duration-500`, `transition-all`) or define complex animations in the `tailwind.config.js` `keyframes`.

## 2. Spacing, Sizing, and Layout Consistency
*   **Outer Page Padding**: Handled exclusively by the main `<Layout>` wrapper (`p-4 md:p-6`). Do **not** add `px-` or `py-` padding to the outermost wrappers of page components.
*   **Card/Tile Padding**: Use `p-6` for large, primary layout cards to provide breathing room. Use `p-4` for denser data tiles.
*   **Component Heights**: Standardize on Shadcn's default height of `h-9` for all buttons and inputs.
*   **Gaps**: Use `gap-4` for spacing between related elements in a grid or flexbox. Use `gap-6` for major structural sections on a page.
*   **Arbitrary Spacing**: Avoid arbitrary sizing (e.g., `h-[300px]`). Map to the closest standard Tailwind utility (e.g., `h-72`). Only use arbitrary sizes when absolutely required by a third-party library or highly specific SVG canvas constraints.

## 3. Data Visualizations & Actionable Data
As per project rules: **Actionable Data over Vanity Metrics**. 
*   Always ensure data visualizations provide genuine value for assessing privacy risks.
*   Avoid adding charts that only show aggregate numbers without context (e.g., "Total Trackers Blocked" should be accompanied by trends, risk breakdowns, or specific actionable sites).
*   When using charting libraries (like Recharts), use `className="fill-primary"` where possible. If `style` props are strictly required for dynamic, mathematical coloring (e.g., `opacity: 1 - index * 0.1`), they are permitted.

## 4. Shadcn Adherence
*   When adding or replacing a UI section, it **must** be grabbed from an existing, popular Shadcn template.
*   Do not invent custom UI patterns for tabs, accordions, sidebars, or modals. Use the primitive provided by the design system to ensure accessibility (keyboard nav, ARIA) and contrast compliance (WCAG AA).
