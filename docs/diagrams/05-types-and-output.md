# Types and Output Ownership

## Output Layout

Each run owns a canonical manifest and only the artifacts its workflow produces:

```text
output/<timestamp>_<slug>/
  manifest.json
  <source media / extracted text / generated output>
  result.json                         # retained STT/extraction payload when applicable
  providers/<target>/                 # independent multi-provider results or OCR attempts
```

Common families:

- STT: `transcription.txt`, provider evidence, optional captions, and `source-timeline.json` for lossless preparation.
- Extraction: `extraction.txt`/JSON, optional chapters or Markdown, attributed provider results/attempts.
- Write: `source.txt`, `prompt.md`, `text.json`, and `show-note.md`; optional `prompt-md.md` and rendered `text.md`. Multiple targets qualify names by model and, on collisions, provider.
- Generation: speech, images, video, or music plus recorded target settings. TTS separates purchased clips (`slots/audio.zip` after successful compaction), render/timeline records, masters, and derived exports.

`--output-root` changes the parent; applicable commands accept `--output-dir` to pin a run. Ordinary batches place items beside their parent manifest; extract batches add route child manifests. TTS directory batches publish item audio at the root and retain item state beneath `items/<item-stem>/`. [Batch routing](02-input-routing-batch.md#batch-layout) and command guides own exact naming rules.

## Canonical Manifest

```text
manifest.json
  command + scope + timestamps + optional source
  items[]
    input / route / outputDir / optional child-manifest link
    status + metadata
    providers[]
      service/model + artifactDir + status/attempts
      options + metadata + optional settings/result/error
  optional providerJobs --> gemini-provider-jobs.json
```

Item statuses are `full`, `incomplete`, `failed`, or `skipped`; provider statuses are `running`, `succeeded`, `missing`, `failed`, or `skipped`. Child links and artifacts use relative directories. Optional provider settings record effective controls; they can reject incompatible recovery but never prove completed work.

The Gemini provider-job ledger is linked recovery evidence, not a second inferred completion authority. Result payloads, diagnostics, and `--json --result-file` artifacts likewise do not replace the manifest. [ADR-002](../adr/ADR-002-pipeline-state-resume-and-dry-run-planning.md) defines persistence and resume; the schema lives in `src/types/provider-core/provider-contract-types.ts` and is exported through `~/types`.

## Runtime Layout

```text
runtime/
  bin/                 # managed tools and Whisperfile bundles
  tools/               # installed prefixes
```

An explicit runtime-owned tool directory takes precedence over the default managed paths. Application dependencies do not fall back to globally installed executables. See [setup resolution](04-providers-and-setup.md#setup-pipeline).

### Comic character and run layout

```text
input/characters/
  characters-reference.json
  character-sketches.json
  <canonical source images>
input/locations/
  locations-reference.json
  location-sketches.json
  location-plans.json

output/<timestamp>_<scene-slug>/
  manifest.json
  metadata/
    structured-script.json
    scene.json
    blocking-plan.json
    blocking/                       # compiled diagrams and ledger
    panel-prompts/                  # images read directly from current canonical roots
    review/
  panels/                           # reviewed still panels
  pages/                            # grouped pages
  sketches/
  qa/                               # image/continuity audits
  audio/                            # retained scene audio/soundscape state and masters
  presentation/                     # derived plan, WAV, and MP4
```

Reviewed source coverage and voice snapshots bind downstream work. Protected voice registrations, consent, and reference recordings remain outside run outputs and the visual catalog. Optional invalid candidates, review/reconciliation logs, and bloopers are diagnostic evidence, not canonical replacements. [Comic guides](../commands/05-visuals/comic/00-comic-overview.md) describe stage artifacts and recovery.

## Metadata

Metadata records available source identity, title, duration/pages, provider/model, timing, usage, costs, and artifact references. Command-specific fields differ; consumers should read the canonical typed projection rather than infer completion from filenames. Registry prices, estimated costs, recorded usage, and reconciled billing are separate evidence.
