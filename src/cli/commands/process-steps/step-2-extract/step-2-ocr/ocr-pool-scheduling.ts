import type { IndexedOcrTarget, OcrTarget } from '~/types'
import { getOcrTargetKey } from './ocr-run-state'

/**
 * Scheduling policy shared by the page pool and the provider pool. Both modules previously
 * carried private copies of all three helpers — including the hosted priority table, which
 * is a policy: a provider added to one copy and not the other silently changed scheduling
 * order without failing a type check.
 */

export const isLocalOcrTarget = (
  target: Pick<OcrTarget, 'service'>
): target is Pick<OcrTarget, 'service'> & { service: 'tesseract' } =>
  target.service === 'tesseract'

export const getHostedOcrExecutionPriority = (target: OcrTarget): number => {
  if (target.service === 'kimi') return 90
  if (target.service === 'deepinfra') return 85
  if (target.service === 'anthropic') return 80
  if (target.service === 'gemini') return 75
  if (target.service === 'openai') return 70
  if (target.service === 'mistral') return 60
  if (target.service === 'glm') return 55
  return 0
}

/**
 * Pairs each target that still has to run with its position in the originally requested list,
 * consuming one available index per duplicate target key.
 */
export const buildIndexedOcrTargetsToRun = (
  requestedTargets: OcrTarget[],
  targetsToRun: OcrTarget[]
): IndexedOcrTarget[] => {
  const availableIndicesByKey = new Map<string, number[]>()
  requestedTargets.forEach((target, index) => {
    const key = getOcrTargetKey(target)
    const indices = availableIndicesByKey.get(key) ?? []
    indices.push(index)
    availableIndicesByKey.set(key, indices)
  })
  return targetsToRun.flatMap((target) => {
    const index = availableIndicesByKey.get(getOcrTargetKey(target))?.shift()
    return index === undefined ? [] : [{ index, target }]
  })
}
