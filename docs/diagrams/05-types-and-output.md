# Types, Metadata & Output Layout

Reference for public output artifacts, schema v2 envelopes, runtime directories, provider result files, and key type families.

## Outline

- [Output Layout](#output-layout)
- [Schema V2 Envelopes](#schema-v2-envelopes)
- [Runtime Layout](#runtime-layout)
- [Type Reference](#type-reference)

## Output Layout

```
output/
  YYYY-MM-DD_HH-MM-SS_<title>/
    run.json

    # media extract/write
    audio.(mp3|m4a|ogg|flac)
    source_media.(m4a|mp3)             # staged artifact when materialized in run dir
    transcription.txt                  # single-provider or primary text output
    youtube-captions.vtt               # when --youtube-captions succeeds
    youtube-captions.json
    prompt.md
    prompt-md.md                       # when --prompt-md is set
    text.json                          # single LLM provider
    text-<model>.json                  # multi-provider LLM
    text.md                            # when --rendered-text is set
    text-<model>.md
    show-note.md
    show-note-<model>.md
    providers/<provider-model>/
      transcription.txt
      result.json                      # provider-result envelope

    # document/article extract/write
    extraction.txt
    result.json                        # provider-result or structured extract result
    extraction.tsv
    extraction.hocr
    providers/<provider-or-backend>/
      extraction.txt
      result.json                      # provider-result envelope
    prompt.md
    prompt-md.md
    text.json | text-<model>.json
    text.md | text-<model>.md
    show-note.md | show-note-<model>.md

    # standalone generation
    speech.wav | speech.mp3 | ...
    generated-image.*
    generated-video.mp4
    generated-music.mp3

    # transcript video
    <label>.mp4
    <label>.vtt
    <label>.srt

    # music lyric-video
    <stem>.mp4
    <stem>.vtt
    <stem>.srt
```

Batch roots:

```
non-extract batch:
  batch.json
  source.json                  # optional source-backed batch
  <item-output>/

extract batch:
  extract-batch.json           # schema v2 route parent
  source.json                  # optional source-backed batch
  media/
    batch.json
    stt-summary.json
    <item-output>/
  document/
    batch.json
    <item-output>/
  x-space/
    batch.json
    <item-output>/

standalone tts directory batch:
  batch.json
  run.json
  <item-stem>.<ext>                        # one target
  <item-stem>-<provider>-<model>.<ext>     # multi-target/provider output
```

TTS directory batch entries include the input, `audioStem`, completion status, TTS metadata arrays, and errors for failed items. The aggregate `run.json` records batch metadata, requested providers, item metadata, cost, and timing.

## Schema V2 Envelopes

Run manifests:

```json
{
  "schemaVersion": 2,
  "kind": "extract",
  "metadata": {}
}
```

Valid `run.json` kinds are `metadata`, `download`, `extract`, `write`, `tts`, `image`, `video`, and `music`.

Batch manifests:

```json
{
  "schemaVersion": 2,
  "kind": "write",
  "items": [],
  "source": {}
}
```

Valid `batch.json` kinds match run kinds. `source` is present only for source-backed batches such as podcast feeds or YouTube sources.

Provider result envelopes:

```json
{
  "schemaVersion": 2,
  "kind": "provider-result",
  "provider": "whisper",
  "model": "small",
  "metadata": {},
  "result": {}
}
```

Extract batch parent:

```json
{
  "schemaVersion": 2,
  "createdAt": "2026-06-10T17:00:00.000Z",
  "items": [
    {
      "input": "input/file.pdf",
      "inputFamily": "document",
      "extractRoute": "document",
      "childBatchEntry": { "route": "document", "index": 0 },
      "completionStatus": "full",
      "outputDir": "document/2026-06-10_12-00-00_file"
    }
  ],
  "childBatches": {
    "media": "media/batch.json",
    "document": "document/batch.json",
    "x-space": "x-space/batch.json"
  }
}
```

Extract batch item `inputFamily` values are `media`, `document`, `html_article`, `x_space`, and `unsupported`. Extract routes are `media`, `document`, and `x-space`. Completion status values are `full`, `incomplete`, `failed`, and `skipped`.

Manifest readers accept only schema v2 run/batch manifests with a current `kind` and schema v2 extract batches. Retired shapes — schema v1 extract batches and run manifests with `kind: "stt"` or `kind: "ocr"` — no longer parse and are treated as absent; re-run `extract` to produce a current manifest.

## Runtime Layout

```
runtime/
  bin/
    whisper-cli
    llama-server
    whisperfile/                 # prebuilt Mozilla whisperfiles (downloaded on demand)
    llamafile/                   # prebuilt single-file llamafiles (downloaded on demand)
    reverb/
    kitten-tts/
  build/
    whisper.cpp/
  models/
    whisper/
    llama/
    reverb/
```

Process locks use an internal default location under `~/.cache/autoshow-cli/process-locks`.

### Comic character and run layout

```text
input/characters/
  characters-reference.json       # schemaVersion 3; CharacterKey catalog
  character-sketches.json         # flat-sheet provenance and SHA-256 checksums
  <canonical-source-image>
  <source-stem>--outline-sheet.png # registered live sheet

output/<timestamp>_<scene-slug>/
  metadata/
    structured-script.json           # schemaVersion 3; characterKeys/speakerKey
    draft-prompt.md
    scene.json                       # schemaVersion 4; authoritative panel.characterKeys
    scene.invalid.json               # only when validation preserves invalid model output
    panel-prompts/
      source-coverage.json
      panel-NN/
        <scene>-panel-N.md            # keys + snapshot IDs; no copied reference images
  assets/
    character-references.json        # checksummed immutable character snapshot manifest
    character-references/
      <snapshot-id>/
        <character-key>/
          reference.<ext>             # one-image character
          sketch-sheet.png            # legacy two-image character
          source.<ext>                # legacy two-image character
    location-references.json         # checksummed immutable location snapshot manifest
    location-references/
      <snapshot-id>/
        <location-key>--reference-sheet.png
    design-references.json           # only when reviewed panels declare design references
    design-references/
      <snapshot-id>/
        <design-key>.<ext>
  panels/
  pages/
  sketches/
```

Reference compilation preserves first character appearance and emits one canonical image for each one-image character. Legacy two-image characters emit one derived identity card. The scene's immutable location reference follows all required character references, then any optional panel/page/sketch continuity references.

## Type Reference

Process command and runtime option families:

```
ProcessCommand =
  "metadata" | "download" | "extract" | "write" |
  "tts" | "image" | "music" | "video"

RuntimeOptions includes:
  target/download controls
  batch and source selection
  STT/OCR/URL/LLM/TTS/image/video/music provider selections
  local/hosted concurrency controls
  prompt/text-input/rendered-text controls
  cost/preflight controls
  provider-specific voice, model, media, and generation options
```

Provider unions:

| Type | Values |
|------|--------|
| `TtsProvider` | `kitten`, `elevenlabs`, `minimax`, `groq`, `grok`, `mistral`, `openai`, `gemini`, `deepgram`, `speechify`, `hume`, `cartesia` |
| `ImageProvider` | `gemini`, `openai`, `grok`, `bfl`, `recraft`, `replicate`, `lumalabs`, `fal` |
| `VideoProvider` | `gemini`, `minimax`, `glm`, `grok`, `runway`, `ltx`, `replicate`, `lumalabs`, `fal` |
| `MusicProvider` | `elevenlabs`, `minimax`, `gemini` |
| `OcrTarget['service']` | `tesseract`, `mistral`, `glm`, `kimi`, `openai`, `grok`, `anthropic`, `gemini`, `deepinfra` |

`DetectResult` values:

```
"pdf" | "epub" | "acsm" | "docx" | "pptx" | "xlsx" | "odf" |
"mobi" | "azw3" | "fb2" | "lit" | "cbz" | "rtf" | "csv" |
"png" | "jpg" | "tif" | "webp" | "bmp" | "gif" | "html" | null
```

Important metadata fields by step:

| Step | Metadata highlights |
|------|---------------------|
| Step 1 media | title, slug, duration, author, source URL/path, publish metadata, audio file name/size, and staged source media details. |
| Step 1 document | title, slug, author, page count when available, format, file size, source URL/path. |
| Step 2 STT | transcription service, model, output files, segment counts, token/character counts, timings, runtime/provider info, billing/cost fields, caption fields `captionKind`, `captionLanguage`, `captionFormat` for YouTube captions. |
| Step 2 extraction | extraction method, provider/model/backend, format, page counts, OCR/text page counts, language/DPI/chapter fields, HTML/web/source info, conversion/normalization details, provider cost/usage and timing. |
| Step 3 LLM | LLM service/model, output file, token counts, structured mode/preset names, processing time, provider cost/usage. |
| Step 4 TTS | TTS provider/model, voice/speaker/language, audio file names/sizes, chunk counts, clone/custom voice metadata, processing time, provider cost. |
| Step 5 image | image provider/model, file names/sizes, image count/dimensions, size/quality/format, request mode, revised prompt, returned model, moderation/grounding, provider cost. |
| Step 6 video | video provider/model, file name/size/duration, request mode, resolution/aspect ratio, input/reference media, provider IDs/URLs/progress/moderation/storage, provider cost. |
| Step 7 music | music provider/model, file name/size/duration, lyrics source, generated lyrics/title/style fields, audio technical metadata, provider IDs/traces, provider cost. |

Run-level metadata commonly includes `completionStatus`, `requestedProviders`, `providerStates`, `missingProviders`, `cost`, `timing`, `errors`, and route-specific fields such as `extractRoute`, `resolvedStep2`, `web`, and `source`.
