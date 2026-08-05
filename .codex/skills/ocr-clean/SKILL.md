---
name: ocr-clean
description: Clean raw OCR output into the most accurate, faithful text representation of a source document for archiving, reference, and search (not narration). Use when working on OCR-derived exports, scanned-book pages, or extraction.txt/chapter files that need artifact repair, hyphenation rejoining, structure preserved as lightly-structured Markdown, and footnotes/citations kept intact while preserving original wording.
compatibility: Requires Bun (optional, for batch queue tracking)
allowed-tools: Bash Read Edit Write Glob Grep
metadata:
  short-description: Clean OCR text into faithful Markdown for archiving
  author: autoshow
  version: "1.0"
---

# OCR Clean

## Overview

Turn raw OCR output into the most accurate, faithful text representation of the source
document, one file at a time. The goal is an archival/reference/search record — **not**
read-aloud narration. Output is lightly-structured Markdown that mirrors the source:
headings, lists, tables, blockquotes, preserved page markers, and footnotes kept intact.

This is the inverse of TTS cleanup. Where `tts-batch-polish` removes footnotes, expands
abbreviations, and dissolves structure for spoken flow, `ocr-clean` preserves wording,
spelling, structure, and scholarly apparatus exactly.

Use this whenever the input is OCR-derived text (typically `.txt`, e.g. an
`extraction.txt` or chapter export) and quality issues include scanning artifacts,
hyphenation splits, running-header noise, lost structure, or garbled glyphs.

Read `references/ocr-editing-rules.md` before editing. It is the source of truth for
fidelity-safe cleanup, structure mapping, footnote handling, ambiguity handling, and QA.

## Workflow

Progress:

- [ ] Set the target directory that contains the OCR source files.
- [ ] Select exactly one target file explicitly, such as a user-specified file or one
  chosen page/chapter file.
- [ ] Produce the cleaned, lightly-structured Markdown. Edit in place when the source is
  already Markdown; when the source is `.txt`, write `<name>.md` next to it.
- [ ] Check boundary continuity: verify the opening and closing lines are not in the
  middle of a sentence carried over from an adjacent file.
- [ ] If a boundary line is mid-sentence, repair the split using the previous or next
  file so the sentence is whole across files.
- [ ] Run a quick quality check on the edited file or files.
- [ ] Report what changed and any unresolved uncertainties.

## Commands

Run commands from the skill directory. Replace `DOC_DIR` with the target directory from
the user or current task.

```bash
DOC_DIR="/absolute/path/to/ocr-export-directory"
ls -1 "$DOC_DIR"/*.txt | sort
```

Optional: pick a single file deterministically (first sorted file).

```bash
ls -1 "$DOC_DIR"/*.txt | sort | head -n 1
```

Optional: use the Bun queue helper to track repeatable single-file passes. By default it
scans `.txt`; pass `--ext md` to track Markdown outputs instead.

```bash
bun scripts/ocr_batch_queue.ts status --root "$DOC_DIR"
bun scripts/ocr_batch_queue.ts next --root "$DOC_DIR" --size 1
bun scripts/ocr_batch_queue.ts done --root "$DOC_DIR" "page-01.txt"
bun scripts/ocr_batch_queue.ts status --root "$DOC_DIR" --ext md
```

## Editing Rules

Read and apply `references/ocr-editing-rules.md` for every file pass. Use it as the
single source of truth for fidelity-safe edits.

Core constraints:

1. Preserve the source's exact wording, spelling, capitalization, and punctuation.
2. Repair only genuine OCR damage: rejoin hyphenation splits, remove spurious intra-word
   spaces, fix high-confidence mis-recognized glyphs, remove scanning artifacts.
3. Represent the original structure in lightly-structured Markdown: `#`/`##` headings,
   `-`/`1.` lists, `>` blockquotes, Markdown tables, fenced blocks for preformatted text.
4. Preserve page boundaries as `--- Page N ---` reference anchors; remove repeated
   running headers/footers.
5. Preserve footnotes and citations. Convert inline markers to `[^n]` references and
   footnote blocks to `[^n]: …` definitions. Never delete, inline, or paraphrase them.
6. Limit each run to one file unless the user explicitly asks for a different batch size.
7. Exception to single-file editing: if a sentence is split across a file boundary, you
   may edit the immediately adjacent file solely to complete the split sentence.
8. Do not modernize, expand abbreviations, paraphrase, or add SSML/vendor tags.
9. For genuinely illegible text, keep the literal reading and mark it `[?]`; never guess.

## Gotchas

1. Limit each normal pass to one selected file. Edit an adjacent file only to repair a
   broken boundary sentence.
2. Footnote markers must be **preserved** as `[^n]`, not stripped. This is the opposite
   of the TTS skill. Citation-only footnotes are kept too — they are reference content.
3. Running headers/footers (the title reprinted on every page) are noise and are removed,
   but page-boundary markers (`--- Page N ---`) are reference anchors and are kept.
4. Do not "correct" the author's spelling, grammar, or archaic usage. Only repair what is
   clearly OCR damage. Glyph errors hide in words and numbers (`prob1em`, `astro1abe`,
   `instru ments`); body-text digits (dates, statistics, list numbers) are not footnote
   markers.

## File Completion Checklist

1. Confirm exactly one selected target file was processed, unless an adjacent-file
   boundary fix was required.
2. Confirm Markdown renders cleanly: headings, lists, tables, and blockquotes are
   well-formed.
3. Confirm every `[^n]` reference has a matching `[^n]:` definition and no footnote
   content was dropped.
4. Confirm running-header/footer noise was removed but `--- Page N ---` markers remain.
5. Confirm hyphenation splits are rejoined and no spurious intra-word spaces remain.
6. Confirm wording, spelling, and punctuation are unchanged versus the source except for
   genuine OCR-damage repairs.
7. Confirm first and last lines are not sentence fragments and flow correctly with
   neighboring files.
8. Confirm all uncertain reads are marked `[?]`.

## Reporting

After each file, report:

1. Edited/produced file list.
2. Categories of fixes applied (artifacts, hyphenation, glyphs, structure, footnotes).
3. Whether opening/closing boundary continuity was checked and whether adjacent-file
   repair was needed.
4. How structure was mapped to Markdown (headings, lists, tables, page markers).
5. Any uncertain reads marked `[?]` and any remaining ambiguities.
