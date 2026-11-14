# Download Tests

Local smoke coverage uses fixture files and a loopback RSS server:

```bash
bun t test/test-cases/e2e/local/sources/download/download-input-types-local-file.test.ts test/test-cases/e2e/local/sources/download/download-input-types-feed-or-channel.test.ts
```

`test/test-cases/validation/sources/download/` covers yt-dlp options and passthrough without downloads. Direct-URL and streaming e2e tests contact external sites and depend on tool/site availability.

`bun t --price` on selected paths runs mapped estimates, not download behavior. See the [testing rules](../../testing.md) before broader execution and the [download guide](overview.md) for usage.
