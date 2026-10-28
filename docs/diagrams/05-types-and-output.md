# Types, Metadata & Output Layout

Public output artifacts, the pipeline manifest, runtime directories, and metadata fields.

## Outline

- [Output Layout](#output-layout)
- [Canonical Manifest](#canonical-manifest)
- [Runtime Layout](#runtime-layout)
- [Metadata](#metadata)

## Output Layout

The trees show common artifacts across commands; a run contains only the files produced by its command and selected options. `--output-root` changes the parent directory, and `--output-dir` pins an exact run directory.

```text
output/
  YYYY-MM-DD_HH-MM-SS-mmm_<title>/
    manifest.json                       # every run root, including metadata
    metadata.md                         # metadata --save --markdown only

    <media-stem>.(mp3|m4a|ogg|flac|wav)    # source basename or publish-date/title slug; lossless uses wav
    source-timeline.json                # lossless audio profile
    transcription.txt                   # single-provider or primary text output
    youtube-captions.vtt                 # when --youtube-captions succeeds
    youtube-captions.json
    prompt.md
    prompt-md.md                        # when --prompt-md is set
    text.json                           # single LLM target
    text-<model>.json                    # multiple LLM targets; shared model IDs add a provider prefix
    text.md                             # when --rendered-text is set
    text-<model>.md
    show-note.md
    show-note-<model>.md
    providers/<service>-<model>/         # STT targets
      transcription.txt
      result.json

    extraction.txt
    extraction.md                       # X Space runs and document --docx-markdown
    result.json
    providers/<service>-<model>/         # OCR targets
      extraction.txt
      result.json
    providers/<backend>/                # HTML article backends
      extraction.txt
      result.json

    speech.wav                          # speech-<provider>-<model>.wav for multiple TTS targets
    slots/audio.zip                     # retained TTS request audio after successful completion
    <target-key>/
      render.json                       # TTS render record
      timeline.json
    generated-image.*                   # extra images append -<n>; multiple targets add a provider/model suffix
    generated-video.mp4                 # generated-video-<provider>-<model>.mp4 for multiple targets
    generated-music.mp3                 # generated-music-<provider>-<model>.mp3 for multiple targets

    <stem>.mp4
    <stem>.vtt
    <stem>.srt
```

Batch roots:

```text
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
  <item-stem>.<ext>                       # one target
  <item-stem>-<provider>-<model>.<ext>    # multiple targets
  items/<item-stem>/
    slots/audio.zip
    <target-key>/
      render.json
      timeline.json
```

Each run root owns one `manifest.json`; batch trees can contain child manifests. Extract parent items link to route child manifests by a relative directory. TTS directory batch items record the input, audio stem, status, providers, cost, timing, and errors. See [Input Routing & Batch Orchestration](02-input-routing-batch.md) for how extract batches are partitioned by route.

Multi-target write outputs use the same stem for JSON, rendered Markdown, and show notes.

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
          "service": "whisperfile",
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

Managed installs live under `runtime/` in the project checkout. A tool found in `--bin-dir` takes precedence over its managed install. macOS requires an override or managed binary; other hosts can fall back to `PATH`.

```text
runtime/
  bin/                           # managed binaries, including whisperfile models
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
  location-plans.json                # optional reviewed room geometry
  plans/
    <location-key>--floor-plan.png   # optional drawing behind a reviewed record

output/<timestamp>_<scene-slug>/
  manifest.json
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
    review/                          # written by comic review and draft-scenes --reconcile-from-directives
      review-notes-<run-id>.md
      review-sheet.html
      export-doc.md                  # only with comic review --export-doc
      reconcile-<run-id>.json        # only with draft-scenes --reconcile-from-directives
    panel-prompts/
      source-coverage.json
      panel-NN/
        <scene>-panel-N.md            # stable keys/mappings; images read directly from current canonical roots
  panels/
  pages/
  sketches/
  qa/                                  # written only by generate-images --qa-only
    panel-audit-<run-id>/
      page-qa-report.json
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
    panel-NN-attempt-N.png.json
```

## Metadata

Item `status` and `providers` record completion and provider progress. Item metadata commonly includes title, slug, duration or page count, source URL or path, output file names, token or character counts, timings, and cost.

Typical metadata by command or artifact:

- Media: title, slug, duration, channel, source, publish metadata, and audio file name/size.
- Document: title, slug, author, page count when available, format, file size, and source.
- STT: service, model, output files, segment counts, timings, cost, and YouTube caption language/format when captions were used.
- Extraction: method, provider/model/backend, format, page counts, language, and cost.
- Write: service/model, output file, token counts, processing time, and cost.
- TTS: provider/model, voice/speaker/language, audio file names/sizes, chunk counts, processing time, and cost.
- Image: provider/model, file names/sizes, dimensions, format, request mode, and cost.
- Video: provider/model, file name/size/duration, resolution/aspect ratio, request mode, and cost.
- Music: provider/model, file name/size/duration, lyrics source, generated title/style, and cost.
- Comic: stage progress (structure, image, audio, presentation), scene identity, structured script, dialogue plan, and selected audio/soundscape/presentation refs. The script slug lives in the manifest `source` block.
