import type { GeminiProviderJobRun } from '~/types/tts-workflow/gemini-provider-job-types'
import { validateGeminiTtsModel } from '~/cli/commands/setup-and-utilities/models/tts-models'
import { hashCanonicalTtsValue } from '../../script-to-audio/contract-identity'
import { UsageError } from '~/utils/error-handler'

export const validateGeminiJobRun = (run: GeminiProviderJobRun): GeminiProviderJobRun => {
  const fail = (): never => { throw UsageError('Invalid or inconsistent Gemini provider-job record; preserved for reconciliation.') }
  if (run.schemaVersion !== 1 || run.kind !== 'gemini-tts-provider-jobs' || !Array.isArray(run.items) || !run.items.length || !Array.isArray(run.slots) || !run.slots.length || !Array.isArray(run.jobs) || !run.jobs.length || !Array.isArray(run.outputs) || !run.delivery || !/^[a-f0-9]{64}$/.test(run.accountScopeHash) || !Number.isFinite(Date.parse(run.createdAt))) fail()
  for (const item of run.items) if (!item || typeof item.input !== 'string' || !/^[A-Za-z0-9_-]+$/.test(item.stem)) fail()
  const keys = new Set<string>(), assigned = new Set<string>()
  for (const slot of run.slots) {
    validateGeminiTtsModel(slot.model)
    if (!/^[a-f0-9]{64}$/.test(slot.key) || keys.has(slot.key) || !Number.isInteger(slot.itemIndex) || !run.items[slot.itemIndex] || typeof slot.generationSlotId !== 'string') fail()
    if (hashCanonicalTtsValue({ model: slot.model, request: slot.request }) !== slot.requestFingerprint) fail()
    if (slot.boundaryAfter !== undefined && !['paragraph', 'sentence', 'clause', 'word', 'hard', 'turn', 'end'].includes(slot.boundaryAfter)) fail()
    if (slot.audioPath && slot.audioPath !== 'gemini-audio/' + slot.key + '.wav' || slot.audioSha256 && !/^[a-f0-9]{64}$/.test(slot.audioSha256)) fail()
    keys.add(slot.key)
  }
  for (const job of run.jobs) {
    validateGeminiTtsModel(job.model)
    if (job.schemaVersion !== 1 || !Array.isArray(job.keys) || !job.keys.length || !['prepared', 'uploading', 'submitting', 'pending', 'completed', 'failed', 'cancelled', 'expired'].includes(job.state)) fail()
    for (const key of job.keys) { if (!keys.has(key) || assigned.has(key) || run.slots.find(slot => slot.key === key)?.model !== job.model) fail(); assigned.add(key) }
    if (job.requestFingerprint !== hashCanonicalTtsValue(job.keys.map(key => [key, run.slots.find(slot => slot.key === key)!.requestFingerprint]))) fail()
    if (job.jobId && !/^batches\/[A-Za-z0-9_-]+$/.test(job.jobId) || job.uploadHandle && !/^files\/[A-Za-z0-9_-]+$/.test(job.uploadHandle) || job.resultFile && !/^files\/[A-Za-z0-9_-]+$/.test(job.resultFile)) fail()
    if (job.state === 'pending' && !job.jobId) fail()
  }
  if (assigned.size !== keys.size) fail()
  for (const output of run.outputs) {
    const item = run.items[output.itemIndex]
    if (!item || output.path !== String(output.itemIndex + 1).padStart(3, '0') + '-' + item.stem + '-' + output.model + '.wav') fail()
  }
  return run
}
