# Bun 1.4 Native API Evaluation Outcomes

Date: 2026-08-31

This report records the evaluation outcomes for recommendations 15 through 19 from the validated Bun 1.4 action plan. Recommendations 15 through 18 are closed. Recommendation 19 has a local evidence-backed rejection decision, while its configured native AMD64 and ARM64 validation remains open until both CI artifacts are reviewed. All evaluation and verification commands are local or container-local and make no paid or quota-limited provider requests.

## Tar extraction: adopt the streamed staged extractor; reject direct Bun.Archive extraction

The production setup downloader now feeds `Bun.file(path).stream()` through `DecompressionStream("gzip")` and incrementally parses and writes tar payloads into a newly created staging directory. It no longer loads the compressed download with `arrayBuffer()` or expands the complete archive with `Bun.gunzipSync()`.

The extraction boundary applies PAX, global extended, GNU long-name, and GNU long-link metadata; verifies header checksums, padding, end markers, truncation, byte and entry limits; rejects absolute, traversal, Windows-style, duplicate, unsupported, and hard-link entries; prevents writes through archived symlinks; preserves executable modes; refuses a non-empty destination; and atomically renames the validated staging root into place. Failure cleanup is confined to the newly created staging directory. The ZIP central-directory implementation remains separate.

A macOS ARM64 memory check used a tar.gz that expands to 134,223,872 bytes. The streamed extractor peaked at 41,762,816 bytes RSS, while the former `arrayBuffer()` plus `Bun.gunzipSync()` shape peaked at 147,111,936 bytes RSS. The same check exposed binary values in macOS `SCHILY.xattr.*` PAX extensions; the parser now ignores unsupported extension values while continuing to require valid UTF-8 for the supported `path`, `linkpath`, and `size` fields, with a regression contract covering that case.

Direct `Bun.Archive.extract()` was rejected for this production path on Bun 1.4.0. A `Bun.Archive` created from in-memory tar or gzip bytes can extract the archive, but a `Bun.Archive` created from a file-backed `Bun.file()` reports an unrecognized archive on the validated macOS ARM64 host. Buffering the complete file first would retain the memory defect this phase is intended to remove. The native files view also does not expose enough link and duplicate metadata to serve as the security preflight boundary.

## XML: retain the scanner behind a completed native-adapter evaluation

`src/utils/bun-xml-adapter.ts` owns the Bun.XML call, always requests `compact: false`, validates the returned representation, preserves mixed child ordering, and bounds source bytes, element depth, and node count. The golden corpus covers RSS, Atom, namespaces, namespaced attributes, CDATA, comments, processing instructions, named and numeric entities, repeated and self-closing tags, mixed content, DOCX, PPTX, XLSX, ODF, EPUB, malformed input, truncation, size, node-count, and depth limits.

The existing scanner remains the production implementation. Bun.XML is deliberately strict where current feed handling is tolerant, and it returns normalized mixed-content text instead of the raw inner XML slices required by current EPUB and Office consumers. The side-by-side contracts record both compatible stable fields and these parity failures, so no consumer is silently changed.

## JSONL: adopt Bun.JSONL for parsing only

The TTS journal readers, projection admission-journal reader, and test-metrics reader now share `src/utils/jsonl-reader.ts`. The adapter uses `Bun.JSONL.parseChunk()` for complete records, handles UTF-8 BOM bytes, accepts a valid final record without a newline, ignores only a structurally incomplete or torn-UTF-8 final suffix, and rejects malformed complete records.

The migration does not change journal writes. `O_APPEND`, `O_NOFOLLOW`, file permissions, `fsync`, containment, symlink rejection, retained byte checksums, snapshot validation, and ambiguous paid-dispatch refusal remain in their existing artifact and recovery code.

## Bun.Image: remove redundant declarations and keep TIFF routing conservative

Inspection of the installed `@types/bun@1.4.0` and `bun-types@1.4.0` declarations found the complete Bun.Image constructor, metadata, pipeline, and encoder declarations. All three runtime casts and all parallel local constructor declarations were removed. Production and tests now use `Bun.Image` directly, and the contract suite fails if a local constructor shim returns.

A synthetic one-pixel red TIFF golden verifies metadata and PNG pixels on macOS and Windows, where Bun 1.4 advertises TIFF decoding. Production TIFF routing remains on the existing direct-provider or ImageMagick paths because Linux and the supported Docker image still require ImageMagick. ImageMagick also remains the comic compositing engine because Bun.Image has no composition operation.

## Compiled Docker entrypoint: reject for production and retain a measured target

The `compiled-experiment` Docker target builds an ESM bytecode executable with dotenv, bunfig, tsconfig, and package-json autoload disabled, emits JSON and Markdown metafiles, embeds immutable prompt, tokenizer, model, STT configuration, and comic-prompt assets, and keeps writable `input`, `output`, `runtime`, caches, and protected artifacts outside the executable. Standalone execution resolves writable project paths from the executable directory and immutable assets from Bun's embedded virtual filesystem. Model and prompt registries enumerate the embedded file list because virtual asset directories are not ordinary filesystem directories.

The production target remains the source-run image. The final macOS ARM64 experiment bundled 1,020 modules in approximately 0.5 seconds and produced a 92,889,074-byte executable. Because the supported image already contains the Bun runtime, the executable duplicates a large runtime payload.

A local Linux ARM64 Docker measurement completed the compiled target in 87.8 seconds including a cold runtime-tool layer, with the final executable compilation step taking 1.1 seconds. After eliminating physical mirrors of the embedded assets, the source image was 628,645,259 bytes and the compiled image was 668,043,441 bytes, an increase of 39,398,182 bytes. Five fresh-container help samples improved from 342/247/267/263/241 ms for source to 161/178/192/185/182 ms for compiled, and one cgroup peak-memory sample improved from 52,416,512 bytes to 25,800,704 bytes. Help, `config --show`, `setup --doctor`, and a local `write --price` path that exercises prompt discovery and the embedded tokenizer all passed in the compiled container. The faster startup and lower help memory do not satisfy the adoption gate because image size regressed and immutable assets require a second packaging path, so the evidence-backed decision is reject.

Both native Linux Docker jobs are configured to build the experimental target without publishing it, run help, configuration, setup-doctor, and a no-cost `write --price` standalone path contract, and record build duration, cold-help samples, help peak RSS, compiled image size, and source image size in `compiled-entrypoint-experiment.json`. The `write --price` contract reads a mounted repository fixture and must resolve the embedded prompt registry and tokenizer ranks without creating output or contacting a provider. Native job logs remain required evidence rather than inferred results. The recorded decision is reject unless future measurements show a material improvement without asset, path, diagnostic, image-size, or multi-architecture regressions.
