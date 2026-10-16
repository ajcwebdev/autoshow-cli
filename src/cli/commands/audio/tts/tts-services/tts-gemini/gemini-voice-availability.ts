import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { providerAccountScopeHash } from '../../script-to-audio/advanced-provider-contracts'
import { geminiJsonRequest } from '~/utils/gemini/gemini-rest'
import { UsageError } from '~/utils/error-handler'
import { geminiObject } from './gemini-tts-audio'
import { SUPPORTED_GEMINI_TTS_MODELS, validateGeminiTtsModel } from '~/cli/commands/setup-and-utilities/models/tts-models'

export const geminiVoiceExpiry = (record: Record<string, unknown>): string | undefined => {
  for (const key of ['expire_time', 'expires_at']) {
    const value = record[key]
    if (value !== undefined && value !== null && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) throw UsageError('Invalid Gemini voice expiry.')
  }
  if (typeof record['expire_time'] === 'string' && typeof record['expires_at'] === 'string' && Date.parse(record['expire_time']) !== Date.parse(record['expires_at'])) throw UsageError('Conflicting Gemini voice expiry fields.')
  const explicit = record['expire_time'] ?? record['expires_at']
  if (typeof explicit === 'string') {
    if (!Number.isFinite(Date.parse(explicit))) throw UsageError('Invalid Gemini voice expiry.')
    return explicit
  }
  // Stored voices expire after inactivity, not after creation. The public Voice
  // schema exposes renewable expire_time, but no last-use timestamp from which
  // we can safely derive it. Missing expiry stays unknown.
  return undefined
}
export const assertGeminiVoiceAvailable = (record: Record<string, unknown>, id: string, model: string, now = new Date()): void => {
  if (record['id'] !== id) throw UsageError('Gemini voice inspection returned a different resource.')
  const expiry = geminiVoiceExpiry(record)
  if (!Number.isFinite(now.getTime())) throw UsageError('Invalid Gemini voice inspection time.')
  if (expiry && Date.parse(expiry) <= now.getTime()) throw UsageError('Gemini voice has expired; new synthesis is blocked.')
  // Voices responses can use the full model resource name rather than its ID.
  const storedModel = typeof record['model'] === 'string' ? record['model'].replace(/^models\//, '') : record['model']
  validateGeminiTtsModel(model)
  // The model field identifies voice creation. Google explicitly permits using
  // a created voice with any supported TTS synthesis model.
  if (storedModel !== undefined && (typeof storedModel !== 'string' || !(SUPPORTED_GEMINI_TTS_MODELS as readonly string[]).includes(storedModel))) throw UsageError('Gemini stored voice has an unsupported or malformed creation model.')
}
export const inspectGeminiSynthesisVoices = async (apiKey: string, model: string, voices: readonly string[]): Promise<void> => {
  for (const id of new Set(voices.filter(voice => voice.startsWith('voice_')))) {
    const { json } = await geminiJsonRequest(apiKey, 'voices/' + encodeURIComponent(id), { method: 'GET' })
    assertGeminiVoiceAvailable(geminiObject(json), id, model)
  }
}

export const inspectGeminiVoiceImport = async (apiKey: string, model: string, id: string, creationJournalRoot: string) => {
  const record = geminiObject((await geminiJsonRequest(apiKey, 'voices/' + encodeURIComponent(id), { method: 'GET' })).json)
  assertGeminiVoiceAvailable(record, id, model)
  const accountScopeHash = providerAccountScopeHash('gemini', apiKey)
  let ownership: 'provider' | 'account' | 'project' = id.startsWith('voice_') ? 'account' : 'provider'
  const expiresAt = geminiVoiceExpiry(record)
  const names = await readdir(creationJournalRoot).catch((error: { code?: string }) => { if (error.code === 'ENOENT') return []; throw error })
  for (const name of names.filter(name => /^[a-f0-9]{64}\.json$/.test(name))) {
    const row = geminiObject(await Bun.file(join(creationJournalRoot, name)).json())
    if (row['resourceId'] === id && row['accountScopeHash'] === accountScopeHash) {
      ownership = 'project'
      // Historical journals can contain the old creation-plus-one-year guess.
      // A fresh provider inspection is authoritative; do not revive that guess.
    }
  }
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) throw UsageError('Gemini voice has expired; import for new synthesis is blocked.')
  return { origin: id.startsWith('voice_') ? record['type'] === 'prompted' ? 'designed' as const : record['type'] === 'replicated' ? 'instant-clone' as const : 'imported-custom' as const : 'provider-stock' as const, ownership, accountScopeHash, expiresAt, sanitizedProviderMetadata: Object.fromEntries(['create_time', 'created_at', 'expire_time', 'display_name', 'model'].flatMap(key => typeof record[key] === 'string' ? [[key, String(record[key])]] : [])) }
}
