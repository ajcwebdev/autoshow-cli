# voice clone

Create a consent-gated instant clone for Gemini, ElevenLabs, Grok, or Inworld. OpenAI and Soniox cloning are not exposed.

```bash
bun autoshow voice clone hero --provider elevenlabs --model eleven_v3 --voice-name HeroClone --sample input/voices/hero.wav --authorization-ref release:hero-v1 --consent-ref protected-consent:v1:STORE:ASSET:SHA256 --provenance-ref project:casting --price
```

Requires an existing [brief](00-voice-overview.md#overview), provider/synthesis model, voice name, sample, authorization reference, provenance reference, and protected consent locator explicitly granting `upload` and `new-synthesis`. `--profile` defaults to `default`; `--description` is optional.

Samples accept MP3, WAV, M4A, MP4, OGG, FLAC, AAC, or WebM. ElevenLabs/Inworld accept repeated `--sample`; Gemini/Grok require exactly one. Grok allows up to 120 seconds.

Gemini also requires a separate `--consent-audio` recording of its consent statement. Both recordings must decode completely; the reference lasts 10–30 seconds and consent audio has positive duration. Both enter protected storage before upload. Replication creates a persistent voice and its operation price is unknown.

```bash
bun autoshow voice clone hero --provider gemini --model gemini-3.8-flash-lite-tts --voice-name HeroClone --sample input/voices/hero.wav --consent-audio input/voices/hero-consent.wav --authorization-ref release:hero-v1 --consent-ref protected-consent:v1:STORE:ASSET:SHA256 --provenance-ref project:casting --price
```

`--reconcile` attempts recovery without recreating an ambiguous clone. `--price` validates/estimates without provider calls or writes; [audition](06-audition.md) follows provisioning.
