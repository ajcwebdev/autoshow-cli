import { expect, test } from 'bun:test'
import { join } from 'node:path'
import type { CharacterVoiceBrief } from '~/types'
import { runCliInProcess } from '~/cli/create-cli'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { resetLoggerForInvocation } from '~/utils/app-logger/app-logger'
import { buildReadyVoiceRegistrationDraft } from '~/cli/commands/audio/voice/voice-registration-management'
import {
  appendVoiceRegistration, loadVoiceRegistrationCatalog, loadVoiceAuditionManifestForRegistration,
  loadCurrentVoiceRegistrationIndex, resolveRegistrationGeneration, writeCharacterVoiceBriefCatalog
} from '~/cli/commands/audio/voice/character-voice-registry'
import { managedVoiceAssetStore } from '~/cli/commands/audio/voice/managed-voice-store'
import { createProtectedVoiceAssetStore } from '~/cli/commands/audio/voice/voice-assets/protected-voice-asset-store'
import { createSyntheticWavBytes } from '../../../../test-utils/media-fixtures'
import { captureProcessOutput } from '../../../../test-utils/console-capture'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'

const originalStore = { withWorkspace: managedVoiceAssetStore.withWorkspace, storeBytes: managedVoiceAssetStore.storeBytes }
const dirs = setupContractSuiteLifecycle({
  envKeys: ['OPENAI_API_KEY'], tempPrefix: 'voice-audition-json-',
  afterEachExtra: () => {
    Object.assign(managedVoiceAssetStore, originalStore)
    configureCharactersRoot('input/characters')
    resetLoggerForInvocation(false)
  }
})
const brief: CharacterVoiceBrief = {
  subjectKey: 'hero', profileKey: 'default', language: 'en', locale: 'en-US',
  timbre: 'warm', mannerisms: [], prohibitedCaricatures: [], pronunciations: [], allowedOrigins: ['provider-stock']
}

for (const approve of [false, true]) {
  test(`audition ${approve ? 'with approval' : 'without approval'} publishes one JSON result and preserves protected audio lineage`, async () => {
    const root = await dirs.make()
    const charactersRoot = join(root, 'characters')
    const configPath = join(root, 'empty-config.json')
    await Bun.write(configPath, '{}')
    await writeCharacterVoiceBriefCatalog(charactersRoot, { schemaVersion: 1, briefs: [brief] })
    const draft = buildReadyVoiceRegistrationDraft({
      subjectKey: 'hero', profileKey: 'default', brief, provider: 'openai', providerModel: 'gpt-4o-mini-tts-2025-12-15',
      providerVoice: { kind: 'remote-resource', provider: 'openai', resourceId: 'alloy', namespace: 'provider', origin: 'provider-stock', ownership: 'provider', deletion: { state: 'provider-managed', checkedAt: '2026-10-29T00:00:00.000Z' } },
      provenanceRef: 'project:casting', capabilityFixtureHash: 'a'.repeat(64)
    })
    await appendVoiceRegistration(charactersRoot, draft)
    const store = createProtectedVoiceAssetStore({ storeId: 'managed_voice_assets_v1', root: join(root, 'protected') })
    managedVoiceAssetStore.withWorkspace = store.withWorkspace
    managedVoiceAssetStore.storeBytes = store.storeBytes
    const audio = createSyntheticWavBytes({ durationSeconds: 0.25, amplitude: 0.2, frequencyHz: 440 })
    process.env['OPENAI_API_KEY'] = 'fixture'
    // OpenAI speech API expectations: https://platform.openai.com/docs/api-reference/audio/createSpeech
    // This proves request/result lifecycle and decoded fixture integrity, not spoken or perceptual quality.
    const calls = installMockFetch(call => {
      expect(call.url).toBe('https://api.openai.com/v1/audio/speech')
      expect(call.bodyJson).toMatchObject({ model: 'gpt-4o-mini-tts-2025-12-15', voice: 'alloy', response_format: 'wav' })
      return new Response(audio, { headers: { 'content-type': 'audio/wav' } })
    })
    const args = ['voice', 'audition', draft.registrationId, '--representative-line', 'We leave at dawn.', '--characters-root', charactersRoot, '--config-path', configPath, '--concurrency-mode', 'immediate', '--json', ...(approve ? ['--approve', '--actor-id', 'casting_editor'] : [])]
    const captured = await captureProcessOutput(() => runCliInProcess(args))
    expect(captured.result, captured.stderr).toBe(0)
    const result = JSON.parse(captured.stdout)
    expect(result).toMatchObject({ type: 'result', status: 'success', exitCode: 0, data: { registrationId: draft.registrationId, state: approve ? 'approved' : 'auditioned' } })
    expect(result.data.auditionId).toMatch(/^[a-f0-9]{64}$/)
    expect(captured.stdout.trim().split('\n')).toHaveLength(1)
    expect(calls).toHaveLength(6)
    const selected = await resolveRegistrationGeneration(charactersRoot, draft.registrationId)
    expect(selected.generationId).toBe(result.data.generationId)
    expect(selected.approval).toMatchObject({ state: approve ? 'approved' : 'auditioned', auditionId: result.data.auditionId })
    const catalog = await loadVoiceRegistrationCatalog(charactersRoot)
    expect(catalog.registrations).toHaveLength(approve ? 3 : 2)
    expect(catalog.registrations.find(entry => entry.generationId === draft.generationId)).toEqual(draft)
    const audition = await loadVoiceAuditionManifestForRegistration(charactersRoot, draft.registrationId, selected.generationId)
    expect(audition.auditionId).toBe(result.data.auditionId)
    expect(audition.items).toHaveLength(6)
    for (const item of audition.items) {
      const take = item.takes[0]!
      const bytes = await Bun.file(await store.resolve(take.protectedAudio)).bytes()
      expect(bytes.slice(0, 4)).toEqual(new TextEncoder().encode('RIFF'))
      expect(new Bun.CryptoHasher('sha256').update(bytes).digest('hex')).toBe(take.sha256)
      expect(await store.readPolicies!(take.protectedAudio)).toEqual([expect.objectContaining({ purpose: 'audition-audio', authorizationRef: `voice-audition:${draft.registrationId}` })])
    }
    if (approve) {
      const current = await loadCurrentVoiceRegistrationIndex(charactersRoot, catalog)
      expect(current.selections).toEqual([expect.objectContaining({ generationId: selected.generationId, registrationId: draft.registrationId })])
    }
    const retained = JSON.stringify(catalog)
    const repeated = await captureProcessOutput(() => runCliInProcess(args))
    expect(repeated.result).toBe(2)
    expect(calls).toHaveLength(6)
    expect(JSON.stringify(await loadVoiceRegistrationCatalog(charactersRoot))).toBe(retained)
  })
}
