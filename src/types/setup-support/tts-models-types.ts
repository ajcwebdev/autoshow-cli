export type OpenAITtsVoiceSelection = Readonly<
  | { kind: 'built-in', voiceId: string, requestVoice: string }
  | { kind: 'custom', voiceId: string, requestVoice: Readonly<{ id: string }> }
>
