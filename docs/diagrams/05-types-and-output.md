# Types, Metadata & Output Layout

Reference for public output artifacts, the canonical pipeline manifest, runtime directories, provider result files, and key type families.

## Outline

- [Output Layout](#output-layout)
- [Canonical Manifest](#canonical-manifest)
- [Runtime Layout](#runtime-layout)
- [Type Reference](#type-reference)

## Output Layout

```
output/
  YYYY-MM-DD_HH-MM-SS_<title>/
    manifest.json

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
      result.json                      # raw domain result payload

    # document/article extract/write
    extraction.txt
    result.json                        # raw structured extract/domain payload
    extraction.tsv
    extraction.hocr
    providers/<provider-or-backend>/
      extraction.txt
      result.json                      # raw domain result payload
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

Every output root owns exactly one `manifest.json`. TTS directory batch items include the input, `audioStem`, status, provider states, TTS metadata, cost, timing, and any errors. Extract parent items link to route child manifests by a containment-checked relative directory.

## Canonical Manifest

Single runs and batches use the same unversioned, non-union shape. `command` and `scope` are ordinary data, not format selectors:

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

Commands are `metadata`, `download`, `extract`, `write`, `tts`, `image`, `video`, and `music`. Scope is `single` or `batch`. Item status is `full`, `incomplete`, `failed`, or `skipped`; provider status is `running`, `succeeded`, `missing`, `failed`, or `skipped`.

Batch items use the same item shape. A route parent adds a child link without changing the manifest format:

```json
{
  "input": "input/file.pdf",
  "inputFamily": "document",
  "extractRoute": "document",
  "outputDir": "document/2026-08-10_12-00-00_file",
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

`source` is optional top-level business data for source-backed work such as podcast feeds or YouTube collections. It is never written to a companion control file.

Provider directories may retain raw user-facing domain results, but those files are not manifests and never control resume:

```json
{
  "provider": "whisper",
  "model": "small",
  "metadata": {},
  "result": {}
}
```

The sole reader validates this current shape, timestamps, enumerated values, status consistency, and containment of every output, child, and provider path. One serialized atomic writer creates and updates that shape, including in-progress provider lifecycle changes. There is no pipeline-manifest version, kind registry, compatibility reader, migration path, filename probing, or old-format recognition. Existing outputs from before this cutover must be rerun.

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
    character-references.json        # checksummed immutable character snapshot index
    character-references/
      <snapshot-id>/
        <character-key>/
          reference.<ext>             # one-image character
          sketch-sheet.png            # legacy two-image character
          source.<ext>                # legacy two-image character
    location-references.json         # checksummed immutable location snapshot index
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

Flag/config resolution context:
  merged/configured/explicit flags
  normalized repeatable model selections
  command-neutral resolution state

ProcessingOptions:
  only the composed media/document write pipeline

Domain option slices:
  STT, OCR, URL, LLM, TTS, image, video, music, batch, and pricing
  each consumer requests only its domain plus named shared controls
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

Item metadata commonly includes cost, timing, errors, and route-specific evidence such as `resolvedStep2` and `web`. Completion and provider progress live only in the canonical item `status` and `providers` fields; requested, missing, and blocked lists are derived views rather than duplicated persisted state.
