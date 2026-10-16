# Two-speaker speech fixture

`01-two-speaker-speech.mp4` is a 24-second excerpt, from 00:22 through 00:46, of *Tears of Steel* (2012). It contains dialogue between Celia, played by Denise Rebergen, and Thom, played by Vanja Rukavina. Both are human actors. This is a small example for media extraction, diarization inputs, caption export, and audio channel splitting.

Attribution: **(CC) Blender Foundation | [mango.blender.org](https://mango.blender.org/)**. The film is licensed under [Creative Commons Attribution 3.0 Unported](https://creativecommons.org/licenses/by/3.0/). This adaptation trims and downscales the film, re-encodes its audio and video, extracts a resampled WAV, and adapts the English subtitles. Keep this attribution, license link, change notice, and the credits below with redistributed fixtures. No endorsement by the creators or actors is implied.

## Files

- `01-two-speaker-speech.mp4`: H.264 video, 640 × 268 pixels, stereo AAC audio, 44,100 Hz, 24.000 seconds, 842,494 bytes.
- `../audio/01-two-speaker-speech-stereo.wav`: the same 24.000-second audio timeline, resampled to 16,000 Hz, two-channel signed 16-bit PCM, 1,536,162 bytes. These are the film's left and right mixes, each containing dialogue and background sound. They are not isolated speakers.
- `01-two-speaker-speech.transcript.json`: a saved transcription-shaped input for local caption export. Nine subtitle segments retain the two character labels. Times are relative to the excerpt, with 22 seconds subtracted from the source film.
- `01-two-speaker-speech.vtt`: the same nine subtitle intervals in a portable text format. It omits the film's on-screen time-jump text.

The transcript was adapted from the official English subtitle file and checked for complete segment text, clip-relative timing bounds, and character identities using the cast credits and clip frames. No independent listening review, ASR result, measured word alignment, or provider accuracy claim is made. The segment times are coarse subtitle intervals. Word-mode caption export estimates word times within them.

The existing tracked `../audio/1-audio.mp3` remains the separate general speech example. It is approximately 59.59 seconds long and is not derived from this film.

## Provenance

Sources retrieved on 2026-10-15:

- [Official project and license statement](https://mango.blender.org/about/).
- [Official film download page](https://mango.blender.org/download/), which links the NLUUG mirror.
- [Source 720p film on that mirror](https://ftp.nluug.nl/pub/graphics/blender/demo/movies/ToS/tears_of_steel_720p.mov).
- [English subtitles on the same mirror](https://ftp.nluug.nl/pub/graphics/blender/demo/movies/ToS/subtitles/TOS-en.srt), cues 1–9.
- [Official cast and production credits](https://studio.blender.org/projects/tears-of-steel/pages/credits/).

Only the selected movie range was read during fixture preparation, approximately 13.98 MB including container metadata. The full 372 MB film is not included in the repository. The separate original soundtrack downloads have their own license notice; this fixture uses the film's mixed audio track.

## Local examples

Export captions without an API, model, or transcription request:

```bash
bun autoshow extract input/examples/video/01-two-speaker-speech.transcript.json --captions --caption-format both --output-dir output/example-speech-captions
```

Generate an alternative word layout; these word times are interpolated:

```bash
bun autoshow extract --captions --transcript-result input/examples/video/01-two-speaker-speech.transcript.json --caption-mode word --caption-format vtt --no-caption-speakers --output-dir output/example-speech-word-captions
```

Split the stereo mix into two mono WAVs without transcribing it:

```bash
bun autoshow extract input/examples/audio/01-two-speaker-speech-stereo.wav --split-channels --output-dir output/example-speech-channels --json
```

Choose a new output directory for each run. Caption export preserves the source transcript. Channel splitting verifies the decoded samples and records channel identity; it does not infer person identity.

## Reproduction

Use FFmpeg with the source URL above. Input seeking permits HTTP range requests instead of a complete film download.

```bash
ffmpeg -nostdin -ss 22 -i https://ftp.nluug.nl/pub/graphics/blender/demo/movies/ToS/tears_of_steel_720p.mov -t 24 -map 0:v:0 -map 0:a:0 -vf scale=640:-2 -c:v libx264 -preset veryfast -crf 27 -pix_fmt yuv420p -c:a aac -b:a 96k -ac 2 -movflags +faststart -map_metadata -1 -metadata title='Tears of Steel: two-speaker dialogue excerpt' -metadata artist='Blender Foundation' -metadata comment='CC BY 3.0; excerpt 00:22–00:46; attribution and credits in README.md' input/examples/video/01-two-speaker-speech.mp4
ffmpeg -nostdin -i input/examples/video/01-two-speaker-speech.mp4 -vn -ac 2 -ar 16000 -c:a pcm_s16le -map_metadata -1 -metadata comment='Blender Foundation; Tears of Steel excerpt; CC BY 3.0; see video/README.md' input/examples/audio/01-two-speaker-speech-stereo.wav
```

Encoder versions can change the resulting bytes. Current SHA-256 checksums:

```text
9b4f393d803098e01b18f9377338fe30f3a763d5ccb69ebe120999a8d29327b1  01-two-speaker-speech.mp4
e34786800a63881d79fe860d1a385be206895c83067535b6cbb8f3046f679578  ../audio/01-two-speaker-speech-stereo.wav
161cbca17d27258f060bb45d08ea35d0378df6b0ec25b618aa498f16e60c8cbd  01-two-speaker-speech.transcript.json
39b12ccdc9c4c4c44af7d22b3f096237b48cd16227c5023784f725402d962833  01-two-speaker-speech.vtt
```

## Film credits

Credits retained from the official production credits page:

- Written and directed by Ian Hubert; produced by Ton Roosendaal.
- Director of photography: Joris Kerbosch N.S.C.; music and sound: Joram Letwory.
- Cast: Derek de Lint (Old Thom), Sergio Hasselbaink (Barley), Rogier Schippers (Captain), Vanja Rukavina (Thom), Denise Rebergen (Celia), Jody Bhe (Djenghis), and Chris Haley (Tech head).
- Lighting and compositing: Andy Goralczyk; concept art and storyboards: David Revoy; layout, compositing and animation: Francesco Siddi.
- Character rigging and animation: Jeremey Davidson; character design, modeling and lighting: Kjartan Tysdal; environment design and modeling: Nicolò Zubbini.
- Production assistance and environment modeling: Rob Tuytel; keying, plate cleanup and roto: Roman Volodin; matchmoving, keying and compositing: Sebastian Koenig.
- Software: Brecht van Lommel, Campbell Barton, and Sergey Sharybin; finance: Anja Vugts-Verstappen.
