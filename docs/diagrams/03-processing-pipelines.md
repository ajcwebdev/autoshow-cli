# Processing Pipelines

Media, document, article, text writing, transcript-video, and lyric-video flows.

## Outline

- [Media STT Pipeline](#media-stt-pipeline)
- [Document and Article Pipeline](#document-and-article-pipeline)
- [Write Outputs](#write-outputs)
- [Transcript Video Pipeline](#transcript-video-pipeline)
- [Music Lyric-Video Pipeline](#music-lyric-video-pipeline)

## Media STT Pipeline

`metadata` stops after metadata extraction, `download` stops after Step 1, `extract` runs Steps 1-2, and `write` runs Step 3 text generation over local `.md` / `.txt` (with follow-on generation commands for speech, images, video, and music).

```
media target
  |
  v
Step 1: source metadata + media staging
  |
  +--> streaming URL: yt-dlp metadata and download
  +--> direct media URL: fetch/save
  +--> local media: inspect with ffprobe
  |
  v
stage one shared audio artifact for transcription
  |
  v
Step 2: STT or YouTube captions
```

When `--youtube-captions` is set, YouTube inputs first try caption extraction:

```
--youtube-captions
  |
  v
caption extraction
  |
  +--> success:
  |      youtube-captions.vtt
  |      youtube-captions.json
  |      transcription.txt
  |      result.json
  |      requested STT providers are marked skipped
  |
  +--> unavailable:
         fall back to selected STT providers
```

Local STT providers are `whisper` and `whisperfile`. All others are hosted.

Output layout:

```
single provider:
  transcription.txt
  result.json
  manifest.json

multi-provider:
  providers/<service>-<model>/
    transcription.txt
    result.json
  manifest.json
```

Provider failures do not discard the whole output directory. A run can finish as:

| Status       | Meaning                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| `full`       | All requested providers completed or the selected single provider completed.                             |
| `incomplete` | At least one provider succeeded and at least one requested provider failed, was missing, or was skipped. |
| `failed`     | No requested provider produced a usable result.                                                          |

## Document and Article Pipeline

Documents include PDFs, EPUB, Office/ODF files, ebooks, comic archives, RTF, CSV, and common image formats. HTML files and article URLs use article extraction. Format decides whether the item uses OCR, native text extraction, or article extraction.

```
document/html target
  |
  v
detect format
  |
  +--> html/article URL or .html/.htm
  |      article extraction
  |
  +--> CSV
  |      native CSV extraction
  |
  +--> DOCX/PPTX/XLSX/ODF/ebook/RTF
  |      native document extraction
  |
  +--> PDF, images, CBZ
         OCR
```

OCR path:

```
OCR
  |
  +--> local: tesseract
  |
  +--> hosted OCR providers
```

Document extract output:

```
single provider/native route:
  extraction.txt | result.json
  manifest.json

multi-provider OCR:
  providers/<service>-<model>/
    extraction.txt
    result.json
  extraction.txt | result.json  # primary provider output when --primary-ocr is set
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
    result.json
  manifest.json
```

Local HTML uses Defuddle. Remote single-backend Defuddle automatically retries with Firecrawl when the Defuddle attempt fails.

## Write Outputs

For extracted transcripts, documents, articles, and local text write flows, Step 3 builds a prompt and runs the selected LLM providers:

```
Step 2 result
  |
  v
build prompt
  |
  +--> prompt.md
  +--> prompt-md.md when --prompt-md is set
  |
  v
run LLM
  |
  +--> text.json                 single LLM provider
  +--> text-<model>.json         multi-provider LLM output
  |
  v
write rendered text
  |
  +--> text.md or text-<model>.md when --rendered-text is set
  +--> external rendered files under --rendered-out-dir when configured
  |
  v
write show notes
  |
  +--> show-note.md or show-note-<model>.md
```

`write` always starts at Step 3. It treats `.md`/`.txt` files as the source corpus. URLs, media, documents, HTML, and X Spaces go through `extract` first.

`output/<project>/text` can be used as a project directory. The CLI infers `prompt.md`, optional `tracks.md`, and rendered lyric output defaults from the project structure.

## Transcript Video Pipeline

`extract --transcript-video` renders a video with captions from an existing extract run or from explicit audio and transcript files.

```
existing extract output
  |
  +--> infer audio and a single completed provider result
  |    multiple provider results require --transcript-result
  |
  v
render transcript video
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

Hosted music generation is a standalone provider run. The local lyric-video path is selected by any lyric-video flag (`--audio`, `--captions`, `--batch`, `--model`, `--font`) and requires either `--audio` or `--batch`.

```
music lyric-video mode
  |
  +--> resolve audio/caption paths against the project root and require them to exist
  |
  +--> caption source:
  |      --captions -> parse VTT/SRT
  |      no captions -> run local whisper.cpp (--model, default large-v3-turbo) and create lyric cues
  |
  +--> render with ffmpeg
  |
  v
<stem>.mp4
<stem>.vtt
<stem>.srt
manifest.json
```
