import type { TtsProvider } from '~/types'

type OptionalControl<T> = T | null | undefined

export type TtsInvocationControlsByProvider = {
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
    responseFormat?: OptionalControl<'mp3_44100_128' | 'mp3_44100_192' | 'wav_44100' | 'wav_48000'>
  }>
  grok: Readonly<{
    speed?: OptionalControl<number>
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
    responseFormat?: OptionalControl<'mp3' | 'wav'>
  }>
  cartesia: Readonly<{ language?: OptionalControl<string>, speed?: OptionalControl<number> }>
  inworld: Readonly<{ steeringPrompt?: OptionalControl<string>, speed?: OptionalControl<number> }>
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
  /** Help-only override/qualification; does not change runtime validation. */
  helpNote?: string | undefined
  /** When true, omit this provider from --help accepted-value clauses (runtime unchanged). */
  helpOmit?: boolean | undefined
}>

type NumberControlSpec = Readonly<{
  kind: 'number'
  min?: number | undefined
  max?: number | undefined
  exclusiveMin?: boolean | undefined
  integer?: boolean | undefined
  /** Help-only override/qualification; does not change runtime validation. */
  helpNote?: string | undefined
  /** When true, omit this provider from --help accepted-value clauses (runtime unchanged). */
  helpOmit?: boolean | undefined
}>

export type ControlSpec = StringControlSpec
  | NumberControlSpec
  | Readonly<{ kind: 'boolean', helpNote?: string | undefined, helpOmit?: boolean | undefined }>
  | Readonly<{ kind: 'string-array', helpNote?: string | undefined, helpOmit?: boolean | undefined }>

export type ProviderControlSpecs = Readonly<Record<string, ControlSpec>>
