# Download Tests

Local smoke coverage uses fixture files, a loopback RSS server, and a loopback streaming transport fixture:

```bash
bun t:local test/test-cases/e2e/local/sources/download/download-input-types-local-file.test.ts test/test-cases/e2e/local/sources/download/download-input-types-feed-or-channel.test.ts test/test-cases/e2e/local/sources/download/download-fixture-streaming.test.ts
```

The streaming fixture exercises the real CLI with YouTube/Twitch URL routing and a runtime-contained extractor transport fixture. Metadata and valid MP3 bytes come from a loopback server; managed FFprobe and FFmpeg verify the downloaded media, including exact byte preservation and decoding. Missing and corrupt media must fail before a successful manifest is published. This proves local routing, metadata, and artifact handling; it does not prove public-site extraction or site availability.

Select real public YouTube/Twitch acceptance separately:

```bash
bun t:local test/test-cases/e2e/service/sources/download/download-input-types-streaming.test.ts
```

Those two tests use the real managed extractor and retain the live media/metadata assertions. They require no paid AI provider credentials, but depend on public-site availability and access rules; anonymous access can fail with a sign-in or anti-bot refusal. A passing fixture run does not establish that these live tests passed.

`test/test-cases/validation/sources/download/` covers yt-dlp options and passthrough without public downloads. Direct-URL e2e tests still contact their public media hosts.

`bun t --price` on selected paths runs mapped estimates, not download behavior. See the [testing rules](../../testing.md) before broader execution and the [download guide](overview.md) for usage.
