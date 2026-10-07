# Mobile UX review

Reviewed September 27, 2026. This is a responsive browser review, not a claim about conversion rates or an audit on physical phones.

## References

Revisited three of the brands from the typography review at a 390 × 844 viewport:

- [Intelligent Change](https://www.intelligentchange.com/): the desktop navigation collapses into a compact header; the main action spans most of the screen and the hero becomes a single column.
- [Papier](https://www.papier.com/): compact navigation, generous button areas, and two-column category cards preserve the stationery identity at phone width. Its cookie dialog also illustrates why overlays need clear, reachable actions.
- [Headspace](https://www.headspace.com/): a small header keeps the primary action prominent; rounded content panels stack vertically and separate different tasks.

The useful shared pattern is a simpler navigation hierarchy and a natural vertical reading flow. Wellness Diary keeps its own paper, burgundy, Lora typography, and book artwork.

## Guidance applied

- [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): support a 320 CSS pixel layout without forcing two-direction scrolling. Phone journal sheets now grow with their content instead of nesting scrollable areas inside a scrolling document.
- [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): the AA minimum is 24 × 24 CSS pixels, with specified exceptions. This site aims for at least 44px high primary controls, with larger game keys and separated links; this is a design target, not a claim of full WCAG conformance.
- [web.dev interaction guidance](https://web.dev/learn/design/interaction): retain keyboard interaction and visible focus alongside touch; avoid depending on hover or suppressing browser zoom.

## Changes

- A single-row, sticky phone header with a labeled Pages disclosure, direct section choices, About, Contact, and Support. Escape, outside clicks, selection, and leaving the navigation close it.
- Previous/Next actions before the paper, rather than below two tall sheets. Desktop keeps its two-page book and existing turn animation; phone navigation uses a brief paper slide without expensive full-page image capture.
- A shorter cover with natural height and a centered book. No forced 980px minimum on phones.
- Flowing journal sheets, readable 16px entry text, and a nearby writing-prompt disclosure. Existing entries survive navigation and prompt changes.
- The game launcher remains 3 × 3; descriptions appear inside each activity instead of crowding the phone launcher. Opening or leaving an activity returns its heading to view. Touch controls are larger.
- Modal focus stays inside the dialog, background scrolling is locked, Escape dismisses, and closing restores focus. Destructive confirmation initially focuses the safe option.
- Safe-area spacing and wrapping for About, Contact, footer, and overlays. Static public pages use the same mobile principles as React views.

## Verification scope

Verified 320, 390, 430, and 768px layouts, 667 × 375 landscape, and a 1280px desktop book. No document horizontal overflow was found on the checked views. Desktop sheets remain 768px tall and side by side.

Verified section navigation, writing retained in memory, prompt changes, Escape dismissal, modal focus cycling and scroll restoration, and game launch/touch actions. A timed Petal Keys touch scored 20 points; a Patchwork Stack touch drop scored 36 in the production preview. The built static About and Contact pages were checked directly at 320px, including the founder portrait and wrapping email link.

Production build and all 22 existing tests passed. The final production preview reported no browser warnings or errors. Viewport checks do not emulate the iOS keyboard or device-specific audio policies; those still benefit from a physical-device check.
