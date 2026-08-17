# Processing Pipelines

Current processing flows for media, documents/articles, text-input writing, transcript-video rendering, and lyric-video rendering.

## Outline

- [Media STT Pipeline](#media-stt-pipeline)
- [Document and Article Pipeline](#document-and-article-pipeline)
- [Write Outputs](#write-outputs)
- [Transcript Video Pipeline](#transcript-video-pipeline)
- [Music Lyric-Video Pipeline](#music-lyric-video-pipeline)

## Media STT Pipeline

`metadata` stops after metadata extraction, `download` stops after Step 1, `extract` runs Steps 1-2, and `write` continues into LLM and optional generation.

```
media target
  |
  v
processMediaSingle() / processVideo()
  |
  v
Step 1: source metadata + media staging
  |
  +--> streaming URL: yt-dlp metadata and download
  +--> direct media URL: fetch/save
  +--> local media: inspect with ffprobe
  |
  v
prepareSttMedia()
  |
  +--> normalize one shared upload/transcription artifact
  +--> strip extra streams, cover art, chapters, and metadata
  +--> keep compatible audio fast paths where possible
  |
  v
Step 2: STT or YouTube captions
```

`prepareSttMedia()` stages source media for the run and records source duration plus output file details in Step 1 metadata. The staged media artifact is shared by local and hosted STT providers so multi-provider runs do not repeatedly normalize the same input.

When `--youtube-captions` is set, YouTube inputs first try caption extraction:

```
--youtube-captions
  |
  v
tryResolveYoutubeCaptionTranscription()
  |
  +--> success:
  |      youtube-captions.vtt
  |      youtube-captions.json
  |      transcription.txt
  |      result.json raw caption/transcription payload
  |      requested STT providers are marked skipped
  |
  +--> unavailable:
         fall back to selected STT providers
```

STT providers are run through local and hosted provider pools:

| Pool   | Providers                                                                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local  | `whisper`, `whisperfile`.                                                                                                                                                       |
| Hosted | `deepinfra`, `deepgram`, `soniox`, `speechmatics`, `rev`, `groq`, `grok`, `mistral`, `assemblyai`, `gladia`, `happyscribe`, `supadata`, `scrapecreators`, `gemini`, `together`. |

Output layout:

```
single provider:
  transcription.txt
  result.json                # raw transcription payload
  prompt.md                  # extraction/write prompt context
  manifest.json              # canonical command/scope/items shape

multi-provider:
  providers/<provider-model>/
    transcription.txt
    result.json              # raw transcription payload
  prompt.md
  manifest.json
```

Extract items record `extractRoute: "media"`. Extract and write items use the same canonical status/provider shape and keep ordinary Step 1, route, cost, and timing evidence in item metadata when applicable. Requested, missing, blocked, and completion summaries are derived from provider entries and item status rather than persisted as parallel lists.

Provider failures do not discard the whole output directory. A run can finish as:

| Status       | Meaning                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| `full`       | All requested providers completed or the selected single provider completed.                             |
| `incomplete` | At least one provider succeeded and at least one requested provider failed, was missing, or was skipped. |
| `failed`     | No requested provider produced a usable result.                                                          |

## Document and Article Pipeline

The document family covers PDFs, EPUB, Office/ODF files, ebooks, comic archives, RTF, CSV, HTML, and common image formats. `resolveOcrStep2ExecutionFromFormat()` decides whether the item uses OCR, native text extraction, or article extraction.

```
document/html target
  |
  v
resolveDocumentFormatHint()
  |
  +--> html/article URL or .html/.htm
  |      process-url.ts route
  |
  +--> CSV
  |      native-document/csv
  |
  +--> DOCX/PPTX/XLSX/ODF/ebook/RTF
  |      native document extraction or conversion path
  |
  +--> PDF/image/EPUB-as-PDF/CBZ images
         OCR provider path
```

OCR provider path:

```
processOcr()
  |
  +--> local text/OCR:
  |      tesseract, MuPDF assisted extraction
  |
  +--> hosted OCR:
         mistral, glm, kimi, openai, grok, anthropic, gemini,
         deepinfra, replicate, fal
```

Document extract output:

```
single provider/native route:
  extraction.txt | result.json
  manifest.json

multi-provider OCR:
  providers/<provider-model>/
    extraction.txt
    result.json              # raw OCR/domain payload
  extraction.<format>         # primary provider output when --primary-ocr is set
  manifest.json
```

Article output:

```
single backend:
  extraction.txt | result.json
  manifest.json

all URL backends:
  providers/<backend>/
    extraction.txt
    result.json              # raw article/domain payload
  manifest.json
```

Article items record route evidence, `web`, source, cost, timing, and errors in `metadata`, plus canonical item and provider statuses. Local HTML uses Defuddle. Remote single-backend Defuddle can fall back to Firecrawl when configured.

Document extract items record `extractRoute: "document"`, Step 1 and route evidence, primary-provider data, cost, timing, web/source data when applicable, and optional errors. Provider identity, attempts, status, options, metadata, result, and error live once in the item's `providers` entries.

## Write Outputs

For media, document, article, and text-input write flows, Step 3 builds a prompt and calls `runLLM()`:

```
Step 2 result
  |
  v
buildPrompt() / buildDocumentPrompt() / buildTextInputPrompt()
  |
  +--> prompt.md
  +--> prompt-md.md when --prompt-md is set
  |
  v
runLLM()
  |
  +--> text.json                 single LLM provider
  +--> text-<model>.json         multi-provider LLM output
  |
  v
writeRenderedTextArtifacts()
  |
  +--> text.md or text-<model>.md when --rendered-text is set
  +--> external rendered files under --rendered-out-dir when configured
  |
  v
writeShowNoteArtifacts()
  |
  +--> show-note.md or show-note-<model>.md
```

Text-input write mode skips Steps 1-2. It treats `.md`/`.txt` files as the source corpus, writes a canonical manifest with `command: "write"`, `scope: "single"`, and `items[0].metadata.source.kind: "text-input"`, and then can run the same Step 3 plus optional TTS/image/video/music stages.

`output/<project>/text` can be used as a project directory. The target layer infers `--text-input`, `prompt.md`, optional `tracks.md`, and rendered lyric output defaults from the project structure.

## Transcript Video Pipeline

`extract --transcript-video` renders a video with captions and writes a canonical single-run manifest with `command: "video"` and transcript-video item metadata.

```
existing extract output
  |
  +--> infer audio and a single completed provider result
  |    multiple provider results require --transcript-result
  |
  v
runExtractTranscriptVideo()
  |
  +--> build captions from provider result or --transcript-text
  +--> render video with --audio and optional --font
  +--> keep temporary files when --keep-tmp is set
  |
  v
<label>.mp4
<label>.vtt
<label>.srt
manifest.json
```

Manual mode requires `--audio` plus exactly one of `--transcript-result` or `--transcript-text`.

## Music Lyric-Video Pipeline

Hosted music generation is a normal Step 7 provider run. The local lyric-video path is separate and is selected by `music --audio`, `music --captions`, or `music --batch`.

```
music lyric-video mode
  |
  +--> validate audio/caption paths stay inside allowed input/output roots
  |
  +--> caption source:
  |      --captions -> parse VTT/SRT
  |      no captions -> run local Whisper large-v3-turbo and create lyric cues
  |
  +--> render:
         ffmpeg + ass subtitle rendering
         fallback helpers when needed
  |
  v
<stem>.mp4
<stem>.vtt
<stem>.srt
manifest.json command "music", item metadata mode "lyric-video"
```
