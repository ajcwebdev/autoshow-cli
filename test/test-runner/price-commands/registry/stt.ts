import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

// Probe local copies of the media fixtures so pricing does not depend on remote media latency.
export const sttRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/local/stt/whisperfile/whisperfile-default.test.ts', [
    ...['tiny', 'tiny.en', 'small', 'small.en'].map(model => command(`transcribe-whisperfile-${model}`, `transcribe-whisperfile-${model}`, ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--provider', `whisperfile=${model}`, '--price'])),
    command('transcribe-whisperfile-default', 'transcribe-whisperfile-default', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--price']),
    command('transcribe-whisperfile-omitted-model', 'transcribe-whisperfile-omitted-model', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--provider', 'whisperfile', '--price']),
    command('transcribe-whisperfile-split', 'transcribe-whisperfile-split', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--provider', 'whisperfile=tiny', '--split', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/stt/diarization/assemblyai-current-models.test.ts', [
    command('transcribe-assemblyai-universal-3-5-pro', 'transcribe-assemblyai-universal-3-5-pro', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--provider', 'assemblyai=universal-3-5-pro', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/stt/diarization/gladia-current-models.test.ts', [
    command('transcribe-gladia-solaria-3', 'transcribe-gladia-solaria-3', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--provider', 'gladia=solaria-3', '--price']),
    command('transcribe-happyscribe-auto', 'transcribe-happyscribe-auto', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--provider', 'happyscribe=auto', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/stt/diarization/deepgram-nova-3.test.ts', [
    command('transcribe-deepgram-nova-3', 'transcribe-deepgram-nova-3', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--provider', 'deepgram=nova-3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/stt/diarization-off-by-default/deepinfra-openai-whisper-large-v3.test.ts', [
    command('transcribe-deepinfra-openai/whisper-large-v3', 'transcribe-deepinfra-openai/whisper-large-v3', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--provider', 'deepinfra=openai/whisper-large-v3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/stt/diarization-off-by-default/deepinfra-openai-whisper-large-v3-turbo.test.ts', [
    command('transcribe-deepinfra-openai/whisper-large-v3-turbo', 'transcribe-deepinfra-openai/whisper-large-v3-turbo', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--provider', 'deepinfra=openai/whisper-large-v3-turbo', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/stt/diarization-off-by-default/deepinfra-qwen3-asr.test.ts', [
    command('transcribe-deepinfra-Qwen/Qwen3-ASR-0.6B', 'transcribe-deepinfra-Qwen/Qwen3-ASR-0.6B', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/0-audio-short.mp3', '--provider', 'deepinfra=Qwen/Qwen3-ASR-0.6B', '--price']),
    command('transcribe-deepinfra-Qwen/Qwen3-ASR-1.7B', 'transcribe-deepinfra-Qwen/Qwen3-ASR-1.7B', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/0-audio-short.mp3', '--provider', 'deepinfra=Qwen/Qwen3-ASR-1.7B', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/stt/diarization-off-by-default/deepinfra-voxtral.test.ts', [
    command('transcribe-deepinfra-mistralai/Voxtral-Mini-3B-2507', 'transcribe-deepinfra-mistralai/Voxtral-Mini-3B-2507', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/0-audio-short.mp3', '--provider', 'deepinfra=mistralai/Voxtral-Mini-3B-2507', '--price']),
    command('transcribe-deepinfra-mistralai/Voxtral-Small-24B-2507', 'transcribe-deepinfra-mistralai/Voxtral-Small-24B-2507', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/0-audio-short.mp3', '--provider', 'deepinfra=mistralai/Voxtral-Small-24B-2507', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/stt/diarization-off-by-default/deepinfra-nemotron-3.5-asr-streaming-multilingual.test.ts', [
    command('transcribe-deepinfra-nvidia/Nemotron-3.5-ASR-Streaming-Multilingual-0.6b', 'transcribe-deepinfra-nvidia/Nemotron-3.5-ASR-Streaming-Multilingual-0.6b', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/0-audio-short.mp3', '--provider', 'deepinfra=nvidia/Nemotron-3.5-ASR-Streaming-Multilingual-0.6b', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/stt/diarization-off-by-default/openai-gpt-transcribe.test.ts', [
    command('transcribe-openai-stt-gpt-transcribe', 'transcribe-openai-stt-gpt-transcribe', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/0-audio-short.mp3', '--provider', 'openai=gpt-transcribe', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/stt/diarization-off-by-default/together-current-models.test.ts', [
    command('transcribe-together-openai/whisper-large-v3', 'transcribe-together-openai/whisper-large-v3', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--provider', 'together=openai/whisper-large-v3', '--price']),
    command('transcribe-together-nvidia/parakeet-tdt-0.6b-v3', 'transcribe-together-nvidia/parakeet-tdt-0.6b-v3', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--provider', 'together=nvidia/parakeet-tdt-0.6b-v3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/stt/diarization/soniox-stt-async-v5.test.ts', [
    command('transcribe-soniox-stt-async-v5', 'transcribe-soniox-stt-async-v5', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--provider', 'soniox=stt-async-v5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/stt/diarization/speechmatics-current-models.test.ts', [
    command('transcribe-speechmatics-melia-1', 'transcribe-speechmatics-melia-1', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--provider', 'speechmatics=melia-1', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/stt/diarization/grok-speech-to-text.test.ts', [
    command('transcribe-grok-speech-to-text', 'transcribe-grok-speech-to-text', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--provider', 'grok=speech-to-text', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/stt/diarization/mistral-voxtral-mini-2602.test.ts', [
    command('transcribe-mistral-voxtral-mini-2602', 'transcribe-mistral-voxtral-mini-2602', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/1-audio.mp3', '--provider', 'mistral=voxtral-mini-2602', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/stt/diarization/gemini-3.5-transcribe.test.ts', [
    command('transcribe-gemini-stt-gemini-3.5-transcribe', 'transcribe-gemini-stt-gemini-3.5-transcribe', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/0-audio-short.mp3', '--provider', 'gemini=gemini-3.5-transcribe', '--price']),
  ]),
  ...exact('test/test-cases/e2e/local/audio/music/music-lyrics-video.test.ts', [
    command('transcribe-whisperfile-tiny', 'transcribe-whisperfile-tiny', ['src/cli/create-cli.ts', 'music', '--audio', 'input/examples/audio/0-audio-short.mp3', '--model', 'tiny', '--price']),
    command('transcribe-whisperfile-small.en', 'transcribe-whisperfile-small.en', ['src/cli/create-cli.ts', 'music', '--audio', 'input/examples/lyrics/01-example-song.mp3', '--price']),
  ]),

]
