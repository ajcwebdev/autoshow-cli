# ADR-015: Make Setup Downloads Resumable and Setup Reporting Truthful

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-24
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed

## Context

An audit of a full `bun autoshow setup` run (426.4s, reported success) found that the run's two "Retry Attempt" warnings on `whisper-model-large-v3-turbo` were not transient bad luck but a systemic defect, and that several of the run's success signals were not backed by the checks a reader would assume.

**The download layer could not deliver large assets.** `setup-download/download.ts` applied a single flat `AbortSignal.timeout(60_000)` to every download, and the signal stayed armed through `response.arrayBuffer()`. Because the abort covers body streaming, the 60s value capped *transfer time* rather than acting as a stall detector. `ggml-large-v3-turbo.bin` is 1.5 GB, so completing inside the deadline required ~200 Mbps sustained. The audited run's timings match exactly: retry 1 at 60.0s, retry 2 at 60.0s, success at ~68s. With `maxAttempts: 3` (`src/utils/retries.ts`), any slower link exhausts all three attempts and fails the Whisper task while reporting "The operation timed out" — a message that describes the symptom and hides the cause. Eight tasks download concurrently, so per-stream bandwidth is divided and the wall is easier to hit than a solo download suggests.

Two aggravating properties compounded it. The whole payload was buffered in memory before anything reached disk (1.5 GB resident, peaks stacking across concurrent tasks), and the whisper retry wrapper called `cleanupPath(destination)` before each attempt — so the two timeouts re-downloaded 1.5 GB from scratch, twice. There were no `Range` requests and no partial-file handling anywhere in the layer. Meanwhile the two largest downloads in setup carried no `sha256` at all, only `expectedMinBytes: 1000` — a floor that a truncated 5 MB transfer passes, after which every existence-based guard downstream treats it as ready.

**Reporting asserted more than it checked.** The run ended with an unconditional `l.write('success', 'Setup complete')` and exit 0 regardless of the summary's own warn state, so `bun autoshow setup` could not gate a CI or scripted install. `calibre-acsm-fulfill --version` short-circuits inside the generated wrapper roughly 40 lines before the activation-file guard, so doctor reported OK for an install that fails on first real use, while the actual to-do printed as an ordinary `info` bullet on every run — including fully-installed ones, because `setupAcsmFulfillment` had no top-level guard. Doctor never checked qpdf (pinned, built, and checked by the summary) or the CoreML encoders (~2 minutes and 1.2 GB of the run), and it certified the llama model from a 236-byte marker while the weights actually live in `~/Library/Caches/llama.cpp`, outside anything `--force-redownload` clears.

**The run also left ~3.3 GB of recoverable waste** — `runtime/build` held 1.7 GB of source and object trees that no code ever removed, and `runtime/models/whisper/` retained the `.pt` PyTorch checkpoints (1.6 GB) that were only inputs to the CoreML conversion — with no disk accounting in the summary and no disk or bandwidth guidance in the docs for what is a ~12 GB install.

Why now: the audit produced a reproducible, first-principles explanation for a user-visible failure mode (`docs/report/setup-command-audit.md`), and the download path is a surface governed by [ADR-004](ADR-004-local-lite-toolchain-provisioning.md) with retry semantics governed by [ADR-006](ADR-006-unify-error-handling-vocabulary.md), so the change belongs in the record rather than in a commit message.

## Options Considered

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Stall-based timeouts with per-flow total budgets, streaming to a resumable `.part` file, and checksum pins for models** | Transfer size stops deciding success; retries resume instead of restarting; memory bounded regardless of asset size; the two largest downloads gain the same integrity guarantee every pinned tool already has | Adds a sidecar file and resume-validity logic; hashing needs a second read pass over the completed file | Removes the ~200 Mbps floor entirely; retries cost the remaining bytes, not the full 1.5 GB |
| Raise the flat timeout to a large constant | One-line change | Re-picks an arbitrary bandwidth floor rather than removing it; still restarts from byte 0; still buffers whole files in memory | Would need ~20 min to cover 1.5 GB at 10 Mbps, which also delays every genuinely-hung download by 20 min |
| Shell out to `curl -C -` for large assets | Resume and progress for free | Reintroduces an external tool dependency that ADR-004 deliberately removed; splits the download path in two | n/a |
| Leave reporting as-is and document the caveats | No code risk | Leaves doctor reporting OK for an unauthorized ACSM install and setup exiting 0 on a warn summary; documentation cannot fix a wrong exit code | n/a |

## Decision

Setup downloads abort on **inactivity**, never on elapsed transfer time; they stream to a resumable `<destination>.part` file guarded by a URL-matched sidecar; and the default whisper models are checksum-pinned. Setup's success signal reflects the summary it just printed, and doctor checks the conditions that actually gate each tool's use.

This applies to:

- Every caller of `downloadFile` in `src/cli/commands/setup-and-utilities/setup/setup-download/download.ts`.
- `bun autoshow setup`'s exit code and final line, the Setup Summary contents, and `bun autoshow setup --doctor`'s check set.
- Post-install disk reclamation for build trees and CoreML checkpoints.
- It does **not** change `setup-download/huggingface.ts`, which already carries its own budget and classifier, nor does it add key *validation* for hosted providers — that would require provider API calls and must stay opt-in.

## Rationale

- A stall timeout is the only budget that is correct for both a 77 MB and a 1.5 GB asset; a total-transfer deadline necessarily encodes a bandwidth assumption, and any constant we pick is wrong for someone.
- `FLOW_DEFAULTS` already enumerated every flow and mapped them all to one profile — the extension point for per-flow budgets existed and was unused, so this is adoption rather than new machinery.
- Resume makes the retry policy in `src/utils/retries.ts` meaningful for large assets: three attempts are useful when each continues, and near-useless when each restarts.
- Verifying by streaming the completed file, rather than hashing incrementally, is what makes resume and checksums composable — `createHash` state cannot be persisted across attempts.
- An exit code is the only part of a CLI's output a script can act on, so it must follow the same verdict the human-readable summary reports.
- A `--version` probe answers "is this file executable", which for a wrapper script is nearly always yes; the checks worth having are the ones the tool itself refuses to run without.

## Consequences

Positive outcomes:

- Setup completes on connections that previously could not finish it, and an interrupted transfer costs the remaining bytes rather than the whole asset.
- Peak memory during setup no longer scales with the largest concurrent download.
- A truncated or corrupted whisper model is rejected at download time instead of being cached and trusted.
- `bun autoshow setup` is usable as a gate; a run with missing tools or models exits non-zero.
- Roughly 3.3 GB reclaimed per install, and the remaining footprint is reported and documented.
- Re-running setup no longer stops a llama-server the user may be using.

Negative outcomes:

- Checksum verification adds one full read of the completed file (~1-2s for a 1.5 GB model on NVMe).
- A `.part` file and `.part.json` sidecar now appear next to in-flight downloads; an abandoned download leaves them until the next attempt for that URL.
- The whisper model checksums are pinned from a verified local install cross-checked against the published values; a future upstream re-publish of the same filename would now fail closed rather than silently install different bytes. That is the intended behavior, but it does convert a silent change into a build break.
- Setup now exits non-zero in cases that previously exited 0, which will surface pre-existing partial installs in any automation that runs it.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Transfer size no longer decides success | A stalled-but-alive peer is tolerated for up to the stall window before abort |
| Retries resume from disk | A sidecar file and URL-match check must be maintained alongside the download |
| Model downloads verified like every pinned tool | New model names need a pin added, or they fall back to a size floor only |
| Truthful exit code and doctor checks | Automation that relied on setup always exiting 0 will now fail on partial installs |
| ~3.3 GB reclaimed automatically | A failed build after cleanup re-extracts its source tree (mitigated by the source stamp) |

## Implementation Note

Download layer (`setup-download/download.ts`, `src/types/download-workflow/download-types.ts`):

- `DownloadProfile` gained `stallTimeoutMs` and `totalTimeoutMs`; profiles are `bun-fetch-default` (15 min total) and `bun-fetch-large-asset` (60 min total), both with a 60s stall window. `whisper-model`, `reverb-model`, `whisperfile-binary`, `llamafile-binary`, and `calibre-dmg` map to the large-asset profile.
- A watchdog re-arms on every received chunk and aborts with a message containing "timed out", so `classifyFetchRetry` still treats it as retryable.
- Bodies stream to `<destination>.part` via a file handle; `PartialDownloadMetadata` records the source URL so a fragment from another asset is discarded rather than concatenated. A `206` appends, a `200` in response to a `Range` request restarts cleanly, and a `416` discards.
- Checksum and `expectedMinBytes` failures discard the partial file (the bytes are wrong, not merely incomplete); a stall preserves it.
- Archive modes extract from the downloaded file directly, removing the previous double temp-file write for `tar-xz`/`zip`.

Whisper (`stt-local/whisper/whisper.ts`, `whisper-model-integrity.ts`): the per-attempt `cleanupPath(destination)` is gone; `tiny` and `large-v3-turbo` are checksum-pinned with exact sizes, and unpinned models get a 10 MB floor instead of 1000 bytes.

Reporting: `runConcurrentSetupTasks` records per-task durations, rendered as a Setup Step Timings table; the summary gained `disk` and `ACSM authorization` rows and returns a health verdict that `define-setup-command.ts` turns into a non-zero exit; the hosted-provider row reads `N/N present` rather than `configured`.

Doctor: added qpdf, CoreML encoder, and ACSM activation-file checks; `checkLlamaModelReadiness` now stats the GGUF in llama.cpp's cache via the new `listLlamaCacheEntries` probe.

Idempotency and disk: `ensureLlamaModelDownloadedUnlocked` returns early when both the marker and the cached weights exist; `setupAcsmFulfillment` skips its pipeline when already installed and warns only when unauthorized; `mutool`/`tesseract`/`ebook-convert` guards run the tool instead of stat-ing it; installers drop their build tree on success and a full setup prunes `runtime/build`; CoreML `.pt` checkpoints are removed once their encoder is compiled.

Pinning: Linux `yt-dlp` installs the pinned release with a published `sha256` (`linuxUrl`/`linuxSha256`) instead of `releases/latest`; `llama.ts` reads `readDependencyTag('llama.cpp')` instead of a path that never existed; Pinned Versions iterates the metadata rather than restating a subset.

## Implementation Note — second pass (2026-07-25)

Two observed post-fix runs (a 307.4s cold install and a 15.6s warm re-run) closed
the gaps this decision left open. Recorded here rather than in a separate ADR
because each extends a decision already made above.

**Progress signal.** `runConcurrentSetupTasks` now emits a heartbeat every 30s
for any in-flight task (`<label>: still running (Nm Ns elapsed)`), and the llama
download progress renderer was promoted from `l.debug` to `info`. The cold run
had contained 4m 10s of silence during the ffmpeg build; per-step timings
reported that cost only afterwards, which is not the same as showing work is
alive. `runSettledSetupTasks` was split out of `runConcurrentSetupTasks` so
nested groups aggregate failures without recording their own timing rows.

**The cache-guard pattern, completed.** `downloadKittenTtsModel` was the last
step that verified by doing the work — it spawned Python and fully constructed
`KittenTTS(...)` on every run, the largest single item in a warm setup. It now
checks the HuggingFace cache first, and those paths joined the force-redownload
set with a matching doctor check. Note the repo id is not the model name
(`kitten-tts-nano` → `KittenML/kitten-tts-nano-0.8-fp32`), so the cache key
resolves through `getKittenHfRepo` rather than string-building.

**Pinning, completed.** The three Reverb HuggingFace repos moved off revision
`main` to pinned commit SHAs, so every managed asset now installs from a fixed
reference. `resolveHostedProviderChecks` now throws on an unknown env var
instead of silently filtering it away, so a per-step provider subset can no
longer drift out of sync with `HOSTED_PROVIDER_ENV_CHECKS`.

**Concurrency.** Two serial chains were split, deliberately pairing I/O-bound
work with CPU-bound work rather than overlapping two builds: the
`large-v3-turbo` download now overlaps the `tiny` CoreML conversion (the two
conversions stay serial), and the calibre/ACSM chain runs alongside mupdf→qpdf.
`downloadWhisperModel` was decomposed into `fetchWhisperModel` and
`convertWhisperModelToCoreml`, and retained as a wrapper for focused steps.

**Measured outcome: the document-tools half of this was a regression.** A cold
install after the change ran 326.4s against 307.4s before it. Only the targeted
task improved (304s → 282s); TTS went 62s → 210s, Reverb 85s → 171s, OCR 98s →
144s. The cause is that the split moved the ~200 MB calibre DMG and the ACSM
venv creation from roughly four minutes in to t=0, into an opening burst where
every other task is already downloading — calibre itself took 74s in its old
position and 170s in its new one for identical work. The Whisper overlap was
sound in isolation (58s for the parallel block against 101s serial) and should
be kept. The document-tools split should be reverted, and the real constraint —
an unbounded opening burst of eight concurrent downloads — addressed with a
global admission budget instead. Recorded here rather than quietly reverted
because the failed prediction is the useful part: treating concurrent setup
tasks as independent ignores that they share one network link and one CPU.

**Honesty of the reported numbers.** The timings table is titled "concurrent
wall clock" with a `wallClockMs` column: measured against isolation, `document
tools` reported 12.7s under concurrency versus 0.28s alone, so the figures rank
correctly but do not attribute work. The `disk` row switched to `du -sk` (JS walk
retained as fallback) and binary units, so it is both fast and directly
comparable to `du -h`. The full setup no longer prints the ACSM authorization
warning — the summary row and doctor carry it — because an unconditional warning
for a feature the user may never use is how a real to-do becomes noise.

Result: warm re-run 15.6s → **1.8s** in steady state; `document tools` 12.7s →
90ms; TTS 13.4s → 1.4s. Note the first re-run immediately after a cold install
measures ~14s: with ~9 GB just written, the health probes page their binaries in
from disk. Only steady-state warm runs are comparable.

A defect found by the existing suite during this pass is worth recording: the
first version of the Kitten cache check used `Dirent.isFile()`, which is false
for a symlink. HuggingFace snapshots are trees of symlinks into `blobs/`, so the
guard would never have fired. It now follows links and rejects dangling ones,
with a regression test covering both.

## Implementation Note — third pass (2026-07-25)

Closes the four follow-ups the second pass left open. The through-line is the
lesson the second pass paid for: concurrent setup tasks are not independent, so
contention belongs at the resource they share rather than at the task boundary.

**The document-tools split is reverted.** `setupCalibreDocumentTools` is serial
again — `setupDocumentTools` → `setupCalibreTools` → `setupAcsmFulfillment` —
with the measured numbers recorded in the code so it is not re-split. The
`printAuthorizeHint` parameter and both health guards (`hasHealthyCalibreCliTools`,
`isRuntimeToolHealthy('mutool', …)`) are independent of the split and stay. The
Whisper overlap stays too: 58s parallel against 101s serial, and it pairs
network-bound with CPU-bound work rather than overlapping two downloads.

**A global admission budget bounds transfers, not tasks.** New
`setup-download/download-admission.ts` holds one counting semaphore
(`DEFAULT_SETUP_DOWNLOAD_CONCURRENCY = 3`) applied at the two leaves that
actually move bytes: `downloadFile`'s call to `fetchToPartFile`, and
`huggingface.ts`'s per-file `downloadOneFile`. The slot covers the transfer
only — checksum verification and archive extraction are local work, and holding
a slot across a 1.5 GB hash would stall a queued download behind a disk read.
The HF repo-tree listing stays ungated for the same reason. This gates
transfers rather than `runConcurrentSetupTasks` deliberately: task boundaries
also carry CPU work that should keep overlapping, and gating them would break
the contract that independent tasks start immediately. The semaphore itself is
not new — `createGenerationResourceGate` was already a correct FIFO counting
semaphore, so its primitive moved to `src/utils/resource-gate.ts` as
`createResourceGate` and the generation gate became a thin wrapper over it.

**The heartbeat is one line, and yields to real output.** `setup-heartbeat.ts`
replaces N per-task `setInterval`s with a single ticker over a registry of
in-flight tasks. Each tick emits at most one line
(`Still running: media tools 4m 10s · OCR 1m 30s`) and omits any task that
printed within the interval — a task rendering its own progress bar is already
proving it is alive. Attribution runs through an `AsyncLocalStorage` task
context (the pattern `app-logger/context-store.ts` already uses), so the llama
download progress renderer can call `noteSetupTaskActivity()` without knowing
which setup task it belongs to. `formatSetupElapsed` gained the minutes branch
this ADR had already claimed: a four-minute build printed `240.0s`, not `4m 0s`.

**The Reclaimed Build Trees table has a threshold, and the 8192 B was not a
rounding artifact.** `du -sk` charges an empty directory for its own inode — 8
KiB on APFS — so `if (before === 0) return` could never fire. The
`walkDirectorySize` fallback sums file sizes only and *would* return 0 for the
same tree, so the two size functions disagree on precisely the case that
matters; a 10 MiB threshold (`shouldReportReclaimedBuildTrees`) is the fix
rather than a tighter zero check. Pruning still runs unconditionally; only the
report is suppressed.

**Measured outcome: the regressions are recovered, the total is not improved.**
A cold install after this pass ran 330s against 307.4s for pass 1 and 326.4s for
pass 2. Every task the split had damaged returned to its pass-1 figure — TTS
210s → 69s (62s in pass 1), Reverb 171s → 95s (85s), OCR 144s → 101s (98s), and
calibre back to 74s in position for the work that cost 170s under the split. So
the revert did what it was supposed to do.

The admission budget did not shorten the install, because the opening burst was
never the critical path. That path is `document tools` at 5m 29s: a serial
mupdf (112s) → qpdf (140s) → calibre (74s) → ACSM (2s) chain, worse than its
304s pass-1 figure. Calibre ran at its baseline cost and never queued behind the
budget, so the added time is in the two source builds, which now overlap the
Whisper CoreML conversions and contend for CPU. This is the second pass's
mistake in a new place: bounding contention on the network was correct in
itself, but the resource that decides the total is the CPU shared between source
builds and CoreML conversion. Recorded rather than quietly re-tuned, because a
second wrong prediction about the same install is worth more than the fix was.

Caveat on the comparison: 330s against 307.4s is one run on a different day. The
per-task recoveries are far outside run-to-run variance; the ~23s total delta is
not, and should not be read as a regression on its own.

The warm re-run measured 14.2s, which is the documented cold-cache case rather
than steady state — with ~9 GB just written, the health probes page their
binaries in from disk, and `document tools` alone accounts for 13.8s of it. No
steady-state warm figure was captured in this pass.

## Keep (with rationale)

- **`runtime/bin/whisper-coreml-env` (654 MB) is retained.** The audit listed it as reclaimable, but it is a legitimate cache: deleting it forces a multi-minute torch reinstall the next time any model is converted via `bun autoshow setup --models`. The disk row now makes its cost visible instead.
- **`config/deps.json` remains optional.** It does not exist in the repo, but `readDependencyMetadata` merges it over the defaults when present, so it is a supported override rather than dead code. Only the unreachable warn and the misleading error message were removed.
- **`setup-download/huggingface.ts` keeps its own 120s budget and classifier.** It already downloads per-file with temp-file-then-rename and its own retry policy; folding it into the profile table would be churn without a defect behind it. The third pass did add it to the shared admission budget — that is a different concern from timeouts, and leaving Reverb and Kitten transfers outside the budget would have left part of the opening burst unbounded.

## Test Plan

- `bun run check` — passes.
- `bun test test/test-cases/validation/setup/` — 74 pass, 0 fail (66 before the third pass).
- Observed end to end (first and second pass): cold install 307.4s (0 retries, `large-v3-turbo` in 61s on
  one attempt), warm re-run 2.9s, `runtime/` 12 GB → 9.0 GiB with `runtime/build`
  empty and no `.pt` checkpoints or stray `.part` files remaining.
- `bun autoshow setup --doctor` confirms the added checks: qpdf OK with version, CoreML
  encoders compiled for both models, llama weights resolved to the real GGUF in
  llama.cpp's cache, Kitten TTS model cached, and ACSM authorization correctly
  MISSING with `bun autoshow setup --step acsm-authorize` as the only next step.
- New contracts in `native-setup-download-contracts.test.ts`: resume sends `bytes=N-` and preserves the prefix across an interrupted transfer; a foreign-URL partial is discarded; a `200` reply to a `Range` request restarts cleanly; a checksum mismatch and a short file each discard the partial; the large-asset profile carries a longer total budget with the same stall window; a stalled body fails with a retryable "timed out" message.
- `setup-command-contracts.test.ts` stubs the new `listLlamaCacheEntries` probe so the missing-assets doctor scenario still reports the llama model as MISSING.
- Third-pass contracts in `native-setup-download-contracts.test.ts`: three concurrent downloads against a capacity of 2 leave exactly one queued; a failed transfer releases its slot rather than leaking it; a second download's transfer begins while the first is still verifying its checksum, proving the slot is released before the hash.
- Third-pass contracts in `setup-command-contracts.test.ts`: the heartbeat renders every quiet task on one line, stays silent when all tasks logged recently, and omits only the task that logged recently; `formatSetupElapsed` reports minutes past 60s; `shouldReportReclaimedBuildTrees(8192)` is false; and the calibre document chain asserts serial ordering with no concurrent group.
- Observed end to end (third pass): cold install 330s, warm re-run 14.2s (cold-cache, not steady state), `runtime/` 9.0 GiB, exit 0 on both. The heartbeat emitted 11 aggregate lines over 5m 30s against ~40 per-task lines before, and no Reclaimed Build Trees table appeared on either run — correct, since each installer now drops its own tree and `runtime/build` was empty. Full numbers in the third-pass note. (An earlier revision of this section claimed no end-to-end run had ever been performed, which contradicted the observed figures above; those runs belong to the first and second passes.)
- Fourth-pass verification: `bun run check` passes; `bun t --price` checks 165 mapped commands with 0 failures and makes no provider calls; `bun test test/test-cases/validation/setup/` passes 82 tests; and `bun autoshow setup --doctor` exits 0 with every managed runtime and model healthy except the expected optional ACSM authorization action.
- Fourth-pass contracts: the performance artifact test covers schema version, structured phases, actual compile overlap, environment facts, local-file persistence, and exclusion of home paths and URLs; the reset regression test requires both `all` and `calibre` force paths to name the qpdf wrapper, build tree, and tool tree.
- Observed end to end (fourth pass): three accepted ungated cold runs have a 175.2s median; the selected warm sequence is 11.2s post-install cold-cache followed by a 1.639s steady-state median; three capacity-one CPU-gate cold runs have a 169.8s median and therefore miss the 10% acceptance threshold. Every measured setup run reported healthy local tools and models and exited 0.

## Implementation Note — fourth pass (2026-08-13)

This pass completes the setup-performance recommendation with structured phase attribution, comparable cold and warm baselines, and a controlled CPU-admission experiment. The result keeps the existing ungated source-build topology: a capacity-one CPU-heavy gate improved the cold median by only 3.1%, below the predeclared 10% acceptance threshold, so the experimental gate was removed. Compilation remains the dominant removable cost, which triggers the prebuilt-distribution follow-up now recorded in [ADR-004](ADR-004-local-lite-toolchain-provisioning.md).

- **Recommendation Status:** Completed
- **Selected Topology:** Existing serial mupdf→qpdf document chain with compile/link work ungated across independent setup tasks
- **Rejected Candidate:** One shared capacity-one gate around active compile/link leaves
- **Distribution Gate:** Escalated to ADR-004; no prebuilt download path was added here

### Instrumentation and reset integrity

`setup-performance.ts` records phases against a monotonic clock with a fixed vocabulary: archive preparation, configure/generate, compile/link, install/promote, health check, and cleanup. Every full setup writes one schema-versioned JSON artifact under `runtime/setup-performance/`; it contains relative timestamps, phase duration and status, task timings, actual pairwise compile overlap, operating-system release, architecture, logical CPU count, effective parallel width, Bun version, dependency versions, and source-cache state. It contains no credentials, download URLs, home-directory paths, or machine identifiers. Detailed rows are emitted only with verbose human logging, while the normal Setup Step Timings table stays concise.

MuPDF and qpdf phase spans reconcile with the sum of their recorded phases within 0.30ms in every accepted baseline sample. The same instrumentation covers the active lame, ffmpeg, leptonica, Tesseract, and Whisper compile leaves when those managed source builds run. Whisper CoreML conversion could not be measured because it had been retired from the setup path before this pass; the experiment therefore gated the current Whisper compile/link leaf instead of preserving a benchmark around obsolete work.

The first attempted matrix exposed a reset-integrity defect and was excluded: `--force-redownload all` did not explicitly name the qpdf wrapper and install tree, so the old managed qpdf survived the overlapping removal set and those runs did not exercise its source build. The `all` and `calibre` reset sets now explicitly include the qpdf wrapper, build tree, and tool tree. The accepted matrix begins only after that correction and contains a qpdf compile/link phase in every cold sample.

### Controlled matrix

All samples ran on the same arm64 macOS host on AC power with Darwin 25.5.0, Bun 1.3.14, 11 logical CPUs, pinned dependency versions, an eight-job cap for managed source builds, and Whisper reporting an effective width of 11. Cold samples used the existing named `--force-redownload all` reset targets; warm samples ran the same full setup and health checks without force. Times below come from the JSON artifact's monotonic total, not parsed log text.

| Topology and cache state | Runs | Median | Decision use |
|---|---:|---:|---|
| Ungated cold baseline | 165.2s, 175.2s, 188.7s | **175.2s** | Selected cold baseline |
| Ungated post-install cold-cache rerun | 11.2s | 11.2s | Labeled separately; executable and filesystem cache warm-up |
| Ungated steady-state warm | 1.639s, 1.644s, 1.596s | **1.639s** | Selected warm baseline |
| Capacity-one CPU gate, cold | 170.4s, 169.8s, 169.0s | **169.8s** | 3.1% improvement; reject because it misses 10% |
| Capacity-one CPU gate, post-install cold-cache rerun | 12.9s | 12.9s | Candidate diagnostic only |
| Capacity-one CPU gate, steady-state warm | 1.684s, 1.854s, 1.838s | 1.838s | Candidate diagnostic only; no compile work is admitted on warm runs |

### Phase attribution and topology decision

| Component, baseline median | Archive | Configure | Compile/link | Install/promote | Health | Cleanup | Recorded total |
|---|---:|---:|---:|---:|---:|---:|---:|
| MuPDF | 5.227s | <0.001s | **45.645s** | <0.001s | 0.689s | 0.487s | 52.038s |
| qpdf | 1.088s | 4.175s | **42.027s** | 0.206s | 0.651s | 0.300s | 49.276s |

The two compile/link medians total 87.673s, or 50.0% of the 175.181s cold median before counting Whisper and ffmpeg compilation. Baseline compile overlap was real rather than inferred: Whisper and MuPDF overlapped for a median 36.261s, while qpdf and ffmpeg overlapped for 10.388s. The capacity-one candidate reduced MuPDF compile/link to 33.627s and qpdf to 34.837s, but qpdf waited 9.749s for admission and Whisper waited 32.613s; pairwise compile overlap fell to zero. The shorter isolated compiles therefore shifted time into queues instead of removing enough critical-path work.

The candidate was faster than the baseline median in all three samples, but a 3.1% median improvement is not the accepted 10%, and the experiment did not justify a second weighted candidate: each admitted build already used eight of 11 logical CPUs, while Whisper could use all 11, so the serial candidate was not leaving meaningful CPU capacity idle during the measured compile leaves. Directly overlapping mupdf and qpdf at full width would move in the opposite direction and remains rejected without new hardware-specific evidence.

The production CPU gate and its test hook were removed after measurement. The transfer-level network admission budget remains unchanged because it governs a different resource and the phase artifacts did not show transfer queue time deciding the cold critical path. Source builds remain the fallback topology. Because compilation still contributes at least half the median through MuPDF and qpdf alone, ADR-004 now owns the next decision: whether project-produced, pinned, checksum-verified prebuilts can remove that work without weakening provenance or platform coverage.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Revert the document-tools concurrency split in `setup-download/dl-document/calibre.ts`; keep the Whisper overlap | maintainer | Done — serial chain restored; health guards and `printAuthorizeHint` retained |
| Introduce a global admission budget for concurrent network-heavy setup tasks instead of splitting task boundaries | maintainer | Done — `download-admission.ts`, 3 concurrent transfers, gating `downloadFile` and HF per-file |
| Aggregate the per-task heartbeat into one line and suppress tasks that logged recently | maintainer | Done — one ticker, one line, activity-suppressed via an `AsyncLocalStorage` task context |
| Suppress the Reclaimed Build Trees table below a meaningful threshold | maintainer | Done — 10 MiB threshold; the 8192 B was `du -sk` charging an empty dir for its inode |
| Measure a cold install against the 307.4s baseline with the admission budget in place | maintainer | Done — 330s; per-task regressions recovered, total unchanged, see third-pass note |
| Instrument and profile qpdf and MuPDF across archive, configure, compile/link, install, health, and cleanup phases | maintainer | Done — schema-versioned local artifacts; phase spans reconcile within 0.30ms |
| Benchmark a shared CPU-heavy admission gate before considering direct mupdf/qpdf overlap | maintainer | Done and rejected — 169.8s versus 175.2s cold median is only 3.1%; candidate removed |
| Reconsider pinned prebuilt MuPDF/qpdf binaries with the measured critical path identified | maintainer | Escalated — ADR-004 now owns the distribution proposal because the two compile medians alone are 50.0% of cold setup |
| Capture and separately label the post-install cold-cache rerun and a three-run steady-state warm median | maintainer | Done — 11.2s post-install and 1.639s steady-state warm median for the selected topology |
| Keep admission transfer-scoped; evaluate moving it up to `runConcurrentSetupTasks` only if new measurements show network queue time gates the run | maintainer | Done — phase evidence retains the transfer boundary; no task-level gate added |

## References

- Audit that produced this decision: `docs/report/setup-command-audit.md`
- Related ADR: [ADR-004](ADR-004-local-lite-toolchain-provisioning.md) — managed toolchain provisioning and the resolver precedence this preserves
- Related ADR: [ADR-006](ADR-006-unify-error-handling-vocabulary.md) — `withRetry`/`classifyFetchRetry` semantics the new timeout messages depend on
- `src/cli/commands/setup-and-utilities/setup/setup-download/download.ts`
- `src/cli/commands/setup-and-utilities/setup/setup-download/download-admission.ts`
- `src/cli/commands/setup-and-utilities/setup/setup-heartbeat.ts`
- `src/cli/commands/setup-and-utilities/setup/setup-performance.ts`
- `src/utils/resource-gate.ts`
- `src/cli/commands/setup-and-utilities/setup/run-complete-setup.ts`
- `src/cli/commands/setup-and-utilities/setup/run-doctor.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/whisper-model-integrity.ts`
- `src/cli/commands/process-steps/step-3-write/write-local/llama/llama-model-cache.ts`
