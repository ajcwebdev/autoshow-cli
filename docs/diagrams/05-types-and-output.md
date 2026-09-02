# Types, Metadata & Output Layout

Public output artifacts, the pipeline manifest, runtime directories, and metadata fields.

## Outline

- [Output Layout](#output-layout)
- [Canonical Manifest](#canonical-manifest)
- [Runtime Layout](#runtime-layout)
- [Metadata](#metadata)

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

Every output root owns exactly one `manifest.json`. Extract parent items link to route child manifests by a relative directory. TTS directory batch items record the input, audio stem, status, providers, cost, timing, and errors. See [Input Routing & Batch Orchestration](02-input-routing-batch.md) for how extract batches are partitioned by route.

## Canonical Manifest

Single runs and batches use the same shape:

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

`source` is optional top-level data for source-backed work such as podcast feeds or YouTube collections.

Provider directories may keep a raw `result.json` next to generated text. That file is the transcription or extraction payload, not a second manifest:

```json
{
  "text": "…",
  "segments": []
}
```

## Runtime Layout

Managed installs live under `runtime/` in the project checkout. `--bin-dir` overrides `runtime/bin` for external tool lookup; a tool present in that directory takes precedence over the managed install and `PATH`.

```
runtime/
  bin/                           # managed binaries, including whisperfile models
  models/                        # local Whisper models
  tools/                         # installed tool prefixes
```

### Comic character and run layout

```text
input/characters/
  characters-reference.json
  character-sketches.json
  <canonical-source-image>
  <source-stem>--outline-sheet.png

input/locations/
  locations-reference.json
  location-sketches.json
  location-plans.json                # optional reviewed room geometry, hashed separately from the specification
  plans/
    <location-key>--floor-plan.png   # optional drawing behind a reviewed record

output/<timestamp>_<scene-slug>/
  metadata/
    structured-script.json
    structured-script.previous.json  # written only when a structure re-run replaces an existing script
    draft-prompt.md
    scene.json
    scene.invalid.json               # only when validation preserves invalid model output
    blocking-prompt.md               # blocking drafter prompt, written by the prompt stage
    blocking-plan.json               # reviewed stage marks and camera setups, written by the blocking stage
    blocking-plan.invalid.json       # only when the blocking stage preserves an invalid plan candidate
    blocking-bindings.json           # only in bind mode, when a reviewed scene.json predates the plan
    blocking/                        # compiled by panel-prompts when a plan exists
      plan-overview.svg
      panel-NN.svg
      panel-NN-layout.png             # dense ledgers only
      blocking-ledger.md
    review/                          # written by comic review-notes, review-sheet, and draft-scenes --reconcile-from-directives
      review-notes-<run-id>.md
      review-sheet.html
      export-doc.md                  # only with comic review-sheet --export-doc
      reconcile-<run-id>.json        # only with draft-scenes --reconcile-from-directives
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
    location-references.json          # schemaVersion 3; readers still accept 2
    location-references/
      <snapshot-id>/
        <location-key>--establishing.png
        <location-key>--reverse.png    # only when a reverse view is registered
        <location-key>--side.png       # only when a side view is registered
    design-references.json           # only when reviewed panels declare design references
    design-references/
      <snapshot-id>/
        <design-key>.<ext>
  panels/
  pages/
  sketches/
  qa/                                  # written only by generate-images --qa-only
    panel-audit-<run-id>/
      page-qa-report.json              # schemaVersion 6
      page-qa-report.md
      qa-only-audit.json
    continuity-audit-<run-id>/         # only with --continuity-qa
      stage-state.json
      continuity-report.json
      continuity-report.md
      panel-NN-continuity.json
    continuity-labels.json             # optional human labels, read by --labels; "labeled": false marks an unfilled template that --labels refuses

<output-root>/bloopers/               # only with generate-images --bloopers; never canonical
  bloopers.json
  README.md
  <episode>/<scene-slug>/
    panel-NN-attempt-N.png
    panel-NN-attempt-N.json
```

## Metadata

Item `status` and `providers` record completion and provider progress. Item metadata commonly includes title, slug, duration or page count, source URL or path, output file names, token or character counts, timings, and cost.

Typical fields by step:

- Step 1 media: title, slug, duration, author, source, publish metadata, and audio file name/size.
- Step 1 document: title, slug, author, page count when available, format, file size, and source.
- Step 2 STT: service, model, output files, segment counts, timings, cost, and YouTube caption language/format when captions were used.
- Step 2 extraction: method, provider/model/backend, format, page counts, language, and cost.
- Step 3 LLM: service/model, output file, token counts, processing time, and cost.
- Step 4 TTS: provider/model, voice/speaker/language, audio file names/sizes, chunk counts, processing time, and cost.
- Step 5 image: provider/model, file names/sizes, dimensions, format, request mode, and cost.
- Step 6 video: provider/model, file name/size/duration, resolution/aspect ratio, request mode, and cost.
- Step 7 music: provider/model, file name/size/duration, lyrics source, generated title/style, and cost.
- Step 8 comic: stage progress (structure, image, audio, presentation), scene identity, structured script, dialogue plan, and selected audio/soundscape/presentation refs. The script slug lives in the manifest `source` block.
