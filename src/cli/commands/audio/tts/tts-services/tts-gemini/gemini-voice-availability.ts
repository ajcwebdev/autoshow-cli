import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { providerAccountScopeHash } from '../../script-to-audio/advanced-provider-contracts'
import { geminiJsonRequest } from '~/utils/gemini/gemini-rest'
import { UsageError } from '~/utils/error-handler'
import { geminiObject } from './gemini-tts-audio'

export const geminiVoiceExpiry = (record: Record<string, unknown>): string | undefined => {
  const explicit = record['expire_time'] ?? record['expires_at']
  if (typeof explicit === 'string') {
    if (!Number.isFinite(Date.parse(explicit))) throw UsageError('Invalid Gemini voice expiry.')
    return explicit
  }
  const created = record['create_time'] ?? record['created_at']
  if (typeof created !== 'string' || !Number.isFinite(Date.parse(created))) return undefined
  const date = new Date(created); date.setUTCFullYear(date.getUTCFullYear() + 1); return date.toISOString()
}
export const assertGeminiVoiceAvailable = (record: Record<string, unknown>, id: string, model: string, now = new Date()): void => {
  if (record['id'] !== id) throw UsageError('Gemini voice inspection returned a different resource.')
  const expiry = geminiVoiceExpiry(record)
  if (expiry && Date.parse(expiry) <= now.getTime()) throw UsageError('Gemini voice has expired; new synthesis is blocked.')
  if (record['model'] && record['model'] !== model) throw UsageError('Gemini stored voice is incompatible with the selected synthesis model.')
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
  let expiresAt = geminiVoiceExpiry(record)
  const names = await readdir(creationJournalRoot).catch((error: { code?: string }) => { if (error.code === 'ENOENT') return []; throw error })
  for (const name of names.filter(name => /^[a-f0-9]{64}\.json$/.test(name))) {
    const row = geminiObject(await Bun.file(join(creationJournalRoot, name)).json())
    if (row['resourceId'] === id && row['accountScopeHash'] === accountScopeHash) {
      ownership = 'project'
      if (!expiresAt && typeof row['expiresAt'] === 'string') expiresAt = row['expiresAt']
    }
  }
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) throw UsageError('Gemini voice has expired; import for new synthesis is blocked.')
  return { origin: id.startsWith('voice_') ? record['type'] === 'prompted' ? 'designed' as const : record['type'] === 'replicated' ? 'instant-clone' as const : 'imported-custom' as const : 'provider-stock' as const, ownership, accountScopeHash, expiresAt, sanitizedProviderMetadata: Object.fromEntries(['create_time', 'created_at', 'expire_time', 'display_name', 'model'].flatMap(key => typeof record[key] === 'string' ? [[key, String(record[key])]] : [])) }
}
