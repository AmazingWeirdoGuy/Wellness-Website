# Wellness Diary typography review

Reviewed September 26, 2026. The goal is a warm, polished journal using one family, two weights, and a fixed size scale.

## Commercial references

These are observations of the brands' current websites and, for Headspace, its official brand guide. Font names for the other sites were checked in rendered browser styles. The design conclusions are our assessment, not evidence of conversion performance.

| Reference | Observed typography | What fits Wellness Diary |
| --- | --- | --- |
| [Intelligent Change](https://www.intelligentchange.com/) | Canela Light in the hero; Euclid Medium in navigation. | Refined serif headlines make physical journals feel thoughtful and tactile. This is the closest reference. |
| [Papier](https://www.papier.com/) | Self Modern in the hero; SuisseIntl in the interface. | Regular serif headlines and restrained hierarchy give stationery an editorial character. |
| [Headspace](https://live.standards.site/headspace/typography) | Custom Headspace Aperçu, developed with Colophon Foundry. | Friendly letterforms make a wellbeing product approachable. Its bolder app identity is less suited to this quiet book. |
| [Rosebud](https://www.rosebud.app/) | Outfit in prominent headings; Circular in some body copy. | Clear, rounded typography feels inviting, but the overall direction is more energetic and app-like. |

The stationery references use multiple families. We borrow their restraint and book-like feel while honoring the one-family rule.

## Candidate comparison

Compared all three in the browser using the same paper background, body passage, cover title, navigation, button, prompt, caption, and founder name at weights 400 and 600.

- **[Lora](https://www.cyreal.org/fonts/lora/): selected.** Calligraphic curves and moderate contrast retain warmth at headline sizes; body copy and small controls remain clear. Cyreal describes it as a text face optimized for screens. It best balances an actual journal's character with an interface's practical needs.
- **[Literata](https://www.type-together.com/resources/_pdfs/DS_Literata_TT.pdf):** designed for digital reading and an excellent text candidate. In our comparison it appeared denser and more formal than the desired mood.
- **[Fraunces](https://fraunces.undercase.xyz/):** expressive and friendly, with adjustable optical size and softness. Its more eccentric display personality felt too prominent across the entire interface.

## Implementation contract

- Lora is the only primary family across the cover, journal, games, About, and Contact. Georgia is a loading/unsupported-character fallback.
- Exactly two weights: regular **400** for headings and reading/writing; semibold **600** for controls, labels, and emphasis.
- Selected intimate lines (the About mantra, Ronnie's signature, and kind-word notes) use Lora's readable regular italic. This adds a personal note while keeping the family and weight rule intact.
- The complete interface size scale is **13, 14, 16, 20, 24, 32, 48, 72px**, expressed in rem. The home cover title uses an intentional 80px display exception (56px on mobile) so the opening spread has enough presence.
- Sizes, line heights, tracking, and semantic font roles live in `public/typography.css`. Components use these tokens rather than individual font values.
- One unmodified Latin variable WOFF2 serves both permitted weights. It is about **38 kB**, locally hosted and preloaded, with no external font service dependency.
- The [SIL Open Font License](https://github.com/cyrealtype/Lora-Cyrillic/blob/master/OFL.txt) allows commercial use; a copy ships beside the font. No font purchase or subscription is needed.
- Page-turn textures embed the same family and weights so text keeps its appearance during the animation.
