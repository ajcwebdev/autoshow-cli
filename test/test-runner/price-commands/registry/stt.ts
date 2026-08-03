import type { PriceSelectionEntry } from '~/types'
import { command, exact, prefix } from '../helpers'

export const sttRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisper/whisper-default.test.ts', [
    command('transcribe-whisper-tiny', 'transcribe-whisper-tiny', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'whisper=tiny', '--price']),
    command('transcribe-whisper-base', 'transcribe-whisper-base', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'whisper=base', '--price']),
    command('transcribe-whisper-split', 'transcribe-whisper-split', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--split', '--provider', 'whisper=tiny', '--price']),
  ]),
  ...exact('test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisperfile/whisperfile-default.test.ts', [
    command('transcribe-whisperfile-tiny', 'transcribe-whisperfile-tiny', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'whisperfile=tiny', '--price']),
  ]),
  ...exact('test/test-cases/e2e/local/step-2-stt-e2e/stt-local/whisper/whisper-large-v3-turbo.test.ts', [
    command('transcribe-whisper-large-v3-turbo', 'transcribe-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'whisper=large-v3-turbo', '--price']),
    command('transcribe-whisper-tiny-split', 'transcribe-whisper-tiny-split', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/2-video.mp4', '--provider', 'whisper=tiny', '--split', '--price']),
  ]),
  ...prefix('test/test-cases/e2e/local/step-2-stt-e2e/stt-local/reverb/', [
    command('transcribe-reverb', 'transcribe-reverb', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'reverb', '--reverb-verbatimicity', '0.5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/assemblyai-universal-3-pro.test.ts', [
    command('transcribe-assemblyai-universal-3-pro', 'transcribe-assemblyai-universal-3-pro', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'assemblyai=universal-3-pro', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/gladia-default.test.ts', [
    command('transcribe-gladia-default', 'transcribe-gladia-default', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'gladia=default', '--price']),
    command('transcribe-happyscribe-auto', 'transcribe-happyscribe-auto', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'happyscribe=auto', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/deepgram-nova-3.test.ts', [
    command('transcribe-deepgram-nova-3', 'transcribe-deepgram-nova-3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'deepgram=nova-3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/deepinfra-openai-whisper-large-v3.test.ts', [
    command('transcribe-deepinfra-openai/whisper-large-v3', 'transcribe-deepinfra-openai/whisper-large-v3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'deepinfra=openai/whisper-large-v3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/deepinfra-openai-whisper-large-v3-turbo.test.ts', [
    command('transcribe-deepinfra-openai/whisper-large-v3-turbo', 'transcribe-deepinfra-openai/whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'deepinfra=openai/whisper-large-v3-turbo', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/together-openai-whisper-large-v3.test.ts', [
    command('transcribe-together-openai/whisper-large-v3', 'transcribe-together-openai/whisper-large-v3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'together=openai/whisper-large-v3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/soniox-stt-async-v4.test.ts', [
    command('transcribe-soniox-stt-async-v4', 'transcribe-soniox-stt-async-v4', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'soniox=stt-async-v4', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/speechmatics-enhanced.test.ts', [
    command('transcribe-speechmatics-enhanced', 'transcribe-speechmatics-enhanced', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'speechmatics=enhanced', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/rev-machine.test.ts', [
    command('transcribe-rev-machine', 'transcribe-rev-machine', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--provider', 'rev=machine', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/rev-low-cost.test.ts', [
    command('transcribe-rev-low_cost', 'transcribe-rev-low_cost', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--provider', 'rev=low_cost', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/groq-whisper-large-v3.test.ts', [
    command('transcribe-groq-whisper-large-v3', 'transcribe-groq-whisper-large-v3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'groq=whisper-large-v3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/groq-whisper-large-v3-turbo.test.ts', [
    command('transcribe-groq-whisper-large-v3-turbo', 'transcribe-groq-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'groq=whisper-large-v3-turbo', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/grok-speech-to-text.test.ts', [
    command('transcribe-grok-speech-to-text', 'transcribe-grok-speech-to-text', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'grok=speech-to-text', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/mistral-voxtral-mini-2602.test.ts', [
    command('transcribe-mistral-voxtral-mini-2602', 'transcribe-mistral-voxtral-mini-2602', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--provider', 'mistral=voxtral-mini-2602', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/gemini-3-flash-preview.test.ts', [
    command('transcribe-gemini-stt-gemini-3-flash-preview', 'transcribe-gemini-stt-gemini-3-flash-preview', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/examples/0-audio-short.mp3', '--provider', 'gemini=gemini-3-flash-preview', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/supadata-auto-url-transcript.test.ts', [
    command('transcribe-supadata-auto', 'transcribe-supadata-auto', ['src/cli/create-cli.ts', 'extract', 'https://www.youtube.com/watch?v=u1-WHqATSQU', '--provider', 'supadata=auto', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-stt-e2e/stt-services/scrapecreators-youtube-transcript.test.ts', [
    command('transcribe-scrapecreators-youtube-transcript', 'transcribe-scrapecreators-youtube-transcript', ['src/cli/create-cli.ts', 'extract', 'https://www.youtube.com/watch?v=u1-WHqATSQU', '--provider', 'scrapecreators=youtube-transcript', '--price']),
  ]),
  ...exact('test/test-cases/e2e/local/step-7-music-lyrics-video-e2e/music-lyrics-video.test.ts', [
    command('transcribe-whisper-tiny', 'transcribe-whisper-tiny', ['src/cli/create-cli.ts', 'music', '--audio', 'input/examples/audio/0-audio-short.mp3', '--model', 'tiny', '--price']),
    command('transcribe-whisper-large-v3-turbo', 'transcribe-whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'music', '--audio', 'input/examples/lyrics/01-example-song.mp3', '--price']),
  ]),
]
