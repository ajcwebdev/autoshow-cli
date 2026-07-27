import type { RuntimeOptions, Step2ProviderSelectionFilter, SttSource, SttSourceEligibility, SttTarget } from '~/types'
import { SUPPORTED_SCRAPECREATORS_STT_MODELS } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { collectStep2ProviderSelections } from '../step-2-shared/provider-registry'
import { collectSttProviderSpecs, resolveDiarizationOptions } from './stt-cli'
import { resolveReverbModelLabel } from './stt-model-labels'
import { isScrapeCreatorsSupportedSourceUrl } from './stt-services/scrapecreators/scrapecreators'
import { isSupadataSupportedSourceUrl } from './stt-services/stt-supadata/supadata'


const LOCAL_STT_SERVICES = new Set<SttTarget['service']>([
  'reverb',
  'whisper',
  'whisperfile'
])

const URL_ONLY_STT_SERVICES = new Set<SttTarget['service']>([
  'supadata',
  'scrapecreators'
])

const scrapeCreatorsAllProviderModel = SUPPORTED_SCRAPECREATORS_STT_MODELS[0] ?? 'youtube-transcript'

const sanitizeSegment = (value: string): string =>
  value.replace(/[/\\:*?"<>|]+/g, '_')

export const getSttTargetKey = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service}:${target.model}`

const formatSttTargetModel = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  target.service === 'reverb' ? resolveReverbModelLabel(target.model) : target.model

export const formatSttTargetLabel = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service === 'whisper' ? 'whisper.cpp' : target.service}/${formatSttTargetModel(target)}`

export const getSttTargetDirectoryName = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${sanitizeSegment(target.service)}-${sanitizeSegment(target.model)}`

const buildSttTarget = (
  options: RuntimeOptions,
  provider: string,
  selectedModel?: string | undefined
): SttTarget => {
  const service = provider as SttTarget['service']
  const model = selectedModel ?? service

  return {
    service,
    model,
    local: LOCAL_STT_SERVICES.has(service),
    ...(LOCAL_STT_SERVICES.has(service)
      ? {}
      : { diarizationOptions: resolveDiarizationOptions(options, service) })
  } satisfies SttTarget
}

export const resolveSttSourceEligibility = (
  source: SttSource
): SttSourceEligibility => ({
  supadata: isSupadataSupportedSourceUrl(source.url),
  scrapecreators: isScrapeCreatorsSupportedSourceUrl(source.url)
})

export const sttSourceFromInput = (
  input: string
): SttSource => /^https?:\/\//i.test(input)
  ? { url: input }
  : { filePath: input }

export const collectSttTargets = (
  options: RuntimeOptions,
  filter?: Step2ProviderSelectionFilter
): SttTarget[] => {
  return collectSttProviderSpecs(options, filter).map((spec) => {
    return buildSttTarget(options, spec.provider, spec.model)
  })
}

export const collectSttTargetsForSource = (
  options: RuntimeOptions,
  source: SttSource,
  filter?: Step2ProviderSelectionFilter
): SttTarget[] => {
  const targets = collectSttTargets(options, filter)
  const selections = collectStep2ProviderSelections('stt', options as Record<string, unknown>, filter)
  const allShortcutTargetKeys = new Set(
    selections
      .filter((selection) => selection.origin === 'all-shortcut')
      .map((selection) => getSttTargetKey({
        service: selection.providerSpecProvider as SttTarget['service'],
        model: selection.model
      }))
  )
  const allShortcutHostedSttSelected = selections.some((selection) =>
    selection.origin === 'all-shortcut'
    && !LOCAL_STT_SERVICES.has(selection.providerSpecProvider as SttTarget['service'])
  )
  const eligibility = resolveSttSourceEligibility(source)
  const filteredTargets = targets.filter((target) => {
    if (!URL_ONLY_STT_SERVICES.has(target.service) || !allShortcutTargetKeys.has(getSttTargetKey(target))) {
      return true
    }

    if (target.service === 'supadata') {
      return eligibility.supadata
    }

    if (target.service === 'scrapecreators') {
      return eligibility.scrapecreators
    }

    return true
  })

  if (
    allShortcutHostedSttSelected
    && eligibility.scrapecreators
    && !filteredTargets.some((target) => target.service === 'scrapecreators' && target.model === scrapeCreatorsAllProviderModel)
  ) {
    const scrapeCreatorsTarget = buildSttTarget(options, 'scrapecreators', scrapeCreatorsAllProviderModel)
    const lastSupadataIndex = filteredTargets
      .map((target, index) => ({ target, index }))
      .filter((entry) => entry.target.service === 'supadata')
      .at(-1)?.index

    if (lastSupadataIndex === undefined) {
      filteredTargets.push(scrapeCreatorsTarget)
    } else {
      filteredTargets.splice(lastSupadataIndex + 1, 0, scrapeCreatorsTarget)
    }
  }

  return filteredTargets
}
