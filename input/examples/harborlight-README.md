# Harborlight original fixtures

The [four-panel comic source bundle](comic/harborlight/README.md) supplies an original script, two adult cast drawings, and review notes. Its preparation helper creates isolated catalogs and registers the supplied campsite art; the [comic walkthrough](../../docs/commands/05-visuals/comic/00-comic-overview.md#walkthrough-harborlight) distinguishes those authored inputs from hosted generations and voice approvals.

These fictional illustrations and prose were created for AutoShow on October 15, 2026 and are provided under the [MIT license](harborlight-LICENSE.txt). They contain no copied source-book text, external photographs, downloaded art, embedded font files, or generated-provider output. The reviewable originals are the adjacent SVG, HTML, and Markdown files. The raster pictures are flat illustrations, not product photographs or evidence of provider output quality.

The shared subject is a teal enamel travel mug with a cream compass-and-mountain badge, used during a stargazing trip by two adult human characters. Papa Bear is a patient human guide with a gray beard and rust-orange coat; the name is a nickname, not an animal identity. Mira wears a teal jacket and round gold glasses. The comic uses episode `02`, scene `01`, slug `harborlight-camp`, and speaker key `papa-bear`.

## Assets

- `tts/harborlight-chapters/`: exactly two original Markdown chapters, `01-first-light.md` and `02-night-watch.md`, for directory writing and TTS estimates. This directory contains no controls fixtures or copied book text. The price examples do not synthesize speech.
- `document/harborlight-article.html`: an original self-contained article with a title, narrative headings, and an internal checklist link. Local Defuddle extraction retains the article body while filtering short boilerplate sections; it requires no page assets or network requests.
- `batch/provider-docs.md`: a two-URL input list for fetching official Spider and Zyte provider pages. The file is portable; fetching its remote pages still requires network access and those pages can change.
- `image/harborlight-mug.png` and `.jpg`: the same opaque 1024 x 1024 product illustration, supplied in both provider-compatible formats.
- `image/harborlight-mug-mask.png`: 1024 x 1024 PNG with alpha. Alpha 0 marks the editable mug body and handle; alpha 255 protects the background, rim, handle hole, badge, and a narrow edge margin. Antialiased boundaries have intermediate alpha. Transparency is the edit instruction; this is not a white-means-edit mask. The badge is deliberately protected so the recolor prompt can preserve it.
- `video/harborlight-start.png` and `harborlight-end.png`: distinct 1080 x 1920 portrait frames of the same campsite at dusk and night. Both interpolation examples must use `9:16`. The images demonstrate a transition rather than consecutive frames from a real recording.
- `video/harborlight-jacket.png` and `harborlight-glasses.png`: distinct 768 x 768 references for Mira's teal jacket and gold glasses. They depict wardrobe objects, not an established face or proof of character identity.
- `comic/harborlight-camp--style-seed.png`: a 1536 x 1024 landscape campsite illustration with no people. Copy it into a separate demonstration characters root before drafting; never overwrite a user's catalogs or seed.
- `document/harborlight-field-notes.md` and `.pdf`: original prose with two chapters, First light and Night watch. The four-page searchable PDF has chapter headings and outline bookmarks on pages 1 and 3. It suits local text extraction, chapter/no-chapter examples, and estimated hosted OCR planning; it does not demonstrate scanned-page OCR accuracy.
- `comic/harborlight-camp-treatment.md` and `.pdf`: the same original 24-beat story, suitable for a `20-25` panel drafting range. The four-page PDF has a real text layer. Hosted drafting remains a separate, priced operation; these inputs do not include a generated script, catalogs, voices, or panels.

The licensed two-speaker MP4, matching stereo WAV, saved transcript, and subtitles have separate [source attribution and reproduction instructions](video/README.md). Their Tears of Steel film excerpt is CC BY 3.0 and is outside the original-content MIT license above. Both audio channels contain the mixed film soundtrack; splitting them does not isolate the characters. The saved subtitle timings are coarse, and word-caption layouts interpolate their boundaries.

## Reproduction

Run from the repository root with Bun, ImageMagick 7 (`magick`), and an installed Chromium, Chrome, or Edge browser:

```sh
bun src/tools/create-harborlight-fixtures.ts
```

If the browser is not on the executable search path or in a standard macOS application location, set `AUTOSHOW_FIXTURE_BROWSER` to its executable. The utility reads the SVG/Markdown originals, renders eight raster images, and writes two PDFs locally. It uses a disposable browser profile, disables background networking, and makes no provider calls or asset/model downloads. Only its own temporary rendering directory is removed. Existing runtime outputs, catalogs, recordings, and purchased audio are untouched.

The same source and renderer versions reproduce the same files. Raster bytes may vary across browser/ImageMagick versions; the SVG and Markdown originals define the content. The PDF writer uses standard PDF fonts and fixed metadata dates, without external dependencies or absolute checkout paths.

## Local validation

Use ImageMagick to decode each raster, verify dimensions, and inspect mask alpha. At pixel `(370,500)` the mask is transparent; `(480,535)` protects the badge, `(20,20)` protects the background, and `(735,515)` protects the handle hole. The editable handle includes `(840,515)`. First/end frame hashes must differ.

Both PDFs should pass `qpdf --check` and local MuPDF text extraction. `mutool show input/examples/document/harborlight-field-notes.pdf outline` should show chapter starts on pages 1 and 3. Use explicit `--chapters --pdf-chapter-mode local` because automatic PDF chapter export starts at 40 pages. AutoShow's local PDF chapter builder should produce two nonempty chapter files; `--no-chapters` should keep a single extraction. Successful parsing, local decoding, or price planning does not establish hosted edit quality, motion quality, OCR accuracy, or comic drafting quality.
