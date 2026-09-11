import { isAbsolute } from 'node:path'
import type { OcrPoolLedger, OcrTarget } from '~/types'
import { isRecord } from '~/utils/rest-client'
import { getOcrTargetKey } from './ocr-run-state'

const OCR_POOL_SERVICES = new Set<OcrTarget['service']>(['tesseract', 'mistral', 'glm', 'kimi', 'openai', 'grok', 'anthropic', 'gemini', 'deepinfra'])

const isOcrPoolService = (value: unknown): value is OcrTarget['service'] =>
  typeof value === 'string' && OCR_POOL_SERVICES.has(value as OcrTarget['service'])

const finiteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const nonNegativeNumber = (value: unknown): value is number =>
  finiteNumber(value) && value >= 0

const containedArtifactDir = (value: unknown): value is string =>
  typeof value === 'string'
  && value.length > 0
  && !isAbsolute(value)
  && !value.split(/[\\/]/u).some((segment) => segment === '..')

const validStoredAttempt = (value: unknown): boolean =>
  isRecord(value)
  && Number.isInteger(value['attempt'])
  && nonNegativeNumber(value['attempt'])
  && typeof value['claimId'] === 'string'
  && isOcrPoolService(value['provider'])
  && typeof value['model'] === 'string'
  && typeof value['laneKey'] === 'string'
  && ['running', 'accepted', 'failed', 'ambiguous', 'interrupted'].includes(String(value['status']))
  && nonNegativeNumber(value['startedAtMs'])
  && containedArtifactDir(value['artifactDir'])

const validStoredAcceptedPage = (value: unknown): boolean =>
  isRecord(value)
  && isOcrPoolService(value['provider'])
  && typeof value['model'] === 'string'
  && Number.isInteger(value['attempt'])
  && nonNegativeNumber(value['attempt'])
  && nonNegativeNumber(value['acceptedAtMs'])
  && nonNegativeNumber(value['durationMs'])
  && containedArtifactDir(value['artifactDir'])
  && isRecord(value['result'])
  && Number.isInteger(value['result']['pageNumber'])
  && ['text', 'ocr', 'skipped'].includes(String(value['result']['method']))
  && typeof value['result']['text'] === 'string'

const validStoredPage = (value: unknown): boolean => {
  if (!isRecord(value) || !Number.isInteger(value['pageNumber']) || !nonNegativeNumber(value['pageNumber']) || !Array.isArray(value['attempts']) || !value['attempts'].every(validStoredAttempt)) return false
  const status = value['status']
  if (!['pending', 'claimed', 'accepted', 'exhausted'].includes(String(status))) return false
  if (status === 'accepted') return validStoredAcceptedPage(value['accepted'])
  if (value['accepted'] !== undefined) return false
  if (status !== 'claimed') return value['claim'] === undefined
  const claim = value['claim']
  return isRecord(claim)
    && typeof claim['claimId'] === 'string'
    && typeof claim['targetKey'] === 'string'
    && typeof claim['laneKey'] === 'string'
    && Number.isInteger(claim['attempt'])
    && nonNegativeNumber(claim['claimedAtMs'])
}

const validStoredTarget = (value: unknown): boolean =>
  isRecord(value)
  && isOcrPoolService(value['service'])
  && typeof value['model'] === 'string'
  && typeof value['targetKey'] === 'string'
  && typeof value['laneKey'] === 'string'
  && typeof value['local'] === 'boolean'
  && ['eligible', 'running', 'succeeded', 'retired'].includes(String(value['status']))
  && nonNegativeNumber(value['attempts'])
  && nonNegativeNumber(value['acceptedPages'])
  && nonNegativeNumber(value['active'])
  && nonNegativeNumber(value['activePeak'])

const validStoredLane = (value: unknown): boolean =>
  isRecord(value)
  && typeof value['laneKey'] === 'string'
  && isOcrPoolService(value['service'])
  && typeof value['local'] === 'boolean'
  && Number.isInteger(value['cap'])
  && finiteNumber(value['cap'])
  && value['cap'] > 0
  && ['eligible', 'retired'].includes(String(value['status']))
  && nonNegativeNumber(value['active'])
  && nonNegativeNumber(value['activePeak'])

const validStoredTelemetry = (value: unknown): boolean => {
  if (!isRecord(value)) return false
  const numberKeys = ['queueDepth', 'queueDepthPeak', 'claims', 'acceptedPages', 'requeues', 'handoffs', 'exhaustedPages', 'duplicateCommitsPrevented', 'ambiguousAttempts', 'interruptedClaimsRecovered', 'retryPressure', 'pauseTimeMs']
  const mapKeys = ['targetActivePeaks', 'laneCaps', 'targetPageShare', 'targetThroughputPagesPerMinute']
  return numberKeys.every((key) => nonNegativeNumber(value[key]))
    && Array.isArray(value['retiredTargets'])
    && value['retiredTargets'].every((entry) => typeof entry === 'string')
    && Array.isArray(value['retiredLanes'])
    && value['retiredLanes'].every((entry) => typeof entry === 'string')
    && mapKeys.every((key) => isRecord(value[key]))
}

const storedPoolLedger = (value: unknown): OcrPoolLedger | undefined => {
  if (!isRecord(value)
    || value['mode'] !== 'pool'
    || !Number.isInteger(value['totalPages'])
    || !finiteNumber(value['totalPages'])
    || value['totalPages'] < 1
    || !['running', 'full', 'incomplete'].includes(String(value['status']))
    || !Array.isArray(value['pages'])
    || value['pages'].length !== value['totalPages']
    || !value['pages'].every(validStoredPage)
    || new Set(value['pages'].map((page) => (page as Record<string, unknown>)['pageNumber'])).size !== value['totalPages']
    || !value['pages'].every((page) => Number((page as Record<string, unknown>)['pageNumber']) >= 1 && Number((page as Record<string, unknown>)['pageNumber']) <= Number(value['totalPages']))
    || !Array.isArray(value['targets'])
    || !value['targets'].every(validStoredTarget)
    || !Array.isArray(value['lanes'])
    || !value['lanes'].every(validStoredLane)
    || !validStoredTelemetry(value['telemetry'])) {
    return undefined
  }
  const ledger = structuredClone(value) as OcrPoolLedger
  const targetByKey = new Map(ledger.targets.map((target) => [target.targetKey, target]))
  const laneByKey = new Map(ledger.lanes.map((lane) => [lane.laneKey, lane]))
  if (targetByKey.size !== ledger.targets.length || laneByKey.size !== ledger.lanes.length) return undefined
  const internallyConsistent = ledger.pages.every((page) => {
    const attemptsValid = page.attempts.every((attempt, index) => {
      const target = targetByKey.get(getOcrTargetKey({ service: attempt.provider, model: attempt.model }))
      return attempt.attempt === index + 1 && target?.laneKey === attempt.laneKey
    })
    if (!attemptsValid) return false
    if (page.status === 'accepted') {
      const acceptedTarget = page.accepted
        ? targetByKey.get(getOcrTargetKey({ service: page.accepted.provider, model: page.accepted.model }))
        : undefined
      return acceptedTarget !== undefined
        && page.accepted?.result.pageNumber === page.pageNumber
        && page.attempts.some((attempt) =>
          attempt.status === 'accepted'
          && attempt.attempt === page.accepted?.attempt
          && attempt.provider === page.accepted?.provider
          && attempt.model === page.accepted?.model
        )
    }
    if (page.status === 'claimed') {
      const claimedTarget = page.claim ? targetByKey.get(page.claim.targetKey) : undefined
      return claimedTarget?.laneKey === page.claim?.laneKey
        && page.attempts.some((attempt) =>
        attempt.status === 'running'
        && attempt.claimId === page.claim?.claimId
        && attempt.attempt === page.claim?.attempt
        && getOcrTargetKey({ service: attempt.provider, model: attempt.model }) === page.claim?.targetKey
      )
    }
    return page.attempts.every((attempt) => attempt.status !== 'running')
  })
  const targetStateConsistent = ledger.targets.every((target) => {
    const lane = laneByKey.get(target.laneKey)
    const attempts = ledger.pages.flatMap((page) => page.attempts.filter((attempt) =>
      attempt.provider === target.service && attempt.model === target.model
    ))
    const acceptedPagesForTarget = ledger.pages.filter((page) =>
      page.accepted?.provider === target.service && page.accepted.model === target.model
    ).length
    return target.targetKey === getOcrTargetKey(target)
      && lane?.service === target.service
      && lane.local === target.local
      && target.attempts === attempts.length
      && target.acceptedPages === acceptedPagesForTarget
  })
  const acceptedPages = ledger.pages.filter((page) => page.status === 'accepted').length
  const exhaustedPages = ledger.pages.filter((page) => page.status === 'exhausted').length
  if (!internallyConsistent
    || !targetStateConsistent
    || ledger.telemetry.acceptedPages !== acceptedPages
    || ledger.telemetry.exhaustedPages !== exhaustedPages
    || (ledger.status === 'full' && acceptedPages !== ledger.totalPages)) {
    return undefined
  }
  return ledger
}

export const parseStoredOcrPoolLedger = storedPoolLedger
