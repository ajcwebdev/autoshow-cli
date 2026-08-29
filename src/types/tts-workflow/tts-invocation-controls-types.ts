import type { TtsProvider } from '~/types'

type OptionalControl<T> = T | null | undefined

type TtsInvocationControlsByProvider = {
  openai: Readonly<{
    instructions?: OptionalControl<string>
    speed?: OptionalControl<number>
  }>
  elevenlabs: Readonly<{
    languageCode?: OptionalControl<string>
    stability?: OptionalControl<number>
    similarityBoost?: OptionalControl<number>
    style?: OptionalControl<number>
    useSpeakerBoost?: OptionalControl<boolean>
    speed?: OptionalControl<number>
    seed?: OptionalControl<number>
    textNormalization?: OptionalControl<string>
    pronunciationDictionaryLocators?: OptionalControl<readonly string[]>
  }>
  minimax: Readonly<{
    languageBoost?: OptionalControl<string>
    speed?: OptionalControl<number>
    volume?: OptionalControl<number>
    pitch?: OptionalControl<number>
    emotion?: OptionalControl<string>
    englishNormalization?: OptionalControl<boolean>
    pronunciations?: OptionalControl<readonly string[]>
  }>
  grok: Readonly<{
    language?: OptionalControl<string>
    textNormalization?: OptionalControl<boolean>
  }>
  mistral: Readonly<{ responseFormat?: OptionalControl<'wav' | 'mp3' | 'flac' | 'opus'> }>
  speechify: Readonly<{
    language?: OptionalControl<string>
  }>
  hume: Readonly<{
    speed?: OptionalControl<number>
    trailingSilence?: OptionalControl<number>
    description?: OptionalControl<string>
  }>
  cartesia: Readonly<{ language?: OptionalControl<string> }>
  fish: Readonly<{ latency?: OptionalControl<string> }>
  inworld: Readonly<{ steeringPrompt?: OptionalControl<string> }>
  deepinfra: Readonly<{ promptInstructions?: OptionalControl<string> }>
}

type TtsInvocationControlsFor<P extends TtsProvider> = TtsInvocationControlsByProvider[P]
export type TtsEffectiveInvocationControlsFor<P extends TtsProvider> = Readonly<{
  [K in keyof TtsInvocationControlsFor<P>]?: Exclude<TtsInvocationControlsFor<P>[K], null | undefined> | undefined
}>

type StringControlSpec = Readonly<{
  kind: 'string'
  normalize?: ((value: string) => string) | undefined
  preserveWhitespace?: boolean | undefined
  allowedValues?: readonly string[] | undefined
}>

type NumberControlSpec = Readonly<{
  kind: 'number'
  min?: number | undefined
  max?: number | undefined
  exclusiveMin?: boolean | undefined
  integer?: boolean | undefined
}>

export type ControlSpec = StringControlSpec
  | NumberControlSpec
  | Readonly<{ kind: 'boolean' }>
  | Readonly<{ kind: 'string-array' }>

export type ProviderControlSpecs = Readonly<Record<string, ControlSpec>>
