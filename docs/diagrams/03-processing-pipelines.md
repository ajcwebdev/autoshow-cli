# Processing Pipelines

## Media STT Pipeline

```text
media input
  --> metadata / staging (yt-dlp, direct fetch, or local inspection)
  --> shared audio preparation
  --> selected STT targets
  --> canonical result + transcript
  --> optional caption/timing exports
```

`metadata` stops after inspection; `download` stops after acquisition. Whisperfile is local; other STT targets are hosted. Successful results are saved before derived exports so export failure cannot repurchase transcription.

With `--youtube-captions`, usable YouTube captions replace selected STT work and produce `youtube-captions.vtt`, `youtube-captions.json`, `transcription.txt`, and `result.json`. Unavailable captions fall back to selected STT targets. These retrieved captions are not native acoustic word timing.

Single audio STT targets normally write top-level results; multiple targets and ScrapeCreators use `providers/<service>-<model>/`. Completed providers survive sibling failures. Item status distinguishes `full`, `incomplete`, and `failed`; provider status records individual progress.

## Document and Article Pipeline

```text
detected source
  +--> HTML/article -------------> Defuddle, Spider, or Zyte
  +--> CSV/Office/ODF/RTF --------> native extraction
  +--> EPUB/convertible ebook ---> native text, or explicitly selected OCR
  +--> PDF/image/CBZ ------------> Tesseract or hosted OCR
```

Convertible ebooks normalize to EPUB first. Local HTML uses Defuddle; hosted article backends require explicit selection. See [format routing](../commands/02-extract/overview.md#input-routing).

```text
OCR fanout (default)                 OCR pool
  each target reads full document     targets claim shared pages
  independent provider results        one ordered composite
  optional --primary-ocr output       retained attributed attempts
                                      --primary-ocr rejected
```

OCR and article results use `extraction.txt` or JSON output, with provider directories for multi-target work. Page progress, attempts, and costs belong to the canonical manifest. Native/hosted extraction and pooled recovery details are in the [OCR](../commands/02-extract/ocr/overview.md) and [URL](../commands/02-extract/url/overview.md) guides.

## Write Outputs

```text
local .md/.txt
  --> prompt + source snapshot
  --> selected hosted LLM targets
  --> text.json + show-note.md
  --> optional text.md / external rendered Markdown
```

`--prompt-md` also saves `prompt-md.md`; `--rendered-text` enables rendered output. Multiple targets use `text-<model>` and matching show-note stems, adding the provider when model IDs collide. `write` never acquires or transcribes its source.

## Transcript Video Pipeline

```text
completed media extract run          --audio + exactly one transcript source
  --> infer audio/result                 --transcript-result or --transcript-text
                    \                  /
                     v                v
                  validate timing / build captions
                              |
                              v
                   local renderer --> MP4 + VTT + SRT
```

Ambiguous completed providers require `--transcript-result`. Rendering needs FFmpeg `ass` support or the supported ImageMagick/Pango fallback and fonts. `--keep-tmp` retains renderer intermediates. See [transcript video](../commands/02-extract/stt/workflows/transcript-video/overview.md).

## Music Lyric-Video Pipeline

```text
--audio or --batch
  --> supplied VTT/SRT captions, or local Whisperfile inference
  --> timed lyric cues
  --> local renderer --> MP4 + VTT + SRT
```

Lyric-video flags select this local workflow, separate from hosted music generation. Without supplied captions, Whisperfile defaults to `small.en`. Rendering uses FFmpeg plus its caption renderer prerequisites. See [music](../commands/04-audio/music/overview.md).
