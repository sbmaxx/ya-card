# Improvement cycle: contact interaction

The root agent selects the changes. A lower-cost implementation agent writes the
code. A separate judge independently verifies requirements and can reject the
result. Only a passing artifact may be deployed by the root agent.

## Evidence and purpose

Current `app.js` removes every card link from the Tab sequence, including email
and telephone. `setLanguage` repeats that even after the HTML fallback is shown.
The canvas wheel handler also cancels scrolling when WebGL is unavailable.
Contacts should remain usable with keyboard, pointer and a failed GPU renderer.
The card should not move away while the user is trying to read or activate a link.

## Required outcomes

1. Keyboard contact access in WebGL mode
   - Tab/Shift+Tab reach the real anchors on the active language face only.
   - Focus has a clearly visible cue attached to the corresponding link on the
     rendered card, including company logo, telephone, email, site, t.me and GitHub.
   - Preserve real anchor hrefs and native Enter activation. Do not simulate
     keyboard activation with synthetic mouse coordinates or add overlay controls.
   - Focused link remains stationary/readable: pause card idle/hover motion while
     its native anchor is focused; moving light/background can continue.
   - Language change moves focus safely out of the outgoing hidden face; the
     inactive face must not contain tabbable descendants.
2. Stable pointer interaction on card links
   - Hovering an on-card link temporarily holds the card pose (not the light).
   - Link is underlined as before; leaving it resumes motion smoothly.
   - Drag, pinch, card flip, click-background reset, language selection and reduced
     motion keep their established behaviour. Touch does not get hover locking.
3. Robust plain-HTML fallback
   - When WebGL fails or its context is lost, visible contacts remain native and
     keyboard-accessible after RU/EN switching and browser Back/Forward.
   - Scroll/wheel/touch on HTML must not be captured or cancelled by canvas logic.
   - Language selection has a visible, coherent result in fallback. Keep both
     static language sections useful without JavaScript.
   - Successful context restoration restores WebGL interactions and focus state
     without duplicate listeners, stuck gesture capture or invisible focused links.

## Invariants

Work only in `webgl/`; old root project and existing user changes are untouched.
Keep silver/Onest/engraving, content, sizing, lighting and background appearance.
No new permanent controls or prompts, no runtime dependencies or external requests.
One production HTML with gzip/Brotli, both official favicons and font license.
No production access/deploy by implementation or judge agents.

## Verification gate

- Meaningful browser tests for actual Tab/Shift+Tab and native link activation
  (intercept navigation; never send email or messages), active/inactive language
  tab order, visible GPU focus cue and stable model matrix during focus/hover.
- No-GPU and context-loss scenarios, RU/EN, history, uncancelled wheel and native
  fallback links. A check of presence alone is insufficient.
- Existing `test/browser.mjs` and `test/engraving.mjs` pass, or outdated tests are
  adapted with a concrete explanation without removing behavioural coverage.
- Test the built artifact and inspect desktop/mobile screenshots. Verify no
  external resource requests and no JS/WebGL errors.
- Judge writes an independent PASS/FAIL report against every numbered outcome;
  use fresh commands and negative cases, not the implementer's report as proof.
