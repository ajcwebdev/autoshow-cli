# ADR-004: Manage the Setup Runtime and Toolchain Lifecycle

## Status

- **Decision Status:** Accepted
- **Date Created:** 2026-06-12
- **Date Updated:** 2026-08-13
- **Verification Status:** Passed
- **Supersession:** Consolidates the complete setup reliability, reporting, and performance record formerly titled "Make Setup Downloads Resumable and Setup Reporting Truthful"; the complete standalone "ADR-004 Phase 5 macOS Toolchain Distribution Review"; and the ACSM plugin, managed Python, wrapper, resolver, authorization-helper, doctor, and setup/help mechanics formerly recorded in ADR-001. The previously absorbed "Docker Image Trade Study for CLI Distribution" and all Docker distribution authority moved to ADR-015 on 2026-08-13. ADR-001 retains book-like ingestion, fulfillment, authorization, conversion, and extraction policy.

## Context

AutoShow promises one "local-lite" tool set — FFmpeg and `ffprobe`, `yt-dlp`, MuPDF `mutool`, `qpdf`, Calibre `ebook-convert`, Tesseract with English trained data, and OCRmyPDF — and has to provision it on macOS and Linux hosts. Both host environments are governed by the resolver precedence in `resolveRuntimeToolInfo` (`src/utils/runtime-paths.ts`): an explicit `--bin-dir`/`AUTOSHOW_BIN_DIR` or per-tool override first, then an AutoShow-managed artifact under `runtime/`, then `PATH` for tools AutoShow does not own. The provisioning decision for each host is which of those tiers supplies the tools. Docker distribution is governed separately by ADR-015.

Host provisioning. The local dependency report showed macOS setup still using Homebrew for several tools while most AutoShow-managed local dependencies already lived under `runtime/`. That mixed model made setup behavior less reproducible: managed binaries, Python environments, and models are cacheable project artifacts, but Homebrew installs mutate global machine state and can vary by host, tap state, bottle availability, and the user's existing package manager configuration. The macOS Homebrew-managed setup paths covered FFmpeg and `ffprobe`, `yt-dlp`, MuPDF `mutool`, Calibre `ebook-convert`, Tesseract and English language data, and OCRmyPDF. Host build prerequisites such as Apple/Xcode tooling, command line developer tools, `cmake`, and compiler/runtime components remain explicit external prerequisites, not AutoShow-installed dependencies. Linux hosts continue to use `apt`.

Setup reliability evidence. An audited full setup took 426.4 seconds and reported success despite two 60-second Whisper download timeouts and incomplete readiness checks. The flat `AbortSignal.timeout(60_000)` stayed armed through body streaming, imposing a roughly 200 Mbps floor on the 1.5 GB `ggml-large-v3-turbo.bin`; retries deleted the destination and restarted from byte zero; whole bodies were buffered in memory; the largest models lacked SHA-256 pins; and eight concurrent setup tasks divided available bandwidth. Reporting could still end with unconditional success and exit 0 after a warning summary. Doctor probed the ACSM wrapper's early-returning `--version` path rather than activation readiness, omitted qpdf and CoreML encoders, and trusted a 236-byte llama marker instead of the cached GGUF. The run also left roughly 3.3 GB of removable build trees and CoreML source checkpoints and gave users no truthful disk or bandwidth accounting.

Setup performance evidence. Four implementation passes replaced those defects, measured failed concurrency assumptions, and established comparable baselines. The accepted arm64 macOS topology has a 175.181-second ungated cold median, an 11.2-second post-install cold-cache rerun, and a 1.639-second steady-state warm median. MuPDF and qpdf compile/link medians total 87.673 seconds, or 50.0% of the cold run. A capacity-one CPU-heavy gate produced a 169.8-second median, only 3.1% faster, and missed the predeclared 10% acceptance threshold, so the production gate and test hook were removed. These figures are setup-lifecycle evidence and now live with the source/prebuilt decision they informed.

ACSM provisioning evidence. ADR-001 selects local, user-authorized Calibre ACSM Input plugin fulfillment behind a `calibre-acsm-fulfill <input.acsm> <output-dir>` interface and prohibits raw ACSM extraction, online conversion, secret persistence, and automated DRM removal. Setup must supply that interface without taking ownership of the user's authorization rights or sensitive activation data. The selected implementation uses the pinned GPLv3 upstream plugin's standalone scripts, a managed Python environment, generated fulfillment and authorization wrappers, explicit resolver precedence, and an offline doctor check that distinguishes installed tooling from missing authorization.

Prebuilt distribution evidence. The setup performance record measured the 175.181-second ungated cold median above. MuPDF and qpdf compile/link medians total 87.673 seconds, or 50.0% of that run, while serializing CPU-heavy build leaves improved the median by only 3.1% and missed the predeclared 10% threshold. The exact upstream MuPDF 1.27.2 release exposes source archives only, and the exact qpdf 12.3.2 release exposes source, Linux, and Windows assets but no macOS binaries, so an upstream-prebuilt option does not exist for either pinned tool. The public AutoShow repository had no Actions workflows and no releases when this decision was evaluated.

A local arm64 audit also found that the current qpdf source build is not a distributable fallback as built on the measured host: its `libqpdf` has absolute dynamic references to Homebrew `libjpeg` and OpenSSL. A no-cost proof build corrected that by pinning libjpeg-turbo 3.2.0 (`sha256:6f30092cef9fb839779646608f4ee14ae3cbac989c47fa05e841b0841f09878e`), statically linking qpdf and libjpeg, selecting qpdf's native crypto provider, and setting a macOS 15.0 deployment target. The resulting 3.8 MB arm64 `qpdf` linked only `/usr/lib/libz.1.dylib`, `/usr/lib/libc++.1.dylib`, and `/usr/lib/libSystem.B.dylib`; version, PDF validation, AES-256 encryption, and linearization checks passed. The existing 40 MB arm64 `mutool` likewise links only `/usr/lib/libSystem.B.dylib`. Unsigned proof ZIPs were 1.2 MB for qpdf and 29 MB for MuPDF, small enough that release storage is not a limiting force. This proves the portable qpdf recipe on one architecture; it does not substitute for the accepted two-architecture CI, signing, notarization, or clean-host verification gates below.

Why now: host provisioning, acquisition integrity, setup health/reporting, performance topology, and ACSM runtime supply are one lifecycle. Keeping them in separate records obscured the owner of downloads, provenance, staging, promotion, cleanup, doctor truth, and setup-only plugin mechanics. This consolidation gives host setup one authority while leaving source-format and fulfillment policy in ADR-001 and Docker distribution in ADR-015.

## Options Considered

### Host Dependency Source

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| Keep Homebrew on macOS | Lowest implementation cost; continues using familiar package names; preserves current installer branches | Keeps global package-manager mutation; remains dependent on user Homebrew state; preserves platform drift from existing `runtime/` patterns | No migration work; keeps six active Homebrew-managed install paths |
| **Runtime-managed macOS dependencies** | Aligns macOS with existing managed runtime patterns; supports version pinning, checksums, provenance metadata, and cacheable installs; avoids global package-manager mutation | Requires direct download, build, or runtime install flows for each affected tool; needs architecture and license review | Chosen. Removes six active Homebrew-managed install paths: FFmpeg/ffprobe, `yt-dlp`, `mutool`, `ebook-convert`, Tesseract, and OCRmyPDF |
| Manual user-installed dependencies | Simplest code; avoids maintaining binary download logic | Worse onboarding; weakens `setup` and `setup --doctor`; makes local runs less self-contained and harder to reproduce | Would turn setup into guidance for these tools instead of installation |
### macOS MuPDF and qpdf Delivery

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Keep hermetic source builds as the only path** | No binary-publishing, signing, hosting, credential, or release program; the installed result remains project-managed and reproducible | Retains the dominant measured cold cost | MuPDF + qpdf compile/link medians: 87.673s, 50.0% of the 175.181s cold median; chosen after repairing qpdf's accidental Homebrew linkage |
| Use upstream macOS prebuilts | Upstream would own production, signing, and release lifecycle | Rejected because neither pinned upstream release publishes a macOS CLI asset | MuPDF 1.27.2: 2 source assets only; qpdf 12.3.2: 0 macOS assets |
| Use Homebrew bottles or another third-party binary feed | Existing multi-architecture packaging infrastructure | Reintroduces a mutable package-manager dependency, weakens exact project pinning, and reverses the accepted no-Homebrew boundary | At least 2 external package recipes plus transitive bottle availability |
| Produce thin, pinned, signed and notarized AutoShow prebuilts with a source fallback | Would remove the measured compile path on eligible hosts | Requires an ongoing producer CI, Apple credential, signing, notarization, release, retention, and incident-response program | Investigated through the first five prebuilt phases, then withdrawn before any artifact was signed, published, configured, or activated |

### Setup Transfer, Health, and Reporting

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Stall-based timeouts with per-flow total budgets, streaming to resumable `.part` files, and checksum pins** | Transfer size stops deciding success; retries resume; memory stays bounded; large models receive integrity checks | Adds sidecar and resume-validity logic; hashing requires a completed-file read | Removes the roughly 200 Mbps floor; retries transfer only remaining bytes |
| Raise the flat timeout | Minimal change | Retains an arbitrary bandwidth floor, byte-zero restarts, and whole-body buffering | Roughly 20 minutes would be needed for 1.5 GB at 10 Mbps and would also delay genuine stalls |
| Shell out to `curl -C -` | Provides resume and progress | Reintroduces an external tool dependency and splits acquisition behavior | Rejected |
| Keep optimistic reporting and document caveats | No implementation risk | Cannot correct a false exit code or a doctor probe that bypasses actual prerequisites | Rejected |

### ACSM Fulfillment Provisioning

| Option | Pros | Cons | Quantitative Notes |
|---|---|---|---|
| **Setup-managed pinned Calibre ACSM Input plugin and standalone-script runtime** | Supplies ADR-001's selected interface through the existing Calibre dependency; pins provenance; supports Adobe ID, anonymous authorization, ADE activation import, activation backups, `fulfill.py`, and a user-facing authorization helper | Maintains a sensitive local activation environment and GPLv3 external-download boundary; fulfillment may contact Adobe or distributor servers | Selected; no plugin source is vendored or modified in AutoShow |
| Require users to install and locate the plugin scripts manually | Removes setup code | Weakens one-command setup and doctor truth; creates inconsistent resolver behavior | Rejected as the default; explicit overrides remain supported |
| Provision `libgourou` as a second managed ACSM stack | More CLI-native and headless | Duplicates the Calibre-centered toolchain and makes setup manage ADEPT activation directly | Rejected unless the ingestion decision changes |

## Decision

AutoShow provisions the local-lite toolchain through managed `runtime/` artifacts on a macOS host and `apt` on a Linux host. Nothing resolves through a global package manager AutoShow does not control, and nothing resolves implicitly through `PATH` on macOS.

Host provisioning. macOS setup must not invoke Homebrew for AutoShow-installed local dependencies. Affected tools are installed, resolved, and reported as project-local managed runtime dependencies under `runtime/`, following the existing patterns used for managed `uv`/`uvx`, whisper.cpp, llama.cpp, Defuddle, Python environments, and local model assets. Resolver precedence is:

1. Explicit user override where the tool supports one, such as an environment variable or config setting.
2. AutoShow-managed runtime binary, environment, or shim under `runtime/`.
3. `PATH` only for external prerequisites that AutoShow does not own, such as Xcode tooling, `cmake`, compilers, and optional host utilities.

This requires no CLI command-shape change. Existing setup entry points, including `bun autoshow setup`, `bun autoshow setup --step yt-dlp`, `bun autoshow setup --step calibre`, and `bun autoshow setup --doctor`, keep their current public shape while their macOS dependency source changes underneath.

Setup acquisition, reporting, and health. Every `downloadFile` transfer aborts on inactivity rather than total elapsed transfer time, streams to a resumable `<destination>.part` guarded by URL-matched metadata, and verifies checksum or minimum-size evidence before atomic completion. Shared transfer admission is bounded at the byte-moving leaves rather than around whole setup tasks. Setup reports per-step wall-clock timing, aggregate progress, disk state, provider-key counts, and ACSM authorization separately; the final message and process exit follow the summary health verdict. Doctor remains offline and checks the real artifacts and prerequisites that execution uses. Successful installers reclaim disposable build trees and conversion inputs while retaining intentional caches.

ACSM setup mechanics. `bun autoshow setup --step calibre` installs the document tools and ACSM fulfillment support; `bun autoshow setup --step acsm` installs only a pinned Calibre ACSM Input plugin ZIP under `runtime/tools/acsm-calibre-plugin`, its managed Python environment, `calibre-acsm-fulfill`, and `calibre-acsm-authorize`. Resolution is explicit `--bin-dir` first, the setup-managed `runtime/bin` wrapper second, then `PATH`. The generated fulfillment wrapper must satisfy ADR-001's exact one-EPUB-or-PDF output contract. `setup --doctor` separately reports wrapper health and authorization-file readiness, and setup/help text keeps Calibre conversion, fulfillment scripts, and user-controlled authorization distinct. Activation files, Adobe IDs, account data, keys, and backup ZIPs remain local sensitive state and never enter manifests, run artifacts, performance artifacts, or logs. AutoShow downloads the pinned upstream GPLv3 plugin instead of vendoring or modifying its code; any future vendoring, modification, or redistribution requires an explicit license review.

macOS MuPDF/qpdf delivery. AutoShow builds both tools from exact project-pinned source on the host and does not publish, select, or download AutoShow-built macOS executable archives. The qpdf recipe statically links the pinned libjpeg-turbo input, uses qpdf's native crypto provider, and rejects non-system dynamic-library paths. Both tools install through isolated staging, record source provenance and payload hashes, pass health checks, and atomically replace the managed runtime directory while preserving the prior healthy install on failure.

MuPDF retains its current release build flags. qpdf is a static CLI build with qpdf's native crypto provider and a pinned static libjpeg-turbo input; neither result may contain a non-system absolute dynamic-library path. The source install records a target compatible with the host that compiles it. The existing `runtime/bin` resolver shims remain the public managed paths, and explicit `--bin-dir` tools retain precedence without being required to carry AutoShow provenance.

This applies to:

- AutoShow-installed, runtime-managed dependencies on macOS.
- All setup downloads, transfer admission, integrity checks, retry/resume behavior, health guards, performance artifacts, progress, summaries, cleanup, and doctor reporting.
- Setup-managed ACSM plugin acquisition, managed Python and generated wrappers, resolver precedence, authorization helper/readiness reporting, and setup/help mechanics; ADR-001 remains authoritative for lawful user authorization, the fulfillment command contract, source classification, conversion metadata, and extraction behavior.
- Hermetic, pinned MuPDF and qpdf source builds on supported macOS hosts, with no project-published executable archive path.
- No user-managed tools, host build prerequisites, Linux host package management, or other platform setup behavior; no project-hosted prebuilt scope is active.
- No implicit hosted-provider key validation during setup; validating credentials would call provider APIs and remains an explicit opt-in workflow.

## Implementation Note

Host. Implemented on 2026-06-12. macOS setup resolves AutoShow-owned local tools through explicit override environment variables first, then managed artifacts under `runtime/`, without implicit `PATH` fallback. The managed macOS set covers FFmpeg/ffprobe, `yt-dlp`, MuPDF `mutool`, Calibre `ebook-convert`, Tesseract with `eng.traineddata`, and OCRmyPDF with managed Ghostscript/qpdf support. Every managed macOS download path is pinned with a SHA-256 checksum in the dependency metadata defaults or `config/deps.json` overrides.

Prebuilt decision. Withdrawn on 2026-08-13 after Phases 1 through 5 established the technical, portability, provenance, and redistribution boundaries. The project owner declined the permanent Apple credential, signing, notarization, protected-rehearsal, and release-operations burden required to distribute trusted macOS executables. Both toolchain Actions workflows, the signed producer implementation, signed release commands, protected-producer contracts, and the empty `macos-toolchain-release` environment were removed. No artifact was signed, notarized, drafted, published, configured, or activated, and Phases 7 through 9 were canceled. The retained source recipe, source provenance, staged atomic promotion, health checks, and offline doctor behavior are the final production design.

Setup reliability pass 1. Implemented on 2026-07-24. `DownloadProfile` gained `stallTimeoutMs` and `totalTimeoutMs`: `bun-fetch-default` has a 15-minute total budget and `bun-fetch-large-asset` has 60 minutes, both with a 60-second inactivity window; Whisper, Reverb, whisperfile, llamafile, and Calibre DMG flows use the large profile. A watchdog rearms on every chunk and retains “timed out” wording so `classifyFetchRetry` continues treating stalls as retryable. Bodies stream to `<destination>.part`; `PartialDownloadMetadata` binds the partial to its source URL; `206` appends, `200` after a Range request restarts cleanly, and `416`, checksum failure, or minimum-size failure discards invalid bytes while a stall preserves resumable bytes. Archive modes extract directly from the completed file instead of double-writing a second temporary copy.

The Whisper retry path no longer deletes the destination before each attempt. `tiny` and `large-v3-turbo` are checksum-pinned with exact sizes, while unpinned models require at least 10 MB instead of 1000 bytes. Linux `yt-dlp` uses a pinned release URL and published SHA-256 rather than `releases/latest`; the three Reverb repositories use pinned commit SHAs; llama setup reads the canonical dependency tag; and the Pinned Versions report derives from dependency metadata.

Setup reporting now records concurrent per-task wall-clock durations, reports disk use and ACSM authorization separately, describes hosted-provider readiness as `N/N present`, and returns the same health verdict used for the final message and process exit. Doctor added qpdf, the then-active CoreML encoders, real llama GGUF, Kitten cache, and ACSM activation-file checks. Setup reuses llama and Kitten caches only when their actual assets exist, follows Kitten snapshot symlinks and rejects dangling links, runs `mutool`/`tesseract`/`ebook-convert` health probes rather than existence tests, removes successful build trees and converted CoreML `.pt` inputs, and prunes `runtime/build`. At this pass, `runtime/bin/whisper-coreml-env` remained an intentional 654 MB conversion cache; the later CoreML retirement below supersedes that keep decision. These changes reclaimed roughly 3.3 GB from the audited install and made the remaining footprint visible.

ACSM setup implementation. `setupAcsmFulfillment` has an idempotent top-level health guard, downloads the pinned upstream plugin ZIP, extracts its standalone scripts under `runtime/tools/acsm-calibre-plugin`, creates the managed Python environment and generated `calibre-acsm-fulfill` / `calibre-acsm-authorize` wrappers, and emits authorization guidance only when readiness reporting calls for it. The wrapper's `--version` path proves executable identity but does not prove authorization; doctor therefore inspects the activation prerequisite separately. `--force-redownload` covers the managed plugin, environment, and wrappers without deleting user authorization state. Setup summaries and doctor expose the authorization action without copying activation/account/key paths into output. `bun autoshow setup --step acsm-authorize` remains the explicit user action when authorization is missing.

Setup reliability pass 2. Two observed post-fix runs, 307.4 seconds cold and 15.6 seconds warm, showed that per-step timing alone left 4m10s of apparent silence. Setup added a 30-second progress heartbeat and promoted llama download progress to human-visible output. `runSettledSetupTasks` separated nested failure aggregation from top-level timing. Kitten TTS adopted a true HuggingFace-cache guard, and `resolveHostedProviderChecks` began failing on unknown environment-variable names rather than silently dropping them.

The pass experimentally overlapped the `large-v3-turbo` download with `tiny` CoreML conversion and ran the Calibre/ACSM chain beside MuPDF→qpdf. The Whisper overlap was sound at 58 seconds versus 101 seconds serial and remained while CoreML conversion existed. The document-tools split was a measured regression: the cold run rose from 307.4 to 326.4 seconds; TTS rose 62→210 seconds, Reverb 85→171 seconds, OCR 98→144 seconds, and the same roughly 200 MB Calibre DMG took 170 rather than 74 seconds when moved into the opening burst. The split was reverted because concurrent tasks share network and CPU resources. Timing labels now explicitly say concurrent wall clock, disk accounting uses `du -sk` with a JavaScript fallback and binary units, and unconditional ACSM warnings were removed in favor of the summary and doctor. After cache guards, a steady-state warm rerun reached 1.8 seconds; the immediate post-install cold-cache rerun remained about 14 seconds because recently written binaries had to page from disk.

Setup reliability pass 3. The document chain is serial again: `setupDocumentTools` → `setupCalibreTools` → `setupAcsmFulfillment`; its independent health guards and the Whisper overlap remain. A FIFO counting semaphore in `setup-download/download-admission.ts` bounds actual transfers at `DEFAULT_SETUP_DOWNLOAD_CONCURRENCY = 3` in `fetchToPartFile` and HuggingFace's `downloadOneFile`. Slots cover network transfer only, not checksum, extraction, repo-tree listing, or whole task boundaries, so local work can overlap and a 1.5 GB hash cannot block a queued download.

One heartbeat ticker now aggregates quiet tasks as a single line such as `Still running: media tools 4m 10s · OCR 1m 30s`; `AsyncLocalStorage` activity attribution suppresses only tasks that produced recent output, and elapsed formatting uses minutes beyond 60 seconds. Reclaimed Build Trees reporting has a 10 MiB threshold because `du -sk` charges an empty APFS directory 8 KiB while the file-walk fallback reports zero; cleanup remains unconditional.

The third-pass cold run was 330 seconds versus 307.4 and 326.4 seconds in the earlier single samples. It recovered the per-task regressions—TTS 210→69 seconds, Reverb 171→95 seconds, OCR 144→101 seconds, and Calibre back to 74 seconds—but did not shorten the critical path. Document tools took 5m29s through serial MuPDF 112s → qpdf 140s → Calibre 74s → ACSM 2s, and the transfer budget did not gate Calibre. The remaining contention was CPU overlap between source builds and CoreML conversion. The 23-second cross-day total difference is not treated as a standalone regression. The immediate warm rerun was a 14.2-second cold-cache sample and no steady-state sample was claimed for this pass.

Setup reliability pass 4. `setup-performance.ts` records schema-versioned monotonic phases for archive preparation, configure/generate, compile/link, install/promote, health check, and cleanup under `runtime/setup-performance/`. Artifacts include relative timing, phase status, task timings, actual pairwise compile overlap, OS release, architecture, logical CPU count, effective parallel width, Bun and dependency versions, and source-cache state. They exclude credentials, URLs, home paths, and machine identifiers. Normal output keeps a concise Setup Step Timings table; verbose output may show detailed phases. Whisper CoreML conversion had already been retired before this pass, so the experiment measured the current Whisper compile/link leaf rather than preserving a benchmark around obsolete conversion work. Current setup no longer provisions or records CoreML conversion scripts, models, or environments and reports legacy CoreML artifacts as reclaimable.

The first attempted controlled matrix was discarded after exposing a reset-integrity defect: `--force-redownload all` did not explicitly name the qpdf wrapper, build tree, and tool tree, so qpdf survived and did not rebuild. Both the `all` and `calibre` reset sets now name those targets, and every accepted cold sample contains a qpdf compile/link phase. All accepted samples ran on the same arm64 macOS host on AC power with Darwin 25.5.0, Bun 1.3.14, 11 logical CPUs, pinned dependency versions, an eight-job managed-source cap, and Whisper width 11.

| Topology and cache state | Runs | Median | Decision use |
|---|---:|---:|---|
| Ungated cold baseline | 165.2s, 175.2s, 188.7s | **175.2s** | Selected cold baseline |
| Ungated post-install cold-cache rerun | 11.2s | 11.2s | Labeled separately |
| Ungated steady-state warm | 1.639s, 1.644s, 1.596s | **1.639s** | Selected warm baseline |
| Capacity-one CPU gate, cold | 170.4s, 169.8s, 169.0s | **169.8s** | 3.1% improvement; rejected below 10% threshold |
| Capacity-one CPU gate, post-install cold-cache rerun | 12.9s | 12.9s | Candidate diagnostic only |
| Capacity-one CPU gate, steady-state warm | 1.684s, 1.854s, 1.838s | 1.838s | Candidate diagnostic only |

| Component, baseline median | Archive | Configure | Compile/link | Install/promote | Health | Cleanup | Recorded total |
|---|---:|---:|---:|---:|---:|---:|---:|
| MuPDF | 5.227s | <0.001s | **45.645s** | <0.001s | 0.689s | 0.487s | 52.038s |
| qpdf | 1.088s | 4.175s | **42.027s** | 0.206s | 0.651s | 0.300s | 49.276s |

The phase sums reconcile within 0.30 ms. MuPDF and qpdf compile/link total 87.673 seconds, 50.0% of the 175.181-second cold median. Baseline Whisper/MuPDF overlap was 36.261 seconds and qpdf/ffmpeg overlap was 10.388 seconds. The capacity-one candidate reduced isolated MuPDF and qpdf compile/link to 33.627 and 34.837 seconds but shifted 9.749 seconds into qpdf admission and 32.613 seconds into Whisper admission, eliminating overlap without enough critical-path gain. Because the 3.1% median improvement missed the 10% gate and each source build already used eight of 11 logical CPUs, the candidate and its test hook were removed. The transfer admission budget remains because it governs a different resource. The measured compile share triggered the macOS prebuilt investigation recorded later in this ADR; that investigation stopped safely with source builds as the final topology.

Phase 1. Completed on 2026-08-13. Dependency metadata now pins libjpeg-turbo 3.2.0 to its exact release URL and SHA-256 alongside qpdf 12.3.2. The shared source recipe builds only static libjpeg, configures qpdf with shared libraries and implicit crypto disabled, requires and selects qpdf's native crypto provider, supplies only the pinned libjpeg include/library/package paths, builds the static qpdf CLI target, and rejects every dynamic-library reference outside Apple system paths or packaged loader/rpath paths before accepting the install. A recipe stamp makes normal setup replace the prior launchable-but-unhermetic qpdf tree once and reuse the portable result thereafter; the download flows, checksum validation, retry budgets, cached-source behavior, phase reporting, and source-only production selection remain in place.

The Phase 1 production-path verification ran on arm64 macOS 26.5.2 with AppleClang 21.0.0 and CMake 4.3.2. `bun autoshow setup --step calibre` downloaded and verified the exact qpdf/libjpeg-turbo pins, produced qpdf 12.3.2 as a thin arm64 Mach-O with a host-compatible macOS 26.0 deployment target, and installed a runtime tree containing only the build stamp and static `bin/qpdf`. `otool -L` reported only `/usr/lib/libz.1.dylib`, `/usr/lib/libc++.1.dylib`, and `/usr/lib/libSystem.B.dylib`. The installed managed path passed PDF validation, AES-256 encrypt/check/decrypt, linearization, and linearization validation against the pinned qpdf 12.3.2 fixture; a second normal setup reused it without a compile phase. No prebuilt metadata, URL, consumer, workflow, release, manifest schema, or doctor behavior was added.

Phase 2. Completed on 2026-08-13. MuPDF and qpdf source installs now share a closed `.autoshow-managed-artifact.json` schema at version 1. Each manifest records `distribution: source`, the exact tool version, Darwin platform, architecture, source-build deployment target, dependency versions/URLs/SHA-256 values, shared recipe flags, and the relative installed executable with its SHA-256. Health validation rejects missing or unknown schema fields, a wrong tool/version/platform/architecture, a deployment target newer than the host, source-pin or recipe drift, an unexpected payload inventory, and payload corruption. The setup guards require both valid provenance and an exact version launch before reusing a managed source tree; explicit `--bin-dir` overrides retain precedence and do not inherit an AutoShow provenance claim. Offline doctor applies the same manifest and payload validation before launch and reports `managed source <version> <platform>/<arch>` for healthy source installs.

Both source installers now build without mutating the working tool directory, assemble the runtime payload and manifest in a unique sibling staging directory, validate the staged binary, rename the prior directory to a unique backup, atomically rename staging into the stable tool path, activate the stable managed shim, validate again, and remove the backup only after success. A staging, activation, or post-promotion validation failure removes the candidate and restores the prior directory; shim replacement also uses a temporary sibling plus atomic rename. Interrupted staging trees are outside resolver and doctor paths. qpdf retains the Phase 1 static-libjpeg/native-crypto/linkage recipe, and MuPDF uses its release/no-X11/no-GLUT/no-objcopy recipe with host libcrypto discovery disabled while both record and use the host-compatible deployment target.

The Phase 2 production-path verification ran on the same arm64 macOS 26.5.2 host. Normal setup identified both pre-schema installations as unhealthy, rebuilt MuPDF 1.27.2 and qpdf 12.3.2, validated them from staging, and promoted manifests recording arm64 Darwin with a macOS 26.0 deployment target. The installed MuPDF payload hash is valid and `otool -L` reports only `/usr/lib/libSystem.B.dylib`; qpdf's payload hash is valid and its dynamic closure remains `/usr/lib/libz.1.dylib`, `/usr/lib/libc++.1.dylib`, and `/usr/lib/libSystem.B.dylib`. Both managed paths pass exact version launch checks, offline doctor reports `managed source 1.27.2 darwin/arm64` and `managed source 12.3.2 darwin/arm64`, no staging or backup directory remains, and a second `bun autoshow setup --step calibre` completed in 0.16s without compiling either tool. No prebuilt type, candidate injection, archive consumer, production URL, workflow, or release behavior was added.

Phase 3. Completed on 2026-08-13. The managed-artifact type and closed version 1 schema now cover both `distribution: source` and `distribution: prebuilt`, with separate closed embedded-payload and release-manifest parsers. A typed prebuilt candidate binds the exact tool/version/revision/platform/architecture/minimum macOS identity, canonical archive name, immutable URL, archive and release-manifest SHA-256 values, signing identity, and Team ID. Candidates can enter only through typed function parameters used by tests; production dependency metadata, setup flags, environment variables, and default URL resolution contain no candidate surface.

The dormant consumer makes an independent per-tool eligibility decision for Darwin macOS 15 or later on `arm64` or `x64`, preserves a healthy explicit override, and classifies failures as either availability or trust. Unsupported hosts, an absent candidate, clean-host minimum-OS incompatibility, and download unavailability after the three-attempt setup retry policy produce a visible source-fallback warning. Archive checksum, release or payload schema/identity, source pin, recipe, package inventory, payload hash, actual thin Mach-O architecture, signing identity, Team ID, accepted-notarization metadata, exact version launch, and post-promotion integrity failures are trust failures and stop without source fallback.

Candidate ZIPs download to a unique sibling work tree, are listed before extraction to reject absolute, traversal, duplicate, alternate-root, link, and special-file entries, and must contain one exact top-level tool directory. The consumer validates the embedded manifest and complete file inventory, hashes every package file, checks the executable with `lipo` and strict `codesign`, performs an exact version health check, writes merged `distribution: prebuilt` provenance, and uses the Phase 2 atomic promotion/rollback primitive. It never extracts over the working install; staging, activation, or stable-path validation failure restores the prior directory. Offline doctor uses the distribution-neutral validator, refuses a prebuilt without explicitly supplied pinned candidate metadata, applies the same file/architecture/signature/Team-ID/notarization checks without network access, and truthfully reports `managed prebuilt <version>-<revision> <platform>/<arch>` while retaining the source and override labels.

Phase 3 verification used typed local fixtures only. The focused setup matrix passed 112 tests with 0 failures and covered eligible MuPDF/qpdf behavior, closed schemas, the intentionally absent production candidate, unsupported OS/architecture, absent metadata, exhausted availability, independent per-tool fallback, every specified checksum/manifest/payload/version/architecture/signature/Team-ID/notary trust failure, traversal, prior-install preservation, activation and staged-health rollback, source/prebuilt doctor labels, corrupt provenance, wrong launched version, and override precedence. The real arm64 production path remained source-only: offline doctor still reported `managed source 1.27.2 darwin/arm64` and `managed source 12.3.2 darwin/arm64`, and `bun autoshow setup --step calibre` completed in 0.25s without a prebuilt lookup or source compile.

Phase 4. Completed on 2026-08-13. The now-removed `macOS Toolchain Unsigned Verification` workflow used a fixed `macos-15` arm64 and `macos-15-intel` x64 matrix, top-level `contents: read` permission, credential persistence disabled, full-commit-SHA pins for every action, no `pull_request_target`, secret, signing, notarization, attestation, publication, or release step, and separate build and clean-install jobs. Its producer downloaded and hashed the exact existing MuPDF, qpdf, and libjpeg-turbo source pins, used the shared build flags with `MACOSX_DEPLOYMENT_TARGET=15.0`, recorded the producer commit/run/runner/toolchain, ran available upstream checks and the repository PDF fixture, rejected a wrong thin architecture, deployment target, dynamic linkage, Developer ID identity, build path, or credential shape, and emitted per-tool ZIPs, closed payload and verification manifests, SPDX 2.3 JSON, and `SHA256SUMS`.

The retained Phase 4 unsigned verification artifacts have a separate `artifactKind: unsigned-verification` schema with `promotable: false`, `developerIdSigned: false`, `notarized: false`, and `reviewStatus: pending-phase-5`. Their names begin `autoshow-unsigned-verification-`, they do not contain the production `.autoshow-payload-manifest.json`, and the clean verifier confirms the production managed-artifact validator rejects them. The clean job downloads the exact workflow artifact, verifies `SHA256SUMS`, applies the same archive entry and atomic promotion primitives as the dormant consumer, checks the complete file inventory and SPDX/source binding, reruns architecture/target/linkage/unsigned/leak and functional checks from the promoted path, and independently exercises absent-candidate source fallback on the same native architecture. Production metadata and setup still contain no prebuilt or unsigned candidate, URL, checksum, flag, or environment override.

Local Phase 4 evidence covers the available arm64 architecture only and therefore is not the phase completion evidence. The focused setup matrix passes 124 tests with 0 failures. A real arm64 qpdf producer run passed all seven upstream CTest groups, exact 12.3.2/libjpeg-turbo 3.2.0 pins, native crypto, thin architecture, macOS 15.0 target, system-only closure, unsigned-state and build-path/credential scans, PDF validation, AES-256 encrypt/check/decrypt, linearization, SPDX/package generation, and clean staged installation; its temporary unsigned ZIP SHA-256 was `5ff43997704ca4541ae163c89ebe470c9767b4086d617ce80eafa4d7b55e30f6`. A real arm64 MuPDF run passed the available upstream extract buffer/misc/source checks, exact 1.27.2 pin and recipe, thin architecture, macOS 15.0 target, system-only closure, unsigned-state and leak scans, PDF inspect/render, SPDX/package generation, and clean staged installation; its temporary unsigned ZIP SHA-256 was `ef1d84b9149c6eeaf39784f31d3a2795d97341088c1d565c11f39cd3f8d4023a`. These local temporary digests prove the scripts but are not durable workflow artifacts and do not replace the formal two-architecture evidence.

Formal Phase 4 completion evidence is ordinary pull-request run [31686430140](https://github.com/ajcwebdev/autoshow-cli/actions/runs/31686430140) at producer commit `465319b157c619f03bca00243c1654ef2f6f1e00`. Both fixed-runner producer jobs passed their upstream, fixture, architecture, deployment-target, closure, unsigned-state, leak, package, manifest, and SPDX checks; both native clean-install jobs then verified the retained bundles from promoted runtime paths and rebuilt both tools through the independent absent-candidate source fallback. The retained 14-day workflow artifacts are `macos-toolchain-unsigned-arm64` with digest `sha256:0ac06d7fccaa1931133a435a16db599045a4e37a716466bcbb2c73b004f386d7` and `macos-toolchain-unsigned-x64` with digest `sha256:0235bb08a67b8dd86a9597ead40ea0b1d01fec39498655d20adb3d6fd96117aa`. These artifacts remain explicitly non-promotable and production metadata remains source-only.

After that one-time Phase 4 completion evidence was retained, the expensive unsigned arm64/x64 producer and source-fallback matrix was first changed to `workflow_dispatch` only and then deleted when Phase 6 closed the prebuilt track. No toolchain workflow now runs on staging, pull requests, pushes, or manual dispatch. Ordinary changes use the focused local contracts, `bun run check`, and `bun t --price`.

Phase 5. Completed on 2026-08-13. The project-owner [Phase 5 distribution approval record](#phase-5-distribution-approval-record) records separate exact approvals `ADR-004-P5-MUPDF-1.27.2-r1`, `ADR-004-P5-QPDF-12.3.2-r1`, and `ADR-004-P5-LIBJPEG-TURBO-3.2.0-r1`, with `github:ajcwebdev` acting in the designated repository-owner and project-compliance-owner roles. The review approves only the pinned source archives and SHA-256 values, the existing hermetic linkage recipes, release revision `r1`, exact same-release source assets, immutable AutoShow tag-source URLs, approved SPDX input packages/licenses, mandatory user notice, and closed package inventories. MuPDF is approved as an AGPL-3.0-or-later standalone subprocess distributed in an aggregate with AutoShow; its binary release must provide equivalent no-charge network access to the exact complete MuPDF source archive and AutoShow producer source from the same release page under AGPL section 6(d), so this plan uses no written offer.

The Phase 5 source audit found that `mutool` embeds the pinned MuPDF archive's codecs, font/shaping libraries, fonts, Adobe CMaps, and 48 TeX hyphenation-pattern resources. The approved package therefore replaces the Phase 4 preliminary single-file MuPDF notice with verbatim `COPYING` and `README` files, a deterministic consolidated notice assembled from every applicable pinned third-party/resource license input, and a generated distribution/source-access notice. qpdf retains its exact Apache license and notice, adds the exact libjpeg-turbo roll-up license, and carries the same generated source/review notice. The closed policy fixes four notice paths per tool and six total ZIP files per architecture. SPDX generation records exact producer input URLs, versions, digests, and declared licenses (`AGPL-3.0-or-later`, `Apache-2.0`, and `IJG AND BSD-3-Clause`), and clean verification reconstructs the entire expected SPDX document instead of checking package names alone.

Both unsigned and dormant final-release schemas now require `reviewStatus: approved`, the exact ordered approval references, review date, distinct reviewer-role identities, AutoShow tag-source archive, `writtenOfferRequired: false`, and the mandatory user-notice path. Outer verification/release manifests repeat the exact approval references. Missing, changed, reordered, or extra review IDs, notice paths, source assets, SBOM fields, or review facts fail as trust errors; all unsigned artifacts remain `promotable: false`, unsigned, unnotarized, conspicuously named, and structurally invalid as production artifacts. Production metadata and setup still contain no candidate, URL, checksum, flag, or environment override.

### Phase 5 Distribution Approval Record

#### Approval Status

- **Review Status:** Approved for the exact `r1` distribution described below
- **Review Date:** 2026-08-13
- **Repository Reviewer:** `github:ajcwebdev/repository-owner`
- **Project Compliance Reviewer:** `github:ajcwebdev/project-compliance-owner`
- **Scope:** MuPDF 1.27.2, qpdf 12.3.2, and the statically linked libjpeg-turbo 3.2.0 input used by the accepted macOS arm64/x64 producer

The same repository owner holds both designated roles in this sole-maintainer project. This is the project's recorded open-source distribution approval, not a representation that outside counsel supplied a legal opinion. It approves only the exact versions, source digests, build recipes, notices, package inventories, release revision, source-access plan, and reviewer identities below. Any change requires a new review reference before signing or publication.

#### Approval References

| Component | Approval Reference | Result |
|---|---|---|
| MuPDF 1.27.2 | `ADR-004-P5-MUPDF-1.27.2-r1` | Approved for separate-executable AGPL-3.0-or-later conveyance under the same-release source-access and notice conditions in this record |
| qpdf 12.3.2 | `ADR-004-P5-QPDF-12.3.2-r1` | Approved for Apache-2.0 binary redistribution with the exact upstream license and notice |
| libjpeg-turbo 3.2.0 | `ADR-004-P5-LIBJPEG-TURBO-3.2.0-r1` | Approved for static inclusion in qpdf under the IJG and Modified BSD terms with the exact upstream roll-up license |

#### Approved Source and Build Boundary

| Input | Exact Source Asset | SHA-256 | Approved Role |
|---|---|---|---|
| MuPDF 1.27.2 | `mupdf-1.27.2-source.tar.gz` | `553867b135303dc4c25ab67c5f234d8e900a0e36e66e8484d99adc05fe1e8737` | Complete upstream MuPDF source, bundled third-party code, fonts, CMaps, hyphenation data, build files, and license material for the standalone `mutool` executable |
| qpdf 12.3.2 | `qpdf-12.3.2.tar.gz` | `6cba2f9f2cd887d905faeb99e0e51a307b217920d1bbf3e9cfbb2e8178a2deda` | Complete upstream qpdf source for the standalone `qpdf` executable |
| libjpeg-turbo 3.2.0 | `libjpeg-turbo-3.2.0.tar.gz` | `6f30092cef9fb839779646608f4ee14ae3cbac989c47fa05e841b0841f09878e` | Complete upstream source for the static JPEG library linked into qpdf |

The approved build boundary is exactly the shared recipe already recorded by ADR-004: MuPDF is built with the repository's pinned release flags and no host crypto dependency; qpdf uses native crypto and only the pinned static libjpeg-turbo input; both outputs are thin executables with system-only dynamic linkage. AutoShow invokes each executable as a separately installed subprocess and does not link either program into the MIT-licensed AutoShow process. The MuPDF executable and AutoShow therefore ship as separate works in an aggregate; this approval does not relicense AutoShow or permit combining MuPDF code into AutoShow.

#### Approved License and Notice Inventory

The machine-readable source of truth is `managed-toolchain-distribution-policy.ts`. Each executable package contains its binary, the closed embedded manifest, and only the approved notice paths below. The manifest and clean verifier reject any missing, additional, reordered, or renamed path, and the archive/package hashes bind the exact notice bytes.

The MuPDF package contains:

- `licenses/mupdf-COPYING`, copied verbatim from the pinned source archive.
- `licenses/mupdf-README`, copied verbatim from the pinned source archive to preserve the copyright, AGPL-3.0-or-later election, and warranty notice.
- `licenses/mupdf-THIRD-PARTY-NOTICES.txt`, deterministically assembled from the pinned source archive with a source-path heading before every verbatim notice. Its approved inputs cover Brotli, Extract, FreeType and the FreeType/BDF/PCF terms, Gumbo, HarfBuzz, jbig2dec, Little CMS, IJG libjpeg, MuJS, OpenJPEG, zlib, Adobe CMaps, Droid/Source Han/Noto/Charis SIL/URW fonts, and all 48 embedded TeX hyphenation-pattern notices.
- `licenses/DISTRIBUTION-NOTICE.txt`, generated from the closed policy and naming the exact corresponding-source asset, AutoShow producer-source archive, approval identity, no-warranty statement, and AGPL section 6(d) network-source method.

The qpdf package contains:

- `licenses/qpdf-LICENSE.txt`, copied verbatim from qpdf 12.3.2.
- `licenses/qpdf-NOTICE.md`, copied verbatim from qpdf 12.3.2 and retaining its embedded-code attributions.
- `licenses/libjpeg-turbo-LICENSE.md`, copied verbatim from libjpeg-turbo 3.2.0 and retaining the IJG attribution requirement, IJG notice, and Modified BSD terms.
- `licenses/DISTRIBUTION-NOTICE.txt`, generated from the closed policy and naming the exact source assets, AutoShow producer-source archive, approval identities, and no-warranty statement.

No separate written offer is used. MuPDF object code will be offered by network download alongside equivalent no-charge access to `mupdf-1.27.2-source.tar.gz` and the exact AutoShow tag archive on the same immutable release page, following the network-conveyance method in AGPL section 6(d). The distribution notice is mandatory in both tool packages. qpdf and libjpeg-turbo do not require corresponding-source conveyance under their approved permissive terms, but their exact source archives remain mandatory release assets for provenance and rebuildability.

#### Approved Source References and Release Assets

The exact AutoShow producer source references are:

- MuPDF: `https://github.com/ajcwebdev/autoshow-cli/archive/refs/tags/toolchain-mupdf-1.27.2-r1.tar.gz`
- qpdf/libjpeg-turbo: `https://github.com/ajcwebdev/autoshow-cli/archive/refs/tags/toolchain-qpdf-12.3.2-r1.tar.gz`

The MuPDF release must include both architecture ZIPs, both release manifests, both SPDX SBOMs, `SHA256SUMS`, attestations, the exact MuPDF source asset, and the tag source archive. The qpdf release must include the equivalent binary/manifest/SBOM/checksum/attestation set, the exact qpdf and libjpeg-turbo source assets, and the tag source archive. Source directions must appear next to the downloadable binary assets and releases/tags must remain immutable while a supported AutoShow revision references them.

#### Approved SBOM and Package Inventories

The SPDX 2.3 package inventory records exact independently downloaded producer inputs rather than inventing separate download identities for components already contained in the checksum-pinned MuPDF source archive:

| Tool Package | SPDX Source Packages | Declared Licenses |
|---|---|---|
| MuPDF | `mupdf` 1.27.2 at its exact URL and SHA-256 | `AGPL-3.0-or-later` |
| qpdf | `qpdf` 12.3.2 and `libjpeg-turbo` 3.2.0 at their exact URLs and SHA-256 values | `Apache-2.0`; `IJG AND BSD-3-Clause` |

The SBOM also records the exact executable path and SHA-256. The clean verifier reconstructs the complete expected SPDX document from the closed payload manifest and rejects any field or inventory drift. MuPDF's bundled component and resource obligations are captured by the exact complete source asset and the consolidated notice inputs above; they may not be removed merely because the top-level SPDX input inventory has one package.

Each unsigned or final executable ZIP has one top-level tool directory and exactly six regular files: the executable, its embedded payload manifest, and the four tool-specific approved notice files. No headers, static libraries, build trees, alternate executables, or unreviewed documentation may enter the archive. The outer verification/release manifest must repeat the exact component approval references, and both the outer and embedded references must match the closed repository policy.

#### Sign-off and Change Control

`github:ajcwebdev/repository-owner` approves the repository, packaging, retention, source-availability, and release-boundary obligations recorded here. `github:ajcwebdev/project-compliance-owner` approves the exact MuPDF, qpdf, and libjpeg-turbo redistribution and notice plans recorded here. MuPDF publication remains conditioned on satisfying this record byte-for-byte; the approval is void for any other version, source digest, recipe, linked dependency, package path, SPDX inventory, source reference, release revision, or reviewer identity.

Phase 5 does not authorize signing, notarization, release creation, publication, or production metadata activation. Phase 6 remains the first phase allowed to introduce protected signing and draft-publication controls.

Phase 6 closure. Ready pull request [#8](https://github.com/ajcwebdev/autoshow-cli/pull/8) briefly placed a manual protected workflow on `main` at merge commit `a3429b7d6612ee7da55ecac713c9a3cf42fcb7a6`, but no credential was provisioned and no protected job or release was run. The project then chose the Phase 5 safe-stop boundary: remove the publication machinery and make source-only operation final. Repository release immutability remains enabled as a harmless general protection, while the empty release environment and both toolchain workflows are gone. The local contracts assert that neither workflow can silently return. This closes the ADR without weakening signing requirements for distributed executables: AutoShow simply does not distribute them.

> Correction (2026-08-07): two things this ADR describes as shipped no longer exist, both retired by later decisions rather than by this one being reversed.
>
> - **OCRmyPDF is gone.** [ADR-009](ADR-009-extract-execution-and-artifact-contracts.md) chose Tesseract as the only local OCR engine, on the recorded finding that Tesseract was the fastest and highest-mean local engine while avoiding OCRmyPDF's dependency and maintenance cost. Every mention of OCRmyPDF above — in the local-lite tool set, the Homebrew paths this ADR removed, the managed macOS set, the packaging risks, and the `ocr-local/ocrmypdf/ocrmypdf.ts` reference below — is history. Managed Ghostscript went with it; `qpdf` is still managed.
> - **`AUTOSHOW_BIN_DIR` is no longer a resolver input.** The precedence in `resolveRuntimeToolInfo` is unchanged in shape — explicit override, then managed artifact under `runtime/`, then `PATH` for tools AutoShow does not own — but its first tier is now fed by the global `--bin-dir` flag only. [ADR-005](ADR-005-reduce-environment-variable-surface-area.md) introduced `AUTOSHOW_BIN_DIR` in its pass 3 as the consolidation of six per-tool `AUTOSHOW_*_BIN` vars; production stopped reading it when the flag replaced it. The name survives in `test/test-utils/test-helpers.ts` as a harness convention only, and is translated into `--bin-dir` before the child process sees it. Read "`--bin-dir`/`AUTOSHOW_BIN_DIR`" above as "`--bin-dir`".

## Rationale

Host provisioning:

- The project already treats many local capabilities as managed runtime assets: `runtime/bin/uv`, `runtime/bin/uvx`, `runtime/bin/whisper-cli`, `runtime/bin/llama-server`, `runtime/defuddle/`, Python environments under `runtime/bin/`, and model assets under `runtime/models/`. Keeping macOS media, document, and OCR tools on Homebrew was the outlier.
- Runtime-managed macOS dependencies improve reproducibility because setup can pin versions, validate checksums, record provenance, and reuse cached artifacts. They also avoid mutating global system package state, which matters for developer machines and CI agents that may already have unrelated Homebrew installations.
- Using the same dependency-management model across local tools reduces platform drift. A setup or doctor report can explain whether AutoShow is using a user override, a managed runtime artifact, or an external prerequisite instead of implicitly relying on whatever Homebrew installed globally.
- The target pattern already existed in the codebase: on Linux, setup downloads the official `yt-dlp` release binary directly to `ytDlpManagedBinaryPath` instead of using a system package manager (`src/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio.ts`). The macOS migration for `yt-dlp` was therefore reuse of an existing flow rather than new work, which lowered the cost of the first migration step.

MuPDF/qpdf source-only conclusion:

- The removable compile/link work is half of the selected cold median, but exact upstream macOS CLI artifacts do not exist for the pinned versions, so avoiding that time would require AutoShow to own binary production and release operations.
- The owner does not want a standing Apple Developer credential, signing, notarization, or protected release workflow for these helper tools. That operational boundary outweighs the cold-install optimization.
- A static, native-crypto qpdf recipe removes accidental Homebrew and OpenSSL runtime dependencies and passed a local functional proof. Reusing that recipe for producer CI and local fallback prevents the two paths from drifting into different products.
- Unsigned AutoShow-built executables are not an acceptable substitute. Keeping source builds avoids weakening the trust contract while preserving exact pins, provenance, atomic promotion, and offline health verification.

Setup acquisition, reporting, and ACSM provisioning:

- A stall timeout is correct for both small and multi-gigabyte assets; a flat total-transfer deadline always embeds a bandwidth assumption. Resumable disk streaming makes retries useful and bounds memory, while hashing the completed file composes cleanly with resumed transfers.
- Admission belongs at the shared byte-moving resource, not at whole task boundaries. Network and CPU experiments are retained because they show why the accepted three-transfer budget and ungated compile topology are different decisions.
- The exit status must follow the same verdict as the human summary, and doctor must inspect the artifact or prerequisite that execution actually uses rather than an easy version or marker proxy.
- The Calibre plugin is already selected by the ingestion policy and emits exactly the EPUB/PDF forms the pipeline accepts. Provisioning its pinned external scripts and managed interpreter beside Calibre keeps setup coherent without making extraction own installer paths or sensitive activation state.
- The historical decision to retain `runtime/bin/whisper-coreml-env` avoided repeated multi-minute Torch installation while CoreML conversion existed; its later retirement makes that environment reclaimable rather than persistent. Optional `config/deps.json` remains a supported typed metadata override. HuggingFace retains its separate 120-second per-file budget/classifier while sharing the global transfer-admission gate.

## Consequences

Positive outcomes:

- macOS setup no longer mutates global Homebrew state for AutoShow-owned tools.
- Local dependency versions can be pinned, verified, and cached with project artifacts.
- `setup --doctor` reports managed runtime sources consistently.
- macOS dependency management aligns with existing managed uv, whisper.cpp, llama.cpp, Defuddle, Python environment, and model-asset patterns.
- CI and developer setup become less sensitive to machine-local package manager state.
- Managed manifests make the installed source tool's target, version, and integrity inspectable offline.
- The qpdf fallback stops depending on absolute Homebrew library paths.
- Large downloads survive slow links and interruptions without whole-body buffering or byte-zero retries, and pinned model integrity fails closed.
- Setup summaries, process exits, and offline doctor checks agree on readiness; qpdf, current local model assets, and ACSM authorization are checked at their real use boundaries, while retired CoreML artifacts are identified for reclamation rather than provisioned.
- Warm setup reuses healthy llama assets without stopping a llama server the user may already be running.
- Disposable build/conversion inputs are reclaimed, intentional caches remain, and performance artifacts make cold, post-install, and steady-state behavior auditable.
- The selected ACSM plugin runtime is one setup command away while lawful authorization and sensitive activation state remain explicitly user-controlled.

Negative outcomes:

- Setup maintainers must own more dependency-specific install and update logic.
- MuPDF and qpdf retain their measured source-build cost on a cold host.
- OCRmyPDF and Tesseract may require more careful runtime packaging than single static binaries.
- Calibre was installed as a Homebrew cask, meaning a GUI app bundle rather than a CLI formula; replacing it required sourcing `ebook-convert` from the official Calibre app distribution, which is materially harder than swapping in a static binary.
- Existing users with working Homebrew installs may see a one-time runtime download or build cost.
- The Phase 3–5 prebuilt research remains historical evidence and local contract coverage, but no production candidate, URL, checksum pin, or release lifecycle is maintained.
- Resumable downloads maintain `.part` and `.part.json` state; completed-file checksum verification adds one full read, roughly 1–2 seconds for a 1.5 GB model on the measured NVMe host.
- Setup now exits non-zero for partial installs that older automation may have accepted, and upstream same-name model republishing becomes a visible checksum failure.
- The setup authority maintains the pinned GPLv3 ACSM plugin, managed Python environment, wrappers, resolver, and readiness checks; fulfillment can still depend on Adobe/distributor availability and user authorization.

## Trade-offs

| Gains | Sacrifices |
|---|---|
| Reproducible macOS setup with pinned versions, checksum validation, and provenance metadata | The project owns install and update logic for six tools previously maintained by Homebrew |
| No mutation of global Homebrew state for AutoShow-owned tools | MuPDF and qpdf compile locally on a cold host |
| Uniform resolver and doctor reporting across managed local dependencies | Calibre, OCRmyPDF, and Tesseract require more involved packaging |
| Cacheable project-local artifacts across developer machines and CI | Existing users may incur a one-time managed-runtime download or build |
| Avoid an Apple credential and binary release program | Retain 87.673s of measured MuPDF/qpdf compile/link work on eligible cold installs |
| Hermetic static qpdf runtime with native crypto | Add and maintain a pinned libjpeg-turbo source input for qpdf builds |
| Offline installed-file provenance and integrity checks | Pay a small doctor/setup hashing cost and maintain a versioned manifest schema |
| Do not distribute executables without the full Apple trust chain | Give up project-hosted macOS prebuilts unless a future ADR accepts their operational cost |
| Transfer-size-independent, resumable, checksum-verified downloads | Maintain partial-file metadata, stall/total profiles, and a completed-file hash pass |
| Truthful summary, exit code, doctor, progress, and disk reporting | Existing partial installs become explicit failures and setup owns more health probes |
| Bounded transfer concurrency with measured ungated compile topology | Preserve two resource-specific scheduling rules and their evidence |
| One setup-managed ACSM runtime behind ADR-001's stable interface | Maintain external plugin provenance and keep sensitive authorization state out of project artifacts |

## Keep (with rationale)

- Retired Whisper CoreML environments and model artifacts are reclaimable and are no longer provisioned or recorded; the earlier 654 MB cache-retention decision applied only while conversion remained active.
- `config/deps.json` remains an optional supported override merged over defaults rather than dead configuration.
- HuggingFace downloads keep their own 120-second per-file budget and classifier but participate in shared transfer admission.

## Retired macOS Prebuilt Distribution Contract (Historical)

- **Decision State:** Withdrawn before signing, publication, or production activation
- **Active Delivery:** Exact pinned source builds only
- **Historical Targets:** macOS 15.0 or later on `arm64` and `x64`
- **Historical Scope:** MuPDF `mutool` 1.27.2 and qpdf 12.3.2 only
- **Trigger Evidence:** 87.673s of compile/link work, 50.0% of the 175.181s selected cold median

The following contract is retained only to explain the completed Phase 3–5 investigation and why unsigned distribution was not substituted when the protected path was withdrawn. It is not an active implementation plan. Any future project-hosted macOS prebuilt proposal requires a new ADR and may not infer approval, credentials, workflow authority, or release permission from this historical section.

### Producer CI and artifact closure

The explored producer design placed an unprivileged verification path and a protected publication path in the AutoShow repository. Its reviewed workflow revisions used full-commit-SHA action pins, kept signing and release secrets out of unprivileged work, and limited protected publication permissions. Both workflows and the protected environment were removed before publication, so this paragraph records the rejected design rather than current automation.

The build matrix uses the fixed standard GitHub-hosted labels `macos-15` for `arm64` and `macos-15-intel` for `x64`, never a moving `-latest` label. Both set `MACOSX_DEPLOYMENT_TARGET=15.0`, record the runner image version, Xcode, SDK, AppleClang, CMake, make, and build flags, and produce thin Mach-O executables. A runner-label change, build-flag change, signing-identity change, packaging change, or source change requires a new release revision; an existing artifact is never overwritten.

MuPDF is built from the exact source URL and SHA-256 already pinned for version 1.27.2 with `build=release`, `HAVE_X11=no`, `HAVE_GLUT=no`, `HAVE_OBJCOPY=no`, and `HAVE_LIBCRYPTO=no` so the result cannot inherit an unpinned Homebrew OpenSSL from `pkg-config`. qpdf is built from the exact qpdf 12.3.2 source pin plus libjpeg-turbo 3.2.0 source pin, with libjpeg-turbo's supported JPEG 8 ABI, `pkg-config` disabled, explicit header and archive paths to the pinned static `libjpeg.a`, and `BUILD_SHARED_LIBS=OFF`, `BUILD_STATIC_LIBS=ON`, `USE_IMPLICIT_CRYPTO=OFF`, `REQUIRE_CRYPTO_NATIVE=ON`, and `DEFAULT_CRYPTO=native`. The same functions and feature/linkage flags back the local source fallback; only the recorded deployment target and host toolchain may differ so older eligible source-build hosts do not produce an unusable macOS 15 binary. Producer CI and fallback builds reject `/opt/homebrew`, `/usr/local`, another workspace, or any other non-system absolute dependency reported by `otool -L`; the producer performs this closure check before the upstream qpdf tests, which emit their detailed failure output in CI. Final artifacts may reference Apple system libraries or packaged `@loader_path`/`@rpath` libraries only. The accepted first qpdf package is static and therefore contains no packaged dynamic library.

Each matrix job runs upstream tests appropriate to the built target and clean-fixture command checks before signing. At minimum, MuPDF must report the exact version and successfully inspect and render a repository-owned PDF fixture; qpdf must report the exact version and pass PDF validation, AES-256 encrypt/decrypt validation, and linearization checks. CI also asserts the thin architecture, deployment target, allowed dynamic-library closure, expected package file list, and absence of build paths, credentials, and quarantine-bypass commands. A second clean-host job downloads the exact candidate ZIP, exercises the same installer staging path, runs both tools from the promoted runtime paths, and tests the source fallback on each architecture.

### Package shape, provenance, and integrity

MuPDF and qpdf are released separately so either tool can update or fall back without coupling the other. The first immutable tags and executable asset names are:

| Tool | Release Tag | Executable Assets |
|---|---|---|
| MuPDF 1.27.2 | `toolchain-mupdf-1.27.2-r1` | `autoshow-mupdf-1.27.2-r1-darwin-arm64.zip`, `autoshow-mupdf-1.27.2-r1-darwin-x64.zip` |
| qpdf 12.3.2 | `toolchain-qpdf-12.3.2-r1` | `autoshow-qpdf-12.3.2-r1-darwin-arm64.zip`, `autoshow-qpdf-12.3.2-r1-darwin-x64.zip` |

`r1` is the packaging/build revision and increments whenever an input other than the upstream tool version changes. Each release also carries `SHA256SUMS`, a release manifest, an SPDX SBOM, provenance attestations, required notices, and the exact verified upstream source archives. The MuPDF release includes the exact corresponding source archive; the qpdf release includes the exact qpdf and libjpeg-turbo source archives. GitHub's tag source archive supplies the exact AutoShow producer scripts at the release commit.

Each executable ZIP has one top-level tool directory containing only the runtime files AutoShow consumes, required licenses/notices, and `.autoshow-payload-manifest.json`. Development headers, static libraries, build trees, and unrelated qpdf utilities are excluded. The embedded payload manifest and post-notarization release manifest are both schema-versioned and collectively record all of the following without creating a self-referential archive hash:

| Field Group | Required Values |
|---|---|
| Identity | Tool, upstream version, packaging revision, platform, architecture, minimum macOS version, manifest schema version |
| Source | Every source URL, source SHA-256, upstream source reference, build flags |
| Producer | AutoShow repository and commit, workflow name/run URL, runner label/image, compiler/SDK/build-tool versions |
| Payload | Relative runtime file list and SHA-256 per executable or packaged library; no absolute host paths |
| Trust | Payload manifest: signing identity and Team ID. Release manifest: notarization submission ID/status, final archive name and SHA-256, SBOM name, provenance subject digest |
| License | Primary license, exact included notice paths, corresponding-source asset names, AutoShow tag-source archive, written-offer/user-notice decision, review date and role identities, completed component review references |

The final ZIP SHA-256, release-manifest identity, accepted notarization record, and exact immutable release URL are pinned in `dependency-metadata.ts`; setup never resolves `latest`, a branch, or an unversioned asset. The existing resumable download layer validates the archive hash before extraction. Setup then parses the embedded payload manifest with a closed schema, compares it to dependency metadata and the host, hashes every runtime payload file, validates signatures, runs tool health checks, and only then atomically replaces the tool directory, writes `.autoshow-managed-artifact.json` by merging the verified payload facts with the pinned release facts, and regenerates the managed shim. The distributed ZIP is never mutated after notarization and is never extracted over a working install. Any failure removes staging and leaves the previous healthy install intact.

GitHub build provenance is generated for each final ZIP and SBOM with GitHub's first-party artifact-attestation action. Promotion verifies those attestations against `ajcwebdev/autoshow-cli` before release publication. Runtime setup and doctor do not depend on `gh`, Sigstore, or network access: their trust root is the reviewed repository metadata pin plus the embedded manifest, payload hashes, and Apple signature. Signed ZIP bytes are not promised to be bit-for-bit reproducible because secure timestamps and notarization are variable; the recorded source pins, toolchain, flags, unsigned payload hashes, and producer commit make the build independently replayable.

### Hosting, retention, update, and rollback

Artifacts are hosted only as GitHub Release assets in `ajcwebdev/autoshow-cli`. Release immutability must be enabled before the first tool release. CI creates a draft release, uploads the complete asset set, verifies names, hashes, attestations, source/license material, and both architecture jobs, and then publishes it; published tool releases are never drafts. Release assets are the durable distribution surface, not expiring workflow artifacts.

An immutable tool release is retained indefinitely while any supported AutoShow revision pins it and is not routinely deleted afterward. If legal or security response requires removal, maintainers first ship dependency metadata that disables the affected prebuilt and restores the independently pinned source fallback, then delete the whole release if required; its tag name is never reused. Routine updates create a new upstream-version/revision tag and a reviewed metadata change only after both architectures pass. Rollback repins an older still-acceptable immutable release in a new AutoShow change or disables the prebuilt; assets are never replaced in place.

### License, signing, notarization, and quarantine gates

MuPDF is AGPL-3.0-or-later or commercially licensed. Phase 5 approved the exact `r1` subprocess/distribution boundary, corresponding-source asset, bundled-code/resource notice inventory, AutoShow release-tag source archive, AGPL section 6(d) same-release network-source method, mandatory user notice, and no-written-offer decision in [the recorded distribution review](#phase-5-distribution-approval-record). Publication must match that policy exactly. If a future change no longer fits the approved aggregate or source-conveyance boundary, AutoShow must obtain an appropriate commercial license or keep the affected MuPDF prebuilt source-only and return to this ADR; CI may not sign or publish on an assumption of compliance.

qpdf is Apache-2.0 licensed. Its archive includes qpdf's `LICENSE.txt` and `NOTICE.md`; because the accepted static build embeds libjpeg-turbo, it also includes libjpeg-turbo's license and source reference. The SPDX SBOM and third-party notice inventory are reviewed for each source-version or dependency change. Neither tool is promoted when the license inventory differs from the reviewed manifest.

Every final Mach-O executable and any future packaged Mach-O library is signed after all mutation with an Apple Developer ID Application identity, hardened runtime, and secure timestamp. The expected Team ID is recorded in release and dependency metadata. CI verifies signatures strictly, packages the signed files into the exact ZIP that will be distributed, submits that ZIP with `notarytool --wait` without `--force`, requires an Accepted result, records the submission ID and log, and attests the final ZIP. A clean job applies quarantine to the downloaded archive, extracts through the production path, and confirms Gatekeeper acceptance and successful launch. Setup never clears `com.apple.quarantine`, disables Gatekeeper, or substitutes ad hoc signing. Signing and notarization credentials are available only to the protected publication environment and never to pull-request jobs.

### Eligibility, fallback, and doctor behavior

Prebuilt selection is per tool and requires `darwin`, `arm64` or `x64`, macOS 15.0 or later, an exact metadata entry, and no explicit `--bin-dir` tool already satisfying health checks. Older macOS, another architecture, an intentionally absent metadata entry, HTTP unavailability after the existing retry policy, or a clean-host incompatibility classified before trust verification produces a visible warning and runs the independently checksummed source recipe for that tool. Checksum, manifest, payload hash, architecture, version, signing identity, notarization metadata, or post-extraction integrity failures are security/publisher failures and stop setup without source fallback. No production environment variable or hidden URL override is added to select an unreviewed artifact.

Both prebuilt and source installations write the same schema-versioned managed-artifact manifest under the tool directory. A source manifest records `distribution: source`, source pins, build flags, host target, and installed payload hashes; a prebuilt manifest records `distribution: prebuilt` plus release and trust fields. Setup's initial health guard requires a valid manifest in addition to launchability, so an old, partial, or provenance-free managed tree is repaired rather than silently reused.

`setup --doctor` remains offline. For managed MuPDF and qpdf it validates manifest schema, expected version, distribution type, current architecture and platform, minimum-OS compatibility, installed payload hashes, and launch/version behavior. For a prebuilt it additionally runs strict Apple code-signature verification and checks the expected Team ID and recorded accepted notarization metadata. Doctor reports `managed prebuilt <version>-<revision> <platform>/<arch>` or `managed source <version> <platform>/<arch>` so the source is truthful. Missing or inconsistent provenance is warning-level unhealthy state with `bun autoshow setup --step calibre` as the repair. User overrides remain launch/version checked and are labeled `override`; AutoShow does not claim provenance for them.

### Promotion and final acceptance

Prebuilt URLs may enter default dependency metadata only when all of these gates pass for both tools and both architectures:

1. Producer and fallback recipes use the exact source pins and pass unit, upstream, fixture, architecture, deployment-target, dynamic-link closure, package-content, and clean-install checks.
2. Embedded manifests, SHA-256 pins, SPDX SBOMs, build attestations, immutable-release settings, retention ownership, and rollback instructions are complete and independently reviewed.
3. MuPDF and qpdf/libjpeg-turbo redistribution reviews approve the exact release contents.
4. Developer ID signing, notarization, quarantine/Gatekeeper, and protected-secret tests pass on both architectures.
5. Installer tests cover prebuilt success, per-tool availability fallback, unsupported OS/architecture fallback, atomic rollback, and hard failure for every trust mismatch; doctor covers both distribution types and overrides without network access.
6. On the same arm64 host and reset procedure used by the setup performance matrix above, three prebuilt cold runs improve the 175.181s median by at least the same predeclared 10% threshold, every run is healthy, no MuPDF/qpdf compile phase occurs, and the three-run steady-state warm median regresses by no more than 10% from 1.639s. The x64 path must pass clean cold/warm functional runs even though the setup performance record has no x64 timing baseline.

The project retired this contract before running the six promotion gates. Source builds are the final active path. Any future prebuilt work, including FFmpeg, requires a new decision rather than resuming this sequence.

## Implementation Plan

The original prebuilt investigation was divided into nine ordered phases with an explicit safe-stop boundary after each phase. Phases 1 through 5 completed, the project stopped at that boundary, and Phases 6 through 9 are withdrawn. The source-build improvements from Phases 1 and 2 remain production behavior; later prebuilt work remains dormant research or historical evidence. Every implementation change runs `bun run check`, `bun t --price`, and `git diff --check` plus targeted local/no-cost verification; no phase authorizes provider, hosted-generation, or other paid/quota-risk commands.

### Phase 1: Make the qpdf source fallback hermetic

- **Status:** Complete on 2026-08-13.
- **Prerequisites:** The accepted qpdf 12.3.2 and libjpeg-turbo 3.2.0 source URLs and SHA-256 pins in this ADR.
- **Deliverable:** Add the libjpeg-turbo pin to dependency metadata, replace the current qpdf source build with one shared static-libjpeg/native-crypto recipe, and reject non-system absolute dynamic-library references. Do not add a prebuilt type, URL, workflow, or release behavior.
- **Verification:** Run metadata/build-argument unit tests; build qpdf from the exact pins on the available macOS architecture; assert version, thin architecture, deployment target, system-only linkage, PDF validation, AES-256 encrypt/decrypt, and linearization; then run `bun run check`, `bun t --price`, and `git diff --check`.
- **Complete when:** A normal source install produces a healthy portable qpdf on the tested architecture, existing source retry/reporting behavior is preserved, and source builds remain the only production path. Reverting this phase restores the prior qpdf recipe without affecting any later schema or release surface.

### Phase 2: Add source-install provenance and atomic promotion

- **Status:** Complete on 2026-08-13.
- **Prerequisites:** Phase 1 complete.
- **Deliverable:** Define the closed, schema-versioned managed-artifact manifest; make MuPDF and qpdf source installs write `distribution: source` provenance; install through per-tool staging and atomic promotion; preserve the previous healthy directory on failure; and make the setup health guard plus offline doctor validate source manifests, hashes, platform, architecture, version, and launch behavior.
- **Verification:** Add local/no-cost tests for schema acceptance/rejection, source manifests, interrupted staging, atomic replacement, preservation of a healthy prior install, repair of provenance-free or corrupt managed trees, truthful doctor labels, and `--bin-dir` precedence; then run the shared verification baseline.
- **Complete when:** Both source-installed tools are healthy only with valid provenance, every failed install leaves the previous healthy install usable, and no prebuilt metadata or network path exists. This phase can be reverted without changing the Phase 1 build recipe.

### Phase 3: Add a dormant prebuilt consumer

- **Status:** Complete on 2026-08-13.
- **Prerequisites:** Phase 2 complete.
- **Deliverable:** Add the typed prebuilt metadata and embedded/release manifest parsers, per-tool eligibility decision, staged archive consumer, strict payload/signature/Team-ID/notarization checks, availability-versus-trust failure classifier, source fallback dispatch, and offline prebuilt doctor checks. Exercise candidates only through typed test dependency injection; add no production flag, environment variable, configured asset, or default release URL.
- **Verification:** Use repository fixtures to cover eligible success, unsupported OS/architecture, absent candidate, exhausted availability retries, per-tool fallback, checksum/manifest/payload/version/architecture/signature/notary mismatches, archive traversal, atomic rollback, prior-install preservation, doctor behavior for both distributions, and override precedence. Availability cases must fall back visibly; every trust case must fail closed without falling back.
- **Complete when:** The dormant consumer contract passes all fixture tests while production setup still has no candidate to select and therefore remains source-only. Removing this phase leaves the source manifest and source installer from Phase 2 intact.

### Phase 4: Produce unsigned verification artifacts on both architectures

- **Status:** Complete historical evidence on 2026-08-13; ordinary pull-request run [31686430140](https://github.com/ajcwebdev/autoshow-cli/actions/runs/31686430140) passed both producer and clean-install matrix architectures, with both retained workflow-artifact digests recorded in the Implementation Note and Test Plan. The workflow was subsequently removed and cannot run on staging, pull requests, pushes, or manual dispatch.
- **Prerequisites:** Phase 3 complete.
- **Deliverable:** Add reusable producer/package scripts and an unprivileged GitHub Actions matrix on fixed `macos-15` arm64 and `macos-15-intel` x64 runners. Build exact MuPDF/qpdf/libjpeg-turbo pins, run upstream and fixture checks, generate payload manifests and SPDX SBOMs, reject forbidden linkage/content, and clean-install each candidate through the Phase 3 consumer. Pin actions by full commit SHA and expose no signing, notarization, publication, or release secret. Unsigned outputs must be labeled non-promotable and must not use final release names in production metadata.
- **Verification:** Require both matrix legs to prove versions, architectures, deployment targets, linkage closure, expected package contents, absence of build paths or credentials, MuPDF inspect/render, qpdf validate/encrypt/decrypt/linearize, clean candidate installation, and independent source fallback. Run the shared verification baseline locally.
- **Complete when:** One ordinary pull-request run passes on both architectures and retains its run URL and artifact digests as evidence, while no release or production URL exists. The workflow can be removed without affecting host source setup or the dormant consumer.

### Phase 5: Close redistribution and notice review

- **Status:** Complete on 2026-08-13.
- **Prerequisites:** Phase 4 complete so reviewers inspect the exact source, linkage, SBOM, notice, and package inventories that would ship.
- **Deliverable:** Record approval references for qpdf, static libjpeg-turbo, and MuPDF redistribution; finalize the exact licenses, notices, corresponding-source assets, AutoShow source reference, and any written-offer/user-notice requirement; and make the package/release manifest reject an inventory that differs from the approved one.
- **Verification:** Compare each unsigned package inventory and SBOM to its approval, test that missing or changed review identifiers block promotion, and have the designated compliance/repository reviewers sign off on the recorded result.
- **Complete when:** qpdf/libjpeg-turbo and MuPDF are explicitly approved for the exact planned distribution. If MuPDF is not approved, stop: either obtain a commercial license or revise this ADR to keep MuPDF source-only before any signing or publication work. This phase changes review evidence and package policy only, not setup behavior.

### Phase 6: Close the prebuilt track without an Apple release program

- **Status:** Complete on 2026-08-13 by withdrawal at the Phase 5 safe-stop boundary.
- **Prerequisites:** Phase 5 complete.
- **Deliverable:** Remove both toolchain Actions workflows, the signed producer and draft-publication implementation, credential commands, signed-producer contracts, and the empty protected environment; retain source builds as the only production path and retain no release URL or production candidate metadata.
- **Verification:** Require the focused local contracts to assert both workflows are absent, confirm no Apple secret names or signed-producer commands remain in repository runtime/test automation, confirm production dependency metadata has no candidate URL or digest, run the shared verification baseline, and verify the repository still has no tool releases.
- **Complete when:** Repository automation cannot launch either toolchain matrix, no Apple credential or signing/notarization workflow is required, source setup and doctor remain healthy, and the ADR/index report the source-only decision as passed.

### Phases 7–9: Withdrawn

- **Status:** Canceled on 2026-08-13.
- **Reason:** These phases existed only to publish, benchmark, and activate the signed prebuilts retired in Phase 6. No release, production metadata, or runtime behavior exists to promote.
- **Future boundary:** A future prebuilt proposal starts with a new ADR and must independently justify its operational owner, trust chain, performance threshold, and release lifecycle.

## Implementation Ledger

| Action | Owner | Current State |
|---|---|---|
| Replace flat transfer deadlines and whole-body buffering with stall-aware resumable streaming and integrity checks | Setup/runtime maintainers | Complete — URL-bound partials, Range response handling, per-flow total budgets, checksums, size floors, and retry classification are implemented |
| Make setup summary, final message, exit status, disk accounting, and offline doctor checks truthful | Setup/runtime maintainers | Complete — real readiness probes, structured timings, health verdict, cleanup, and user actions are implemented |
| Bound setup transfers at the network leaves and aggregate quiet-task progress | Setup/runtime maintainers | Complete — capacity-three FIFO admission, one activity-aware heartbeat, and minute formatting are implemented |
| Measure cache guards, failed document-chain concurrency, the transfer budget, and a controlled CPU admission candidate | Setup/runtime maintainers | Complete — the document split was reverted, the transfer gate retained, the 3.1% CPU candidate rejected, and the selected cold/warm baselines recorded |
| Provision the pinned external ACSM plugin, managed Python environment, fulfillment/authorization wrappers, resolver, health guard, doctor check, and setup/help surface | Setup/runtime maintainers | Complete — `--step acsm` and the Calibre chain supply ADR-001's interface without persisting activation secrets |
| Phase 1 — Make the qpdf source fallback hermetic without adding any prebuilt surface | Setup/runtime maintainers | Complete — exact pins, static libjpeg/native-crypto recipe, linkage rejection, source install, functional checks, and shared verification passed on arm64 macOS on 2026-08-13 |
| Phase 2 — Add source-install provenance, atomic promotion, health-guard repair, and offline source doctor checks | Setup/runtime maintainers | Complete — closed version 1 source manifests, exact provenance and payload validation, staged atomic promotion with rollback, provenance-aware setup guards, truthful offline doctor labels, focused failure coverage, and real arm64 source installs passed on 2026-08-13 |
| Phase 3 — Add the dormant typed prebuilt consumer, eligibility/fallback classifier, trust checks, and offline prebuilt doctor coverage with fixture-only candidate injection | Setup/runtime maintainers | Complete — typed closed manifests and candidate metadata, per-tool eligibility, visible availability fallback, fail-closed trust classification, safe staged ZIP consumption, actual architecture and signature checks, atomic rollback, and offline source/prebuilt/override doctor coverage passed 112 focused tests on 2026-08-13; production remains source-only with no configured candidate or URL |
| Phase 4 — Add unprivileged unsigned arm64/x64 producer verification with exact builds, packaging, SBOMs, and clean-install coverage | Release engineering | Complete historical evidence — 124 focused contracts and real local arm64 builds pass; ordinary pull-request run [31686430140](https://github.com/ajcwebdev/autoshow-cli/actions/runs/31686430140) passed both fixed-runner producers plus both clean-install/source-fallback jobs at commit `465319b157c619f03bca00243c1654ef2f6f1e00`; both workflows were subsequently removed when the prebuilt track was withdrawn |
| Phase 5 — Record exact MuPDF and qpdf/libjpeg-turbo redistribution, source, SBOM, and notice approvals | Repository owner and compliance reviewers | Complete — exact component approval references, source/linkage boundary, same-release source access, AutoShow tag-source URLs, SPDX input licenses, expanded MuPDF bundled-code/resource notices, exact six-file package inventories, no-written-offer decision, mandatory user notice, and reviewer-role identities are recorded and fail closed on drift; production remains source-only on 2026-08-13 |
| Phase 6 — Close the prebuilt track without an Apple release program | Repository owner and release engineering | Complete — removed both toolchain workflows, signed/notarized producer and draft commands, protected contracts, and the empty release environment; no release or production candidate exists and source builds remain final |
| Phases 7–9 — Publish, benchmark, and activate project-hosted macOS prebuilts | Release and setup maintainers | Withdrawn — canceled with the prebuilt track; any future proposal requires a new ADR |

## Test Plan

- Setup acquisition contracts cover resumable Range requests, foreign-URL partial rejection, clean restart on `200`, discard on `416`, checksum and short-file failure, preservation on stalls, per-flow budgets, archive handling, and slot release before checksum verification.
- Setup orchestration contracts cover the capacity-three transfer gate, failed-transfer slot release, one-line activity-aware heartbeat, minute formatting, the serial document/ACSM chain, the 10 MiB reclaimed-tree threshold, Kitten symlink-aware cache checks, real llama GGUF readiness, qpdf and ACSM doctor checks, legacy CoreML reclamation, final health exit behavior, and force-reset coverage for qpdf.
- ACSM setup contracts cover the `acsm` step, inclusion from the Calibre chain, pinned plugin/runtime/wrapper generation, resolver precedence, idempotent readiness, separate authorization reporting, and omission/redaction of activation paths and account/key material. Fulfillment and conversion behavior remain covered under ADR-001.
- The setup performance artifact contract covers its closed schema, monotonic structured phases, phase reconciliation, actual compile overlap, environment facts, local-only persistence, and exclusion of home paths, URLs, and credentials.
- Historical full setup observations retained from the reliability passes are 307.4 seconds for the first corrected cold run, 326.4 seconds for the rejected document-chain split, and 330 seconds after transfer admission restored per-task behavior. The accepted controlled matrix supersedes those single-run comparisons with a 175.2-second cold median, 11.2-second post-install cold-cache rerun, and 1.639-second steady-state warm median; the rejected capacity-one CPU gate measured 169.8 seconds.
- Decision evidence completed on 2026-08-13: inspected the exact MuPDF 1.27.2 and qpdf 12.3.2 upstream release assets; verified their pinned source archives; audited local Mach-O architecture, deployment target, signatures, sizes, and dynamic libraries; and confirmed the repository is public with zero releases and zero Actions workflows.
- qpdf portability proof completed on 2026-08-13 in a temporary directory: verified libjpeg-turbo 3.2.0 by SHA-256, built arm64 qpdf 12.3.2 static with native crypto and macOS 15.0 minimum, confirmed system-only dynamic dependencies, and passed version, PDF validation, AES-256 encryption, and linearization commands. No repository runtime artifact was replaced.
- Phase 1 implementation verification completed on 2026-08-13: the metadata and source-recipe contract tests passed; a normal source-only setup replaced the old dynamic qpdf install; the resulting thin arm64 qpdf 12.3.2 recorded a host-compatible macOS 26.0 deployment target and only the three allowed `/usr/lib` dependencies; PDF validation, AES-256 encrypt/check/decrypt, linearization, and linearization validation passed; and a normal rerun reused the result without rebuilding.
- Phase 2 focused verification completed on 2026-08-13: 97 local/no-cost setup tests passed with 0 failures and covered closed-schema acceptance/rejection, exact MuPDF/qpdf source manifests, platform/architecture/deployment-target/source-pin/recipe/payload validation, provenance-free and corrupt trees, interrupted staging, atomic replacement, pre-promotion failure preservation, activation and stable-path validation rollback, setup health-guard wiring, truthful source doctor labels, corrupt-provenance and wrong-version repair guidance, and `--bin-dir` precedence.
- Phase 2 production-path verification completed on 2026-08-13: normal arm64 setup rebuilt and atomically promoted both source tools with valid version 1 manifests and macOS 26.0 deployment targets; exact version launch, payload hashes, and system-only dynamic closure passed; offline doctor reported both truthful `managed source` identities; no staging or backup directory remained; and a 0.16s setup rerun reused both installs without compilation.
- Phase 3 focused verification completed on 2026-08-13: 112 local/no-cost setup tests passed with 0 failures and covered eligible prebuilt installation, closed embedded/release/installed schemas, source-pin and recipe binding, unsupported OS/architecture, absent candidates, exhausted availability, independent per-tool source fallback with visible warnings, fail-closed archive/manifest/payload/version/architecture/signature/Team-ID/notary mismatches, archive traversal and unsafe entry rejection, exact package inventory, atomic rollback, healthy prior-install preservation, truthful source/prebuilt doctor labels, wrong-version detection, and override precedence. Candidate metadata entered only through typed test injection.
- Phase 3 production-boundary verification completed on 2026-08-13: dependency metadata and the macOS source installers still contain no prebuilt candidate, URL, checksum, flag, or environment override; real arm64 offline doctor continued to validate and label both source installs; and a 0.25s `bun autoshow setup --step calibre` rerun reused both tools without prebuilt lookup or compilation.
- Phase 4 focused verification completed locally on 2026-08-13: 124 local/no-cost setup tests passed with 0 failures and covered closed non-promotable unsigned schemas, conspicuous non-release names, exact source/build binding, preliminary license inventory, SPDX 2.3 generation, safe archive extraction, exact package contents, staged and stable-path validation, atomic prior-install preservation, rejection by the production manifest validator, visible absent-candidate source fallback, deployment-target parsing, build-path and credential scans, fixed runner labels, full-SHA action pins, read-only permissions, absence of signing/publication secrets, exact static-libjpeg selection, portability-before-upstream-test ordering, and the production source-only metadata boundary.
- Phase 4 real arm64 producer verification completed locally on 2026-08-13: qpdf built from exact qpdf 12.3.2 and libjpeg-turbo 3.2.0 pins, passed all seven upstream CTest groups and the repository validation/AES-256/decryption/linearization fixture matrix, and produced a 1.2 MB non-promotable ZIP with SHA-256 `5ff43997704ca4541ae163c89ebe470c9767b4086d617ce80eafa4d7b55e30f6`; MuPDF built from its exact 1.27.2 pin, passed the available upstream buffer/misc/source checks plus repository inspect/render fixtures, and produced a 29 MB non-promotable ZIP with SHA-256 `ef1d84b9149c6eeaf39784f31d3a2795d97341088c1d565c11f39cd3f8d4023a`. Both binaries were thin arm64 Mach-O files targeting macOS 15.0 with system-only linkage and no Developer ID identity, both packages carried closed manifests and SPDX, and both clean-installed successfully through staged atomic verification. The artifacts were temporary local evidence and were not published or placed in production metadata.
- Phase 4 formal verification completed on 2026-08-13 in ordinary pull-request run [31686430140](https://github.com/ajcwebdev/autoshow-cli/actions/runs/31686430140) at commit `465319b157c619f03bca00243c1654ef2f6f1e00`: the `macos-15` arm64 and `macos-15-intel` x64 producers passed, uploaded their non-promotable bundles, and were followed by passing native clean-install and independent source-fallback jobs. The retained workflow-artifact digests are `sha256:0ac06d7fccaa1931133a435a16db599045a4e37a716466bcbb2c73b004f386d7` for `macos-toolchain-unsigned-arm64` and `sha256:0235bb08a67b8dd86a9597ead40ea0b1d01fec39498655d20adb3d6fd96117aa` for `macos-toolchain-unsigned-x64`.
- Phase 5 source and license verification completed on 2026-08-13: re-downloaded the exact MuPDF, qpdf, and libjpeg-turbo release archives; reproduced dependency-metadata SHA-256 values; inspected the exact MuPDF AGPL/readme, qpdf Apache/notice, and libjpeg-turbo IJG/Modified BSD terms; enumerated the MuPDF static build inputs plus embedded fonts, CMaps, and 48 hyphenation resources; and recorded the exact project-owner approvals, source-access method, notices, package inventory, SPDX declarations, and invalidation rules in the Phase 5 distribution review.
- Phase 5 focused verification completed on 2026-08-13: 29 local/no-cost prebuilt producer/consumer contracts passed with 0 failures and covered exact approved notice paths, deterministic consolidated notices, exact SPDX reconstruction, approved source/license inventories, outer/embedded review-reference binding, missing/changed review-ID rejection, non-promotable unsigned state, staged installation, rollback, source fallback, workflow hardening, and the production source-only boundary. An additional offline packaging smoke used the exact audited source trees and produced the required six-file MuPDF and qpdf ZIP inventories.
- Phase 6 source-only closure verification completed on 2026-08-13: both toolchain workflow files, the signed producer implementation, its five package commands, and its signed producer contracts were removed; the focused producer contract asserts neither workflow exists; repository search finds no Apple credential names in runtime or test automation; production dependency metadata still contains no prebuilt URL or checksum; the protected environment was deleted; and the repository reports zero releases.
- Do not run provider, service, hosted-generation, or any paid/quota-risk command for this work.

## Assumptions

- The original host setup decision is accepted and implemented; macOS setup no longer invokes Homebrew for AutoShow-owned tools (verified: zero `brew` invocations remain in `src`).
- The prebuilt distribution investigation stopped at the completed Phase 5 safe boundary. No artifact was signed, notarized, published, configured, or activated; Phases 6–9 impose no remaining work; and source builds are the accepted final path.

## References

- Related ADR: [ADR-005](ADR-005-reduce-environment-variable-surface-area.md)
- Docker image distribution: [ADR-015](ADR-015-distribute-the-cli-as-a-docker-image.md)
- Error, retry, and diagnostic vocabulary: [ADR-006](ADR-006-unify-error-handling-vocabulary.md)
- Ingestion and ACSM fulfillment-policy boundary: [ADR-001](ADR-001-source-ingestion-and-normalization.md)
- Setup audit that produced the acquisition/reporting decision: `docs/reports/setup-command-audit.md`
- ACSM support trade study: `docs/reports/acsm-support-report.md`
- Calibre plugin notes: `docs/reports/calibre-acsm-plugin-docs.md`
- Runtime tool resolution: `src/utils/runtime-paths.ts`
- Setup download and transfer admission: `src/cli/commands/setup-and-utilities/setup/setup-download/download.ts`, `src/cli/commands/setup-and-utilities/setup/setup-download/download-admission.ts`
- Setup progress, performance, summary, and doctor: `src/cli/commands/setup-and-utilities/setup/setup-heartbeat.ts`, `src/cli/commands/setup-and-utilities/setup/setup-performance.ts`, `src/cli/commands/setup-and-utilities/setup/run-complete-setup.ts`, `src/cli/commands/setup-and-utilities/setup/run-doctor.ts`
- ACSM plugin provisioning and wrappers: `src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/acsm.ts`
- Shared setup/generation resource gate: `src/utils/resource-gate.ts`
- Whisper model integrity and llama cache readiness: `src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/whisper-model-integrity.ts`, `src/cli/commands/process-steps/step-3-write/write-local/llama/llama-model-cache.ts`
- Current macOS FFmpeg and yt-dlp setup: `src/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio.ts`
- Current macOS MuPDF setup: `src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/document.ts`
- Current macOS Calibre setup: `src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre.ts`
- Current macOS Tesseract setup: `src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/tesseract-setup.ts`
- Doctor check: `src/cli/commands/setup-and-utilities/setup/run-doctor.ts`
- Dependency metadata and checksum pinning: `src/cli/commands/setup-and-utilities/setup/dependency-metadata.ts`
- Shared hermetic qpdf source recipe and linkage check: `src/cli/commands/setup-and-utilities/setup/setup-download/qpdf-source-build.ts`
- Shared MuPDF source recipe: `src/cli/commands/setup-and-utilities/setup/setup-download/mupdf-source-build.ts`
- Managed source/prebuilt manifest validation and atomic promotion: `src/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact.ts`
- Dormant prebuilt eligibility, archive consumer, trust classifier, and fallback dispatch: `src/cli/commands/setup-and-utilities/setup/setup-download/prebuilt-artifact.ts`
- Dormant prebuilt fixture contracts: `test/test-cases/validation/setup/prebuilt-artifact-contracts.test.ts`
- Unsigned verification artifact schemas, packaging, SPDX generation, validation, and staged clean-install path: `src/cli/commands/setup-and-utilities/setup/setup-download/unsigned-prebuilt-artifact.ts`
- Reusable exact-pin producer and source-fallback commands: `src/tools/macos-toolchain-producer.ts`
- Phase 4 producer contracts: `test/test-cases/validation/setup/prebuilt-producer-contracts.test.ts`
- Closed Phase 5 distribution policy and exact notice/source/SBOM/reviewer inventories: `src/cli/commands/setup-and-utilities/setup/setup-download/managed-toolchain-distribution-policy.ts`
- Phase 5 redistribution approval record: [Phase 5 Distribution Approval Record](#phase-5-distribution-approval-record)
- Shared approved notice writer and SPDX generator used by local unsigned research packages: `src/cli/commands/setup-and-utilities/setup/setup-download/managed-toolchain-package.ts`
- Repository-owned producer PDF fixture: `test/fixtures/setup/managed-toolchain-smoke.pdf`
- MuPDF 1.27.2 upstream release: [ArtifexSoftware/mupdf-downloads 1.27.2](https://github.com/ArtifexSoftware/mupdf-downloads/releases/tag/1.27.2)
- MuPDF license: [ArtifexSoftware/mupdf](https://github.com/ArtifexSoftware/mupdf)
- qpdf 12.3.2 upstream release: [qpdf 12.3.2](https://github.com/qpdf/qpdf/releases/tag/v12.3.2)
- qpdf license and build documentation: [qpdf repository](https://github.com/qpdf/qpdf)
- libjpeg-turbo 3.2.0 source release: [libjpeg-turbo 3.2.0](https://github.com/libjpeg-turbo/libjpeg-turbo/releases/tag/3.2.0)
- Producer runners: [GitHub-hosted runners reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- Build provenance: [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
- Hosting and retention control: [GitHub immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)
- Workflow hardening: [GitHub secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- Signing and notarization: [Apple notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- Verification rule: `bun run check`
- `bunfig.toml`
