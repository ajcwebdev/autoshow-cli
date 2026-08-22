# Types, Metadata & Output Layout

Reference for public output artifacts, the canonical pipeline manifest, runtime directories, and metadata fields.

## Outline

- [Output Layout](#output-layout)
- [Canonical Manifest](#canonical-manifest)
- [Runtime Layout](#runtime-layout)
- [Type Reference](#type-reference)

## Output Layout

```
output/
  YYYY-MM-DD_HH-MM-SS-mmm_<title>/
    manifest.json

    # media extract/write
    <publish-date>-<title-slug>.(mp3|m4a|ogg|flac)   # normalized media artifact
    source_media.(mp3|m4a|ogg|flac)    # staged artifact when materialized in run dir
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
    providers/<service>-<model>/
      transcription.txt
      result.json

    # document/article extract/write
    extraction.txt
    result.json
    providers/<service>-<model>/       # OCR targets
    providers/<backend>/               # HTML article backends
      extraction.txt
      result.json
    prompt.md
    prompt-md.md
    text.json | text-<model>.json
    text.md | text-<model>.md
    show-note.md | show-note-<model>.md

    # standalone generation; multi-target runs suffix the stem with -<provider>-<model>
    speech.wav
    generated-image.*                  # extra images append -<n>
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
  manifest.json
  <item-output>/

extract batch:
  manifest.json                 # parent items and child links
  media/
    manifest.json
    <item-output>/
  document/
    manifest.json
    <item-output>/
  article/
    manifest.json
    <item-output>/
  x-space/
    manifest.json
    <item-output>/

standalone tts directory batch:
  manifest.json
  <item-stem>.<ext>                        # one target
  <item-stem>-<provider>-<model>.<ext>     # multi-target/provider output
```

Every output root owns exactly one `manifest.json`. TTS directory batch items include the input, `audioStem`, status, provider states, TTS metadata, cost, timing, and any errors. Extract parent items link to route child manifests by a relative directory.

## Canonical Manifest

Single runs and batches use the same unversioned shape:

```json
{
  "command": "extract",
  "scope": "single",
  "createdAt": "2026-08-10T12:00:00.000Z",
  "updatedAt": "2026-08-10T12:00:05.000Z",
  "source": {},
  "items": [
    {
      "input": "input/audio.mp3",
      "inputFamily": "media",
      "extractRoute": "media",
      "outputDir": ".",
      "status": "full",
      "metadata": {},
      "providers": [
        {
          "service": "whisper",
          "model": "small",
          "local": true,
          "artifactDir": ".",
          "status": "succeeded",
          "attempts": 1,
          "options": {},
          "metadata": {},
          "result": {}
        }
      ]
    }
  ]
}
```

Commands are `metadata`, `download`, `extract`, `write`, `tts`, `image`, `video`, `music`, and `comic`. Scope is `single` or `batch`. Item status is `full`, `incomplete`, `failed`, or `skipped`; provider status is `running`, `succeeded`, `missing`, `failed`, or `skipped`.

Batch items use the same item shape. A route parent adds a child link without changing the manifest format:

```json
{
  "input": "input/file.pdf",
  "inputFamily": "document",
  "extractRoute": "document",
  "outputDir": "document/2026-08-10-file",
  "child": {
    "route": "document",
    "index": 0,
    "manifestDir": "document"
  },
  "status": "full",
  "metadata": {},
  "providers": []
}
```

`source` is optional top-level data for source-backed work such as podcast feeds or YouTube collections.

Provider directories may keep a raw `result.json` next to generated text. That file is not a manifest and does not control resume. `result.json` holds the transcription or extraction result:

```json
{
  "text": "…",
  "segments": []
}
```

## Runtime Layout

```
runtime/
  bin/                           # managed binaries and symlinks into tools/
    whisper-cli
    yt-dlp
    ffmpeg, ffprobe, mutool, tesseract, qpdf, ebook-convert
    whisperfile/                 # prebuilt Mozilla whisperfiles (downloaded on demand)
  build/                         # source checkouts and build trees
    whisper.cpp/
  tools/                         # installed tool prefixes
    ffmpeg/, lame/, mupdf/, calibre/, leptonica/, tesseract/, tessdata/, qpdf/
  models/
    whisper/
  defuddle/                      # managed defuddle CLI install
  synthesis-cache/v1/            # sound-effect synthesis cache
  protected-voice-assets/managed-v1/
  setup-performance/
```

The global `--bin-dir` flag overrides `runtime/bin` for external tool lookup; a tool present in that directory takes precedence over the managed install and `PATH`.

### Comic character and run layout

```text
input/characters/
  characters-reference.json       # character catalog
  character-sketches.json         # registered sketch provenance
  <canonical-source-image>
  <source-stem>--outline-sheet.png # registered live sheet

output/<timestamp>_<scene-slug>/
  metadata/
    structured-script.json
    draft-prompt.md
    scene.json
    scene.invalid.json               # only when validation preserves invalid model output
    panel-prompts/
      source-coverage.json
      panel-NN/
        <scene>-panel-N.md            # keys and snapshot IDs; images live under assets/
  assets/
    character-references.json
    character-references/
      <snapshot-id>/
        <character-key>/
          reference.<ext>             # when source and outline sheet are the same file
          sketch-sheet.png            # when source and outline sheet differ
          source.<ext>                # when source and outline sheet differ
    location-references.json
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

## Type Reference

Recognized file types:

```
"pdf" | "epub" | "docx" | "pptx" | "xlsx" | "odf" |
"mobi" | "azw3" | "fb2" | "lit" | "cbz" | "rtf" | "csv" |
"png" | "jpg" | "tif" | "webp" | "bmp" | "gif" | "html" | null
```

Important metadata fields by step:

| Step              | Metadata highlights                                                                                                                                                                                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 1 media      | title, slug, duration, author, source URL/path, publish metadata, audio file name/size, and original media file name/size/kind when the source media is retained.                                                                                                                                                                      |
| Step 1 document   | title, slug, author, page count when available, format, file size, source URL/path.                                                                                                                                                                                                                                                    |
| Step 2 STT        | transcription service, model, output files, segment counts, token/character counts, timings, runtime/provider info, billing/cost fields, caption fields `captionKind`, `captionLanguage`, `captionFormat` for YouTube captions.                                                                                                        |
| Step 2 extraction | extraction method, provider/model/backend, format, page counts, OCR/text page counts, language/DPI/chapter fields, HTML/web/source info, conversion/normalization details, provider cost/usage and timing.                                                                                                                             |
| Step 3 LLM        | LLM service/model, output file, token counts, structured mode/preset names, processing time, provider cost/usage.                                                                                                                                                                                                                      |
| Step 4 TTS        | TTS provider/model, voice/speaker/language, audio file names/sizes, chunk counts, `ttsAudio` projection, processing time, and provider cost. Voice creation and protected consent/sample data are not synthesis metadata.                                                                                                               |
| Step 5 image      | image provider/model, file names/sizes, image count/dimensions, size/quality/format, request mode, revised prompt, returned model, moderation/grounding, provider cost.                                                                                                                                                                |
| Step 6 video      | video provider/model, file name/size/duration, request mode, resolution/aspect ratio, input/reference media, provider IDs/URLs/progress/moderation/storage, provider cost.                                                                                                                                                             |
| Step 7 music      | music provider/model, file name/size/duration, lyrics source, generated lyrics/title/style fields, audio technical metadata, provider IDs/traces, provider cost.                                                                                                                                                                       |
| Step 8 comic      | stage progress (structure, image, audio, presentation), scene run identity, structured script, dialogue plan, voice snapshot, selected audio and soundscape runs, and presentation refs. The script slug and content identity live in the manifest `source` block.                                                                     |

Item metadata commonly includes cost, timing, errors, and route-specific fields such as `resolvedStep2` and `web`. Item `status` and `providers` are the source of completion and provider progress.
