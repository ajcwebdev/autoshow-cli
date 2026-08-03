# OCR Editing Rules

Use these rules to turn raw OCR output into the most accurate, faithful text
representation of the source document for **archiving, reference, and search** — not
for narration. The output is lightly-structured Markdown that mirrors the source.

The guiding question for every edit is: *does this make the file a more accurate
record of what the original document actually says and how it was structured?* If an
edit improves "flow" or "readability" at the cost of fidelity, do not make it.

## Priority Order

1. Preserve the source's exact content and wording.
2. Repair genuine OCR damage so the text matches the original.
3. Represent the original structure faithfully in lightly-structured Markdown.
4. Keep edits minimal and deterministic.

## Safe, High-Value Fixes

Apply these by default. Each one restores the text to what the source actually says.

1. Remove scanning artifacts: speckle, stray marks, isolated single-character "words"
   that are clearly noise, and OCR garbage that corresponds to nothing on the page.
2. De-hyphenate words split across a line break by line-wrap (e.g. `infor-\nmation`
   becomes `information`). Keep hyphens that are part of the real word
   (`well-being`, `re-enter`).
3. Rejoin lines that were broken only by the page's column/line width, restoring the
   paragraph the source intends. Preserve breaks that are meaningful (verse lines,
   addresses, list items, headings).
4. Remove repeated running headers and footers (the book/chapter title or author name
   reprinted at the top or bottom of every page). These are layout furniture, not
   document content.
5. Fix high-confidence mis-recognized glyphs only: `rn`↔`m`, `l`↔`1`, `O`↔`0`,
   `cl`↔`d`, `vv`↔`w`, and similar. Apply only when the correct reading is
   unambiguous from context.
6. Remove spurious spaces inserted inside a word (`exam ple` becomes `example`) and
   collapse runs of whitespace to a single space within a line.
7. Normalize broken/mojibake quotation marks, apostrophes, dashes, and ellipses to the
   correct character the source intended (e.g. garbled bytes for a curly quote become
   that quote). Do not restyle correct punctuation.

## Structure as Markdown

Represent the document's structure in lightly-structured Markdown so it renders,
searches, and references well. Match the structure to what the source shows — do not
invent hierarchy that is not there.

1. Headings: map each heading to a Markdown heading by its level — book/part title
   `#`, chapter `##`, section `###`, and so on. Keep heading text verbatim.
2. Lists: bulleted items become `-` lines; numbered items become `1.` lines, keeping
   the source's own numbers when they are meaningful.
3. Blockquotes: set off extended/indented quotations with `>`.
4. Tables: reconstruct tabular data as Markdown tables when the columns are clear.
   When alignment is uncertain, prefer a fenced code block over guessing.
5. Captions: keep figure and table captions as their own short paragraphs near where
   they appear. For an image that carries no text, note it as `![](figure)` or a
   short `*Figure: …*` caption line rather than dropping it silently.
6. Preformatted material (code, ASCII tables, equations laid out spatially) goes in a
   fenced code block to preserve spacing.
7. Page boundaries: preserve them as a consistent reference anchor. Keep or normalize
   page markers to `--- Page N ---` on their own line so passages stay citable. This
   is different from running-header noise (rule 4 above), which is removed.

## Footnotes and Citations — PRESERVE

Footnotes and citations are content for an archival/reference record. Keep them. This
is the explicit inverse of TTS cleanup, which removes them.

1. Convert inline footnote reference markers to Markdown footnote references. A
   superscript digit attached to a word or punctuation (`word.1`, `word,2`, `word3`)
   becomes a `[^n]` reference at the same spot: `word.[^1]`, `word,[^2]`, `word[^3]`.
2. Convert each footnote definition block to a Markdown footnote definition:
   `[^n]: <footnote text>`. Preserve the full footnote text, including bibliographic
   citations, "ibid.", page numbers, and editorial commentary — all of it is record.
3. Keep footnote numbering consistent with the source. If the source restarts
   numbering per page or per chapter, keep that scheme; do not renumber across the
   whole document.
4. When a footnote definition block sits between two halves of a sentence split by a
   page break, move the definition out to where footnote definitions belong (end of
   the page's content, before the next `--- Page N ---` marker, or end of file) and
   rejoin the interrupted sentence.
5. Preserve bracketed inline asides and editorial notes (`[sic]`, `[ed.]`,
   `[illegible]`) exactly as they appear.
6. Do not convert a body-text number into a footnote marker. Only digits that function
   as markers — attached directly to a word/punctuation with no space, or a standalone
   leading digit introducing footnote text — become `[^n]`. Dates, statistics, list
   numbers, and section numbers stay as written.

## Fidelity — What Not to Change

1. Do not modernize spelling or orthography. Preserve archaic, regional, and
   period spellings exactly (`shew`, `to-day`, `colour`).
2. Do not paraphrase, summarize, smooth, or rewrite any sentence.
3. Do not expand abbreviations or acronyms.
4. Do not "correct" the author's grammar, capitalization, or punctuation style.
5. Do not reorder, merge, or split the document's actual content.
6. Do not invent text to fill an illegible spot (see Ambiguity Handling).
7. Do not add SSML, XML, vendor tags, or pronunciation hints.

## Ambiguity Handling

1. If a correction is uncertain, prefer the original characters.
2. If text is genuinely illegible and cannot be confidently restored, keep the best
   literal reading and mark the uncertain span with `[?]` immediately after it.
3. Never guess at names, numbers, dates, or citations. An accurate `[?]` is more
   useful for an archive than a confident error.
4. Report every `[?]` and every non-trivial judgment call after each file pass.

## File QA Checklist

Run this check before marking a file done.

1. Markdown renders cleanly: headings, lists, tables, and blockquotes are well-formed.
2. Every `[^n]` reference has a matching `[^n]:` definition and vice versa; no
   footnote content was dropped.
3. No running-header/footer noise remains in the body, but `--- Page N ---` markers
   are intact.
4. Hyphenation splits are rejoined and no spurious intra-word spaces remain.
5. Spot-check a few passages against the raw OCR: wording, spelling, and punctuation
   are unchanged except for genuine OCR-damage repairs.
6. All uncertain reads are marked `[?]` and listed in the report.
