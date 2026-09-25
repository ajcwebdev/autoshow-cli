import { validateGeminiTtsModel } from '~/cli/commands/setup-and-utilities/models/tts-models'
import { UsageError } from '~/utils/error-handler'

export const GEMINI_TTS_VOICES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'] as const
export const GEMINI_TTS_MIME: Readonly<Record<string, string>> = { wav: 'audio/wav', pcm: 'audio/l16', mulaw: 'audio/mulaw', alaw: 'audio/alaw' }
export type GeminiSpeechTurn = { text: string, speaker: string, voice: string, style?: string | undefined }
export const validateGeminiVoice = (voice: string): string => {
  const value = voice.trim()
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,199}$/.test(value) || value.startsWith('voicekey_')) throw UsageError('Gemini requires a prebuilt/library voice ID or a persistent voice_ resource; stateless voice keys are unsupported.')
  return GEMINI_TTS_VOICES.find(v => v.toLowerCase() === value.toLowerCase()) ?? value
}
export const isGeminiPrebuiltVoice = (voice: string): boolean => (GEMINI_TTS_VOICES as readonly string[]).includes(voice)
export const geminiSpeechMime = (format: string | undefined, stream = false): string => {
  const mime = GEMINI_TTS_MIME[format ?? (stream ? 'pcm' : 'wav')]
  if (!mime) throw UsageError('Gemini TTS response format must be wav, pcm, mulaw, or alaw.')
  return mime
}
export const validateGeminiTurns = (model: string, turns: readonly GeminiSpeechTurn[]): void => {
  validateGeminiTtsModel(model)
  if (!turns.length || turns.some(t => !t.text.trim() || !t.speaker.trim())) throw UsageError('Gemini synthesis requires nonempty text and a speaker on every turn.')
  const speakers = new Map<string, string>()
  for (const turn of turns) {
    validateGeminiVoice(turn.voice)
    if (speakers.has(turn.speaker) && speakers.get(turn.speaker) !== turn.voice) throw UsageError('Gemini native dialogue cannot change a speaker voice within a take.')
    speakers.set(turn.speaker, turn.voice)
  }
  if (speakers.size > 2 || speakers.size === 2 && [...speakers.values()].some(v => !isGeminiPrebuiltVoice(v))) throw UsageError('Gemini native dialogue requires two eligible prebuilt voices; use segmented dialogue.')
  // UTF-8 bytes are a conservative token bound, including all metadata and request overhead.
  if (Buffer.byteLength(JSON.stringify(turns.map(({ text, speaker, voice, style }) => ({ text, speaker, voice, style })))) + 512 > 8192) throw UsageError('Gemini TTS turn group exceeds the conservative 8,192 input-token limit; shorten the text or style.')
}
export const serializeGeminiInteraction = (model: string, turns: readonly GeminiSpeechTurn[], format?: string, stream = false) => {
  validateGeminiTurns(model, turns)
  const speakers = [...new Map(turns.map(t => [t.speaker, t.voice])).entries()].map(([speaker, voice]) => ({ speaker, voice }))
  const dialogue = speakers.length === 2
  return {
    model,
    // The service rejects named-speaker fields for single-voice synthesis.
    // Keep canonical speaker identity locally; only two-speaker takes name speakers on the wire.
    input: [{ type: 'user_input', content: turns.map(t => ({ type: 'text', text: t.text, ...(dialogue || t.style ? { annotations: [{ type: 'speech_metadata', ...(dialogue ? { speaker: t.speaker } : {}), ...(t.style ? { style: t.style } : {}) }] } : {}) })) }],
    response_format: { type: 'audio', mime_type: geminiSpeechMime(format, stream), sample_rate: 24000 },
    generation_config: { max_output_tokens: 16384, speech_config: dialogue ? { mode: 'conversational', speakers } : [{ voice: speakers[0]!.voice }] },
    ...(stream ? { stream: true } : {}),
  }
}
export const serializeGeminiBatchSpeech = (model: string, turns: readonly GeminiSpeechTurn[], format?: string) => {
  validateGeminiTurns(model, turns)
  // GenerateContent's published speech contract only establishes WAV output for 3.8.
  if (format && format !== 'wav') throw UsageError('Gemini Batch speech supports WAV; choose unary or stream for PCM, mu-law, or A-law.')
  const speakers = [...new Map(turns.map(t => [t.speaker, t.voice])).entries()]
  return {
    contents: [{ role: 'user', parts: turns.map(t => ({ text: t.text, speech_metadata: { speaker: t.speaker, ...(t.style ? { style: t.style } : {}) } })) }],
    generationConfig: { responseModalities: ['AUDIO'], maxOutputTokens: 16384, speechConfig: speakers.length === 2
      ? { multiSpeakerVoiceConfig: { speakerVoiceConfigs: speakers.map(([speaker, voiceName]) => ({ speaker, voiceConfig: { prebuiltVoiceConfig: { voiceName } } })) } }
      : { voiceConfig: { voice: speakers[0]![1] } } },
  }
}
