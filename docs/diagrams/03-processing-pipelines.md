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
  |      selected STT providers are skipped and are not recorded on the run
  |
  +--> unavailable:
         fall back to selected STT providers
```
The local STT provider is `whisperfile`. All others are hosted.

Output layout:

```
single audio STT provider:
  transcription.txt
  result.json
  manifest.json

multi-provider, or one Supadata or ScrapeCreators target:
  providers/<service>-<model>/
    transcription.txt
    result.json
  manifest.json
```
Provider failures do not discard the whole output directory. A run can finish as:

| Status       | Meaning                                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `full`       | Every requested provider succeeded. Skipped providers still leave the run `full` when every other provider succeeded.               |
| `incomplete` | At least one provider succeeded while another failed or is missing, or no provider succeeded while one is missing or still running. |
| `failed`     | No requested provider succeeded, and none are missing or still running.                                                             |

## Document and Article Pipeline

Documents include PDFs, EPUB, Office/ODF files, ebooks, comic archives, RTF, CSV, and common image formats. HTML files and article URLs use article extraction. The input format selects article extraction, native text, or OCR. EPUB and convertible ebooks use native text unless an OCR provider is selected.

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
  +--> DOCX/PPTX/XLSX/ODF/RTF
  |      native document extraction
  |
  +--> EPUB or convertible ebook
  |      convertible formats normalize to EPUB first
  |      native text by default, or OCR when an OCR provider is selected
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

multi-provider OCR, fanout (default):
  providers/<service>-<model>/
    extraction.txt
    result.json
  extraction.txt | result.json  # primary provider output when --primary-ocr is set
  manifest.json

multi-provider OCR, pool:
  extraction.txt | result.json  # composite extraction in page order; --primary-ocr is rejected
  providers/<service>-<model>/attempts/
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

When two providers share a model id, the JSON, rendered markdown, and show-note filenames include the provider (`text-<provider>-<model>.json`, and the same stem for `text-*.md` and `show-note-*.md`).

Project lyric draft mode engages when the input is a directory named `text` (or a `.md`/`.txt` under it) and `prompt.md` exists in that directory's parent (or `--prompt-file` is supplied). Defaults then use that `prompt.md`, optional `tracks.md` beside it, and rendered drafts in the sibling `lyrics` directory.

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
  |      no captions -> run local whisperfile (--model, default small.en) and create lyric cues
  |
  +--> render with ffmpeg
  |
  v
<stem>.mp4
<stem>.vtt
<stem>.srt
manifest.json
```