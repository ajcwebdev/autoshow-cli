# ADR-015: Make Setup Downloads Resumable and Setup Reporting Truthful

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-07-24
- **Date Updated:** 2026-08-12
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

## Remaining Work Recommendation: Measure CPU Phases Before Changing Build Topology

This subordinate mini-ADR defines how to finish the setup performance investigation without reopening the completed resumability, reporting, or network-admission decisions.

- **Recommendation Status:** Recommended, pending measurement and implementation
- **Primary Question:** Whether qpdf/mupdf compilation, their effective parallel width, or overlap with Whisper CoreML conversion is responsible for the cold-install critical path
- **Decision Gate:** Do not parallelize source builds or adopt prebuilt binaries from the existing single-run evidence

| Current State | Recommended Next Step | Target Transition |
|---|---|---|
| Resumable downloads, truthful reporting, and transfer admission are implemented. Source-build phases dominate the measured cold path, but phase attribution and a comparable steady-state warm baseline are missing. | Instrument build phases, establish three-run cold and warm baselines, benchmark a shared CPU-heavy gate, and escalate prebuilts to ADR-004 only if compilation remains dominant. | Keep this ADR accepted with an evidence-backed build topology and clearly labeled performance baselines. |

### Context and gap analysis

The third pass established that the network admission budget repaired the opening download burst but did not shorten the total run. The 330-second cold measurement attributes 252 seconds to the serial mupdf and qpdf source builds, and those builds now overlap top-level Whisper CoreML conversion. Both source builds use up to `min(logical CPU count, 8)` parallel jobs. Their aggregate task durations show that CPU work is the likely constraint, but the current timing table cannot separate download/extract, configure, compile, link, install, wrapper creation, and health validation. One cold run on a different day is not enough to distinguish contention from ordinary thermal, filesystem-cache, compiler-cache, or network variance.

The existing serial mupdf-to-qpdf order is not itself proof that the builds should overlap. They are already competing indirectly with CoreML conversion because setup task concurrency is organized by feature rather than resource. Running mupdf and qpdf concurrently could put two eight-worker builds beside the conversion and increase elapsed time for all three. Conversely, lowering each build's `-j` width or globally serializing CPU-heavy phases could reduce contention but leave cores idle during configure, download, install, or single-threaded link phases.

The warm result is also ambiguous by design. A first rerun immediately after writing roughly 9 GiB measures cold executable and filesystem-cache behavior; a steady-state warm run measures idempotent guards and already resident binaries. Both are useful, but they answer different questions and must be labeled separately. A single `14.2s` number should not replace the earlier `1.8s` steady-state observation without a comparable measurement sequence.

Prebuilt binaries are potentially the largest improvement because they remove compilation rather than reschedule it, but they add architecture coverage, provenance, checksum, signing, hosting, retention, and release-CI obligations owned by ADR-004. They should be evaluated only after local phase timings show how much time compilation actually contributes and whether a resource-scheduling change can recover it without adding a distribution system.

### Recommendation

Add local structured phase timing around the mupdf and qpdf installers before changing concurrency. Record download/extract, configure/generate, compile/link, install/promote, and health-check durations using the monotonic clock already used for setup timings. Record non-sensitive environment facts needed to compare runs: operating system version, architecture, logical CPU count, selected parallel width, tool versions, whether each source/archive was cached, and whether CoreML conversion overlapped the phase. Keep the normal concise setup table; emit detailed phase rows only in verbose logs or a local setup-performance artifact.

Use a small controlled matrix with at least three comparable cold samples per candidate on the same machine. The baseline is the current topology. The first recommended experiment is not concurrent mupdf/qpdf; it is a shared CPU-heavy admission gate spanning mupdf compile, qpdf compile, and Whisper CoreML conversion while downloads, extraction, configure steps, and unrelated health checks remain free to overlap. Start with one heavy phase admitted at a time, then test a weighted variant only if phase data shows meaningful idle capacity. Keep the existing per-build `-j` cap for the first comparison so only one variable changes.

Adopt a scheduling change only when the median cold wall time improves by at least 10%, no individual tool's median regresses by more than 20% without a compensating total improvement, all health checks pass, and results are consistent in at least two of three runs. If serialization merely shifts time or the two compile/link phases still consume more than half of median cold setup, escalate a prebuilt-binary proposal to ADR-004. Do not silently add release downloads inside this ADR.

Capture warm behavior as a sequence after the final cold run: label the first no-force rerun `post-install cold-cache`, then run at least three additional no-force invocations and record their median as `steady-state warm`. Warm verification must perform the same health checks as a normal setup; skipping probes to improve the number is not acceptable.

Retain the transfer-level network admission budget. Moving admission to `runConcurrentSetupTasks` would also serialize CPU-only work and task initialization and has no supporting evidence because the third pass showed the network was not the critical path. Reconsider that boundary only if phase logs show transfer queue time or network-active time again determines total setup duration.

### Alternatives considered

| Option | Advantages | Disadvantages | Recommendation |
|---|---|---|---|
| **Instrument phases, benchmark a shared CPU-heavy gate, then escalate to prebuilts only if compilation remains dominant** | Changes one variable at a time, addresses the observed cross-task contention, preserves download overlap, and creates evidence for ADR-004 | Requires several local cold runs and temporary measurement code | Recommended |
| Run mupdf and qpdf concurrently at their current `-j` width | Could shorten the serial document-tools chain on an otherwise idle machine | Likely oversubscribes the same cores already used by CoreML and can repeat the failed task-level concurrency experiment | Reject until a bounded experiment demonstrates spare capacity |
| Lower every build to a fixed small `-j` value | Reduces peak contention and is simple | Penalizes machines with more cores and may lengthen an uncontended build | Reject as a global default; test only through a measured weighted gate |
| Immediately ship prebuilt mupdf/qpdf artifacts | Removes most source-build time | Expands ADR-004 distribution, supply-chain, architecture, CI, and retention scope before the avoidable portion of build time is known | Defer behind the measurement gate |
| Move the download semaphore to whole setup tasks | Reduces total concurrent tasks | Conflates network and CPU admission and contradicts the third-pass evidence | Reject unless network contention reappears |
| Keep the current topology and record no new baseline | No implementation work | Leaves the 252-second critical path unexplained and makes future concurrency changes guesswork | Reject |

### Implementation plan

#### Phase 1: Instrumentation

1. Add a small setup phase recorder with monotonic start/end timing and a fixed phase vocabulary. Do not parse human log text to recover measurements.
2. Instrument mupdf and qpdf archive preparation, configure/generate, build, install, promotion, cleanup, and health checks in `macos-managed-tools.ts`.
3. Mark the start/end of Whisper CoreML conversion and record overlap as timestamps rather than inferring it from task-level duration.
4. Emit one versioned local JSON performance artifact plus concise verbose tables. Exclude credentials, home-directory paths, download URLs with query parameters, and machine-unique identifiers.

#### Phase 2: Baseline and warm measurements

1. Capture at least three cold baseline runs on one supported macOS architecture with the same power/thermal conditions and pinned dependencies. Reset only the named managed-tool build/install targets through existing setup force paths; do not delete the repository or broad `runtime/` tree.
2. Record median total duration and per-phase medians, the spread across runs, effective `-j` width, and overlap with CoreML.
3. After the last cold run, capture the first no-force rerun separately and the median of at least three subsequent no-force reruns as the steady-state warm baseline.

#### Phase 3: CPU admission experiment

1. Add a setup-local CPU-heavy resource gate whose first candidate capacity admits one compile/conversion phase at a time. Keep transfers under the existing independent network gate.
2. Gate only the measured CPU-heavy phase, not archive download/extraction, configure, install, cleanup, or health checks unless measurements show those phases are also CPU-bound.
3. Repeat the same three-run cold matrix and warm sequence. If the serialized candidate underutilizes the host, test one weighted candidate in which admitted weights never exceed the chosen CPU budget.
4. Keep the candidate only if it crosses the acceptance thresholds; otherwise remove the experiment and retain the measurements as evidence.

#### Phase 4: Build-versus-distribution decision

1. If local scheduling meets the thresholds, make it the managed-source default and update setup docs and contract tests.
2. If compilation remains more than half of cold setup or no scheduling candidate improves median total time by 10%, open a material ADR-004 update for pinned prebuilt mupdf/qpdf artifacts by supported architecture.
3. A prebuilt proposal must define producer CI, source/version provenance, checksums or signatures, hosting/retention, fallback source builds, platform coverage, update cadence, and doctor verification before implementation.
4. Keep source builds as the fallback until prebuilt coverage and verification are proven.

### Acceptance and verification criteria

- Phase totals reconcile with each tool's task duration within documented recorder overhead.
- The artifact distinguishes configure, build/link, install, and health time and records actual overlap with CoreML.
- Performance decisions use medians from at least three comparable cold samples, not the fastest single run.
- The selected topology improves median cold wall time by at least 10%, preserves truthful setup exit status, and passes all managed-tool health checks.
- The first post-install rerun and steady-state warm median are recorded and labeled separately.
- The network admission boundary remains transfer-scoped unless new queue-time evidence demonstrates that network contention is again gating the run.
- Verification uses `bun run check`, `bun t --price`, targeted setup contracts, and local setup/doctor runs. These operations do not call paid providers, but cold setup measurements may download pinned open-source artifacts and should be run deliberately because they consume time, bandwidth, and disk I/O.

## Follow-up Actions

| Action | Owner | Current State |
|---|---|---|
| Revert the document-tools concurrency split in `setup-download/dl-document/calibre.ts`; keep the Whisper overlap | maintainer | Done — serial chain restored; health guards and `printAuthorizeHint` retained |
| Introduce a global admission budget for concurrent network-heavy setup tasks instead of splitting task boundaries | maintainer | Done — `download-admission.ts`, 3 concurrent transfers, gating `downloadFile` and HF per-file |
| Aggregate the per-task heartbeat into one line and suppress tasks that logged recently | maintainer | Done — one ticker, one line, activity-suppressed via an `AsyncLocalStorage` task context |
| Suppress the Reclaimed Build Trees table below a meaningful threshold | maintainer | Done — 10 MiB threshold; the 8192 B was `du -sk` charging an empty dir for its inode |
| Measure a cold install against the 307.4s baseline with the admission budget in place | maintainer | Done — 330s; per-task regressions recovered, total unchanged, see third-pass note |
| Instrument and profile where qpdf's 140s and mupdf's 112s go across archive, configure, compile/link, install, and health phases, including effective parallel width and CoreML overlap | maintainer | Pending — Remaining Work Phases 1-2; prerequisite for topology changes |
| Benchmark a shared CPU-heavy admission gate before considering direct mupdf/qpdf overlap | maintainer | Pending — Remaining Work Phase 3; retain only if the three-run median crosses the acceptance threshold |
| Reconsider prebuilt ffmpeg/mupdf/tesseract/qpdf binaries with the measured critical path identified | maintainer | Deferred — ADR-004-scoped; trigger Remaining Work Phase 4 only if compilation remains dominant after CPU admission is measured |
| Capture and separately label the post-install cold-cache rerun and a three-run steady-state warm median | maintainer | Pending — Remaining Work Phase 2 |
| Keep admission transfer-scoped; evaluate moving it up to `runConcurrentSetupTasks` only if new measurements show network queue time gates the run | maintainer | Deferred — current evidence says network admission is not the constraint |

## References

- Audit that produced this decision: `docs/report/setup-command-audit.md`
- Related ADR: [ADR-004](ADR-004-local-lite-toolchain-provisioning.md) — managed toolchain provisioning and the resolver precedence this preserves
- Related ADR: [ADR-006](ADR-006-unify-error-handling-vocabulary.md) — `withRetry`/`classifyFetchRetry` semantics the new timeout messages depend on
- `src/cli/commands/setup-and-utilities/setup/setup-download/download.ts`
- `src/cli/commands/setup-and-utilities/setup/setup-download/download-admission.ts`
- `src/cli/commands/setup-and-utilities/setup/setup-heartbeat.ts`
- `src/utils/resource-gate.ts`
- `src/cli/commands/setup-and-utilities/setup/run-complete-setup.ts`
- `src/cli/commands/setup-and-utilities/setup/run-doctor.ts`
- `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/whisper-model-integrity.ts`
- `src/cli/commands/process-steps/step-3-write/write-local/llama/llama-model-cache.ts`
