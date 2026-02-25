---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - public/vite.svg
  - index.html
autonomous: true
requirements: [QUICK-FAVICON]
must_haves:
  truths:
    - "Browser tab shows a PodForge-themed icon, not the Vite logo"
    - "Favicon visually matches the app's MTG-inspired dark purple and amber/gold palette"
  artifacts:
    - path: "public/favicon.svg"
      provides: "PodForge-branded SVG favicon"
      contains: "svg"
    - path: "index.html"
      provides: "Updated favicon link pointing to favicon.svg"
      contains: "favicon.svg"
  key_links:
    - from: "index.html"
      to: "public/favicon.svg"
      via: "link rel=icon href"
      pattern: 'rel="icon".*favicon\.svg'
---

<objective>
Replace the default Vite favicon with a custom PodForge-themed SVG favicon.

Purpose: The browser tab currently shows the generic Vite logo. PodForge is a Magic: The Gathering pod generation app for Commander events, and the favicon should reflect that identity using the app's MTG-inspired color palette (deep purple background with amber/gold accent).

Output: A new `public/favicon.svg` and updated `index.html` reference.
</objective>

<execution_context>
@/Users/jacobstoragepug/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jacobstoragepug/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@index.html
@src/app.css (lines 1-40 for color palette reference)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create PodForge SVG favicon and update index.html</name>
  <files>public/favicon.svg, public/vite.svg, index.html</files>
  <action>
1. Create `public/favicon.svg` — a hand-crafted SVG favicon representing PodForge's pod/group concept for MTG Commander. Design a shield or hexagonal shape (evoking a "pod" or gathering) with an inner motif suggesting cards or players. Use the app's exact color palette:
   - Background/shape fill: deep purple `#1a1128` or `#0f0a1a`
   - Accent/detail stroke or fill: amber/gold `#f59e0b` or `#fbbf24`
   - Optional highlight: violet `#7c3aed`
   - The SVG should be square (viewBox="0 0 32 32" or "0 0 64 64"), simple enough to render clearly at 16x16 and 32x32 sizes.

   Suggested design approach: A rounded square or shield shape with deep purple fill, containing a simplified "pod" symbol — four small circles arranged in a diamond or square pattern (representing 4 players in a Commander pod), with amber/gold stroke. Keep it minimal and clean for small-size legibility.

2. Update `index.html` line 5: Change `<link rel="icon" type="image/svg+xml" href="/vite.svg" />` to `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`.

3. Delete or rename `public/vite.svg` — it is no longer needed. Remove the file so it does not ship in the build.
  </action>
  <verify>
    <automated>ls -la /Users/jacobstoragepug/Desktop/PodForge/public/favicon.svg && grep 'favicon.svg' /Users/jacobstoragepug/Desktop/PodForge/index.html && ! test -f /Users/jacobstoragepug/Desktop/PodForge/public/vite.svg && echo "PASS"</automated>
    <manual>Open the app in a browser and confirm the tab icon shows the new PodForge-themed favicon instead of the Vite logo.</manual>
  </verify>
  <done>public/favicon.svg exists with PodForge-themed SVG using the app's purple/amber palette. index.html references favicon.svg. Old vite.svg is removed.</done>
</task>

</tasks>

<verification>
- `public/favicon.svg` exists and contains valid SVG markup with PodForge colors (#1a1128 or #0f0a1a and #f59e0b or #fbbf24)
- `index.html` references `/favicon.svg` (not `/vite.svg`)
- `public/vite.svg` no longer exists
- `npm run build` completes without errors (favicon is correctly resolved)
</verification>

<success_criteria>
- Browser tab displays a PodForge-themed icon matching the app's MTG-inspired dark purple and amber/gold color scheme
- No trace of the default Vite favicon remains in the project
- Build succeeds with the new favicon
</success_criteria>

<output>
After completion, create `.planning/quick/1-update-favicon-to-match-app-theme/1-SUMMARY.md`
</output>
