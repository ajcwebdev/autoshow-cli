import { CARTESIA_MODELS_LINKS, DEAPI_MODELS_LINKS, GROK_MODELS_LINKS, MISTRAL_MODELS_LINKS, SPEECHIFY_MODELS_LINKS, TOGETHER_MODELS_LINKS } from './model-providers'

export const GROK_GENERAL_LINKS = [
  'https://docs.x.ai/developers/rate-limits.md'
]

export const GROK_TEXT_LINKS = [
  'https://docs.x.ai/developers/rest-api-reference/inference/chat.md',
  'https://docs.x.ai/developers/advanced-api-usage/prompt-caching.md',
  'https://docs.x.ai/developers/advanced-api-usage/context-compaction.md'
]

export const GROK_IMAGE_LINKS = [
  'https://docs.x.ai/developers/rest-api-reference/inference/images.md'
]

export const GROK_VIDEO_LINKS = [
  'https://docs.x.ai/developers/rest-api-reference/inference/videos.md'
]

export const GROK_TTS_LINKS = [
  'https://docs.x.ai/developers/rest-api-reference/inference/voice.md'
]

export const GROK_ALL_LINKS = [
  ...GROK_GENERAL_LINKS,
  ...GROK_MODELS_LINKS,
  ...GROK_TEXT_LINKS,
  ...GROK_IMAGE_LINKS,
  ...GROK_VIDEO_LINKS,
  ...GROK_TTS_LINKS
]

export const TOGETHER_GENERAL_LINKS = [
  'https://docs.together.ai/docs/introduction',
  'https://docs.together.ai/intro.md',
  'https://docs.together.ai/docs/quickstart.md',
  'https://docs.together.ai/docs/inference/overview.md',
  'https://docs.together.ai/docs/inference/pricing.md',
  'https://docs.together.ai/docs/serverless/rate-limits.md'
]

export const TOGETHER_STT_LINKS = [
  'https://docs.together.ai/reference/audio-transcriptions',
  'https://docs.together.ai/docs/speech-to-text.md',
  'https://raw.githubusercontent.com/togethercomputer/skills/refs/heads/main/skills/together-audio/SKILL.md',
  'https://raw.githubusercontent.com/togethercomputer/skills/refs/heads/main/skills/together-audio/scripts/stt_transcribe.ts',
  'https://docs.together.ai/reference/audio-transcriptions.md'
]

export const TOGETHER_TEXT_LINKS = [
  'https://docs.together.ai/docs/dedicated-endpoints/overview.md',
  'https://docs.together.ai/docs/dedicated-endpoints/quickstart.md',
  'https://docs.together.ai/docs/dedicated-endpoints/manage.md',
  'https://docs.together.ai/docs/dedicated-endpoints/settings.md',
  'https://docs.together.ai/docs/inference/chat/overview.md',
  'https://docs.together.ai/docs/inference/chat/parameters.md',
  'https://docs.together.ai/docs/inference/chat/structured-outputs.md'
]

export const TOGETHER_ALL_LINKS = [
  ...TOGETHER_GENERAL_LINKS,
  ...TOGETHER_MODELS_LINKS,
  ...TOGETHER_STT_LINKS,
  ...TOGETHER_TEXT_LINKS
]

export const MISTRAL_GENERAL_LINKS = [
  'https://docs.mistral.ai/resources/sdks',
  'https://raw.githubusercontent.com/mistralai/client-ts/refs/heads/main/README.md',
  'https://raw.githubusercontent.com/mistralai/client-ts/refs/heads/main/docs/lib/utils/retryconfig.md',
  'https://raw.githubusercontent.com/mistralai/client-ts/refs/heads/main/docs/sdks/files/README.md'
]

export const MISTRAL_STT_LINKS = [
  'https://docs.mistral.ai/studio-api/audio/speech_to_text',
  'https://docs.mistral.ai/studio-api/audio/speech_to_text/offline_transcription',
  'https://docs.mistral.ai/api/endpoint/audio/transcriptions',
  'https://raw.githubusercontent.com/mistralai/client-ts/refs/heads/main/docs/sdks/transcriptions/README.md'
]

export const MISTRAL_OCR_LINKS = [
  'https://docs.mistral.ai/studio-api/document-processing/basic_ocr',
  'https://docs.mistral.ai/api/endpoint/ocr',
  'https://raw.githubusercontent.com/mistralai/client-ts/refs/heads/main/docs/sdks/ocr/README.md',
  'https://raw.githubusercontent.com/mistralai/client-ts/refs/heads/main/docs/sdks/documents/README.md'
]

export const MISTRAL_TTS_LINKS = [
  'https://mistral.ai/news/voxtral-tts',
  'https://docs.mistral.ai/studio-api/audio/text_to_speech',
  'https://docs.mistral.ai/api/endpoint/audio/speech',
  'https://docs.mistral.ai/api/endpoint/audio/voices',
  'https://docs.mistral.ai/studio-api/audio/text_to_speech/voices',
  'https://docs.mistral.ai/studio-api/audio/text_to_speech/speech',
  'https://raw.githubusercontent.com/mistralai/client-ts/refs/heads/main/docs/sdks/speech/README.md',
  'https://raw.githubusercontent.com/mistralai/client-ts/refs/heads/main/docs/sdks/voices/README.md'
]

export const MISTRAL_ALL_LINKS = [
  ...MISTRAL_GENERAL_LINKS,
  ...MISTRAL_MODELS_LINKS,
  ...MISTRAL_STT_LINKS,
  ...MISTRAL_OCR_LINKS,
  ...MISTRAL_TTS_LINKS
]

export const CARTESIA_GENERAL_LINKS = [
  'https://docs.cartesia.ai/get-started/overview.md',
  'https://docs.cartesia.ai/get-started/authenticate-your-client-applications.md',
  'https://docs.cartesia.ai/tools/client-libraries.md',
  'https://docs.cartesia.ai/use-the-api/api-conventions.md',
  'https://docs.cartesia.ai/use-the-api/api-errors.md',
  'https://docs.cartesia.ai/use-the-api/concurrency-limits-and-timeouts.md'
]

export const CARTESIA_TTS_LINKS = [
  'https://docs.cartesia.ai/get-started/realtime-text-to-speech-quickstart.md',
  'https://docs.cartesia.ai/api-reference/tts/bytes.md',
  'https://docs.cartesia.ai/api-reference/tts/sse.md',
  'https://docs.cartesia.ai/api-reference/tts/websocket.md',
  'https://docs.cartesia.ai/use-the-api/compare-tts-endpoints.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/choosing-a-voice.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/choosing-tts-parameters.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/clone-voices.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/clone-voices-pro/api.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/custom-pronunciations.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/localize-voices.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/prompting-tips.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/ssml-tags.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/stream-inputs-using-continuations.md',
  'https://docs.cartesia.ai/build-with-cartesia/capability-guides/volume-speed-emotion.md',
  'https://docs.cartesia.ai/use-the-api/tts-websocket/buffering.md',
  'https://docs.cartesia.ai/use-the-api/tts-websocket/context-flushing-and-flush-i-ds.md',
  'https://docs.cartesia.ai/use-the-api/tts-websocket/contexts.md',
  'https://docs.cartesia.ai/api-reference/voices/list.md',
  'https://docs.cartesia.ai/api-reference/voices/clone.md',
  'https://docs.cartesia.ai/api-reference/voices/localize.md',
  'https://docs.cartesia.ai/api-reference/voices/get.md',
  'https://docs.cartesia.ai/api-reference/voices/update.md',
  'https://docs.cartesia.ai/api-reference/voices/delete.md'
]

export const CARTESIA_ALL_LINKS = [
  ...CARTESIA_GENERAL_LINKS,
  ...CARTESIA_MODELS_LINKS,
  ...CARTESIA_TTS_LINKS
]

export const SPEECHIFY_TTS_LINKS = [
  'https://docs.sws.speechify.com/tts/text-to-speech/get-started/overview.md',
  'https://docs.sws.speechify.com/tts/text-to-speech/get-started/quickstart.md',
  'https://docs.sws.speechify.com/tts/text-to-speech/get-started/authentication.md',
  'https://docs.sws.speechify.com/tts/text-to-speech/get-started/api-limits.md',
  'https://docs.sws.speechify.com/tts/text-to-speech/get-started/official-sdks.md',
  'https://docs.sws.speechify.com/tts/text-to-speech/features/voice-cloning.md',
  'https://docs.sws.speechify.com/tts/api-reference/api-reference/introduction.md',
  'https://docs.sws.speechify.com/tts/api-reference/api-reference/authentication.md',
  'https://docs.sws.speechify.com/tts/api-reference/api-reference/text-to-speech/audio/speech.md',
  'https://docs.sws.speechify.com/tts/api-reference/api-reference/text-to-speech/voices/list.md',
  'https://docs.sws.speechify.com/tts/api-reference/api-reference/text-to-speech/voices/create.md',
  'https://docs.sws.speechify.com/tts/api-reference/api-reference/text-to-speech/voices/delete.md',
  'https://docs.sws.speechify.com/tts/api-reference/api-reference/text-to-speech/voices/download-sample.md'
]

export const SPEECHIFY_ALL_LINKS = [
  ...SPEECHIFY_MODELS_LINKS,
  ...SPEECHIFY_TTS_LINKS
]

export const HUME_GENERAL_LINKS = [
  'https://dev.hume.ai/intro.md',
  'https://dev.hume.ai/docs/introduction/api-key.md',
  'https://dev.hume.ai/docs/resources/use-case-guidelines.md',
  'https://dev.hume.ai/docs/resources/billing.md',
  'https://dev.hume.ai/docs/resources/errors.md',
  'https://dev.hume.ai/docs/resources/privacy.md'
]

export const HUME_TTS_LINKS = [
  'https://dev.hume.ai/docs/text-to-speech-tts/overview.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/quickstart/typescript.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/quickstart/python.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/quickstart/dotnet.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/quickstart/cli.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/voice.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/acting-instructions.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/voice-conversion.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/continuation.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/timestamps.md',
  'https://dev.hume.ai/docs/text-to-speech-tts/faq.md',
  'https://dev.hume.ai/docs/voice/overview.md',
  'https://dev.hume.ai/docs/voice/voice-design.md',
  'https://dev.hume.ai/docs/voice/voice-cloning.md',
  'https://dev.hume.ai/docs/voice/management.md',
  'https://dev.hume.ai/reference/voices/create.md',
  'https://dev.hume.ai/reference/voices/list.md',
  'https://dev.hume.ai/reference/voices/delete.md',
  'https://dev.hume.ai/reference/text-to-speech-tts/stream-input.md',
  'https://dev.hume.ai/reference/text-to-speech-tts/synthesize-json-streaming.md',
  'https://dev.hume.ai/reference/text-to-speech-tts/synthesize-file-streaming.md',
  'https://dev.hume.ai/reference/text-to-speech-tts/synthesize-json.md',
  'https://dev.hume.ai/reference/text-to-speech-tts/synthesize-file.md',
  'https://dev.hume.ai/reference/text-to-speech-tts/convert-voice-file.md',
  'https://dev.hume.ai/reference/text-to-speech-tts/convert-voice-json.md'
]

export const DEAPI_STT_LINKS = [
  'https://docs.deapi.ai/api/v2/audio/transcriptions.md',
  'https://docs.deapi.ai/quickstart.md',
  'https://docs.deapi.ai/pricing.md',
  'https://docs.deapi.ai/architecture-and-security.md',
  'https://docs.deapi.ai/limits-and-quotas.md',
  'https://docs.deapi.ai/execution-modes-and-integrations/execution-modes-and-http-queue.md',
  'https://docs.deapi.ai/execution-modes-and-integrations/webhooks.md',
  'https://docs.deapi.ai/other/faq-frequently-asked-questions.md',
  'https://docs.deapi.ai/api/v2/overview',
  'https://docs.deapi.ai/api/v2/errors.md'
]

export const DEAPI_ALL_LINKS = [
  ...DEAPI_MODELS_LINKS,
  ...DEAPI_STT_LINKS
]
