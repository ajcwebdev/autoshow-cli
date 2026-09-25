import type { TtsProvider, TtsTarget } from '~/types'
import { UsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'

const SPEECH_MARKUP = /<\/?(speak|break|phoneme|prosody|emphasis|say-as|sub|lang|voice|mark|audio)\b[^>]*>/giu
const INLINE_TAG = /\[([^\[\]\n]{1,400})\]/gu
const MAX_TAG_WORDS = 4
const MAX_TAG_CHARACTERS = 40

export type TtsSpeechMarkupSupport = 'supported' | 'unsupported' | 'unverified'

// 'unsupported' and 'supported' both need provider documentation; unsupported markup would be read
// aloud and billed. Everything else is sent verbatim with a warning until support is verified.
const SPEECH_MARKUP_SUPPORT: Partial<Record<TtsProvider, (model: string) => TtsSpeechMarkupSupport>> = {
  elevenlabs: (model) => model === 'eleven_v3' ? 'unsupported' : 'unverified',
  speechify: () => 'supported',
  inworld: () => 'supported',
}

export const ttsSpeechMarkupSupport = (target: Pick<TtsTarget, 'service' | 'model'>): TtsSpeechMarkupSupport =>
  SPEECH_MARKUP_SUPPORT[target.service]?.(target.model) ?? 'unverified'

export type TtsTextPreflightFinding = {
  kind: 'speech-markup' | 'long-inline-tag'
  severity: 'error' | 'warning'
  target: string
  excerpt: string
}

const excerpt = (value: string): string => value.length > 60 ? `${value.slice(0, 57)}...` : value

export const inspectTtsText = (text: string, targets: readonly Pick<TtsTarget, 'service' | 'model'>[]): TtsTextPreflightFinding[] => {
  const markup = [...new Set([...text.matchAll(SPEECH_MARKUP)].map((match) => match[0]))]
  const longTags = [...new Set([...text.matchAll(INLINE_TAG)]
    .map((match) => match[1] as string)
    .filter((content) => content.length > MAX_TAG_CHARACTERS || content.trim().split(/\s+/u).length > MAX_TAG_WORDS))]
  return targets.flatMap((target) => {
    const label = `${target.service}/${target.model}`
    const support = ttsSpeechMarkupSupport(target)
    const severity = support === 'unsupported' ? 'error' as const : 'warning' as const
    return [
      ...(support === 'supported' ? [] : markup).map((tag) => ({ kind: 'speech-markup' as const, severity, target: label, excerpt: excerpt(tag) })),
      ...longTags.map((content) => ({ kind: 'long-inline-tag' as const, severity: 'warning' as const, target: label, excerpt: excerpt(`[${content}]`) })),
    ]
  })
}

export const preflightTtsText = (text: string, targets: readonly Pick<TtsTarget, 'service' | 'model'>[], enabled: boolean | undefined): void => {
  if (enabled === false) return
  const findings = inspectTtsText(text, targets)
  const errors = findings.filter((finding) => finding.severity === 'error')
  if (errors.length > 0) {
    const first = errors[0] as TtsTextPreflightFinding
    throw UsageError(
      `${first.target} does not support SSML-style speech markup; ${errors.length === 1 ? `${first.excerpt} would` : `${errors.length} tags such as ${first.excerpt} would`} be read aloud and billed. No provider request was made.`,
      { hints: ['Remove the markup, or use the provider\'s documented pause and delivery tags instead.', 'Pass --tts-text-preflight off to send the text unchanged.'] }
    )
  }
  for (const [kind, message] of [
    ['speech-markup', 'SSML-style speech markup is sent verbatim; support is unverified and it may be read aloud'],
    ['long-inline-tag', 'a long bracketed passage is likely to be read aloud rather than treated as a delivery tag'],
  ] as const) {
    const matched = findings.filter((finding) => finding.kind === kind && finding.severity === 'warning')
    if (matched.length === 0) continue
    const targetsLabel = [...new Set(matched.map((finding) => finding.target))].join(', ')
    l.warn(`TTS text preflight: ${message} (${targetsLabel}): ${(matched[0] as TtsTextPreflightFinding).excerpt}`, { category: 'pipeline' })
  }
}
