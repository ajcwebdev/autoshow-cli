import { afterEach, expect, test } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CharacterVoiceBrief, VoiceProvisioningAttempt } from '~/types'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import {
  appendVoiceRegistration,
  resolveCharacterVoiceRegistryPaths,
  resolveRegistrationGeneration,
  writeCharacterVoiceBriefCatalog
} from '~/cli/commands/process-steps/step-4-tts/voice-management/character-voice-registry'
import { MANAGED_VOICE_STORE_ROOT } from '~/cli/commands/process-steps/step-4-tts/voice-management/managed-voice-store'
import { AMBIGUOUS_VOICE_REDISPATCH_MESSAGE } from '~/cli/commands/process-steps/step-4-tts/voice-management/fish-voice-reconciliation'
import { writeVoiceCandidate } from '~/cli/commands/process-steps/step-4-tts/voice-management/advanced-voice-management'
import { computeVoiceCandidateId } from '~/cli/commands/process-steps/step-4-tts/voice-management/voice-management-contracts'
import { buildReadyVoiceRegistrationDraft } from '~/cli/commands/process-steps/step-4-tts/voice-management/voice-registration-management'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { asCtx, expectUnknownCommand, makeTempRoot, parseRoot, registerUsageErrorCleanup } from './shared'

registerUsageErrorCleanup()

const rejectVoice = async (argv: string[], msg: string) => {
  const parsed = parseRoot(argv)
  await expect(parsed.command!.handler(asCtx(parsed))).rejects.toThrow(msg)
}

const brief: CharacterVoiceBrief = {
  subjectKey: 'hero', profileKey: 'default', language: 'en', locale: 'en-US',
  timbre: 'warm and grounded', mannerisms: [], prohibitedCaricatures: [],
  pronunciations: [], allowedOrigins: ['provider-stock', 'saved-reference']
}

const providerVoice = (resourceId: string) => ({
  kind: 'remote-resource' as const,
  provider: 'elevenlabs' as const,
  resourceId,
  namespace: 'provider' as const,
  origin: 'provider-stock' as const,
  ownership: 'provider' as const,
  deletion: { state: 'provider-managed' as const, checkedAt: '2026-08-11T00:00:00.000Z' }
})

const approvedState = {
  state: 'approved' as const,
  auditionId: 'c'.repeat(64),
  approvedAt: '2026-08-11T00:02:00.000Z',
  approvedBy: { namespace: 'local-user' as const, actorId: 'editor' }
}

const writeDraft = async (root: string, resourceId: string, extras: {
  registrationId?: string
  profileKey?: string
  priorGenerationId?: string
  createdAt?: string
  approval?: Parameters<typeof buildReadyVoiceRegistrationDraft>[0]['approval']
  approvedAuditionId?: string
} = {}) => {
  const profileKey = extras.profileKey ?? 'default'
  await writeCharacterVoiceBriefCatalog(root, { schemaVersion: 1, briefs: [brief, { ...brief, profileKey: 'alt' }] })
  const draft = buildReadyVoiceRegistrationDraft({
    ...(extras.registrationId ? { registrationId: extras.registrationId } : {}),
    ...(extras.priorGenerationId ? { priorGenerationId: extras.priorGenerationId } : {}),
    ...(extras.approval ? { approval: extras.approval } : {}),
    ...(extras.approvedAuditionId ? { approvedAuditionId: extras.approvedAuditionId } : {}),
    subjectKey: 'hero',
    profileKey,
    provider: 'elevenlabs',
    providerModel: 'eleven_v3',
    providerVoice: providerVoice(resourceId),
    brief: { ...brief, profileKey },
    provenanceRef: 'project:casting',
    capabilityFixtureHash: 'b'.repeat(64),
    createdAt: extras.createdAt ?? '2026-08-11T00:00:00.000Z'
  })
  await appendVoiceRegistration(root, draft)
  return draft
}

const writeCurrentIndex = async (root: string, selections: Array<{ registrationId: string, generationId: string, profileKey?: string }>) => {
  await writeFile(resolveCharacterVoiceRegistryPaths(root).current, `${JSON.stringify({
    schemaVersion: 2,
    revision: 1,
    selections: selections.map((selection) => ({
      subjectKey: 'hero',
      provider: 'elevenlabs',
      providerModel: 'eleven_v3',
      profileKey: selection.profileKey ?? 'default',
      registrationId: selection.registrationId,
      generationId: selection.generationId,
      updatedAt: '2026-08-11T00:02:00.000Z'
    }))
  }, null, 2)}\n`)
}

const captureLogs = async (run: () => Promise<void>): Promise<string[]> => {
  const logs: string[] = []
  const original = console.log
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '))
  }
  try {
    await run()
    return logs
  } finally {
    console.log = original
  }
}

afterEach(() => {
  configureCharactersRoot('input/characters')
})

test('voice rejects providers outside the managed five-model surface', async () => {
  await rejectVoice(
    ['voice', 'import', 'hero', '--provider', 'openai', '--model', 'gpt-4o-mini-tts-2025-12-15', '--voice-id', 'cedar', '--provenance-ref', 'project:casting', '--price'],
    'Unknown voice provider openai. Expected: elevenlabs, inworld, fish, cartesia, speechify.'
  )
  await rejectVoice(
    ['voice', 'discover', '--provider', 'hume', '--price'],
    'Unknown voice provider hume. Expected: elevenlabs, inworld, fish, cartesia, speechify.'
  )
  await rejectVoice(
    ['voice', 'list', '--provider', 'hume', '--price'],
    'Unknown voice provider hume. Expected: elevenlabs, inworld, fish, cartesia, speechify.'
  )
  await rejectVoice(
    ['voice', 'list', '--provider', 'inworld', '--cursor', 'next'],
    'inworld voice discovery is not paginated and does not accept --cursor.'
  )
  await rejectVoice(
    ['voice', 'design', 'hero', '--provider', 'minimax', '--model', 'speech-2.8-hd', '--creation-model', 'voice-design', '--description', 'Warm, weathered guide', '--preview-text', 'A short representative passage.', '--price'],
    'Unknown voice provider minimax. Expected: elevenlabs, inworld, fish, cartesia, speechify.'
  )
  await rejectVoice(
    ['voice', 'clone', 'hero', '--provider', 'deepinfra', '--model', 'Qwen/Qwen3-TTS', '--kind', 'instant', '--voice-name', 'Hero', '--sample', 'input/examples/audio/anthony-voice.mp3', '--authorization-ref', 'project:casting', '--consent-ref', 'protected-consent:v1:ID', '--provenance-ref', 'project:casting', '--price'],
    'Unknown voice provider deepinfra. Expected: elevenlabs, inworld, fish, cartesia, speechify.'
  )
  expectUnknownCommand(
    ['voice', 'save-reference', 'hero', '--model', 'voxtral-mini-tts-2603', '--price'],
    'voice save-reference'
  )
})

test('voice design rejects catalog-only providers and unknown synthesis models', async () => {
  await rejectVoice(
    ['voice', 'design', 'hero', '--provider', 'cartesia', '--model', 'sonic-3.5-2026-05-04', '--creation-model', 'voice-design', '--description', 'Warm, weathered guide', '--preview-text', 'A short representative passage.', '--price'],
    'Voice Design currently supports elevenlabs, fish, inworld; the selected provider has no implemented text-prompt design adapter.'
  )
  await rejectVoice(
    ['voice', 'import', 'hero', '--provider', 'elevenlabs', '--model', 'eleven_multilingual_v2', '--voice-id', 'hpp4J3VqNfWAUOO0d1Us', '--provenance-ref', 'project:casting', '--price'],
    'Voice management for elevenlabs requires --model eleven_v3.'
  )
})

test('voice list rejects mixed inspect and discover selectors', async () => {
  await rejectVoice(['voice', 'list', '--live'], '--live requires a registration id.')
  await rejectVoice(['voice', 'list', 'vr_hero', '--provider', 'elevenlabs'], '--provider cannot be combined with a registration id.')
  await rejectVoice(['voice', 'list', '--cursor', 'next'], '--provider is required.')
})

test('bare voice runs list and help stays help', () => {
  const listed = parseRoot(['voice'])
  expect(listed.mode).toBe('command')
  expect(listed.command?.name).toBe('voice list')
  const help = parseRoot(['voice', '--help'])
  expect(help.mode).toBe('help')
  expect(help.command?.name).toBe('voice')
  expect(parseRoot(['voice', 'help']).mode).toBe('help')
  expect(parseRoot(['voice', 'inspect', 'vr_123']).command?.name).toBe('voice inspect')
  expect(parseRoot(['voice', 'status']).command?.name).toBe('voice status')
  expect(parseRoot(['voice', 'discover', '--provider', 'elevenlabs']).command?.name).toBe('voice discover')
  expect(parseRoot(['voice', 'revoke-consent', 'protected-consent:v1:x']).command?.name).toBe('voice revoke-consent')
  expect(parseRoot(['voice', 'revoke', 'vr_123']).command?.name).toBe('voice revoke')
  expect(parseRoot(['voice', 'materialize', 'candidate-1']).command?.name).toBe('voice materialize')
  expect(parseRoot(['voice', 'reconcile', 'vr_123']).command?.name).toBe('voice reconcile')
})

test('voice list inspects one generation without a live provider call', async () => {
  const root = await makeTempRoot('autoshow-voice-list-')
  configureCharactersRoot(root)
  const draft = await writeDraft(root, 'voice-1', { registrationId: 'vr_hero' })
  const logs = await captureLogs(async () => {
    const parsed = parseRoot(['voice', 'list', draft.registrationId])
    await parsed.command!.handler(asCtx(parsed))
  })
  const payload = JSON.parse(logs.at(-1) ?? '{}') as { generationId?: string, inspection?: unknown, networkAccess?: string }
  expect(payload.generationId).toBe(draft.generationId)
  expect(payload.inspection).toBeUndefined()
  expect(payload.networkAccess).toBe('none')
})

test('voice inspect still live-checks a ready resource', async () => {
  const root = await makeTempRoot('autoshow-voice-inspect-')
  configureCharactersRoot(root)
  const draft = await writeDraft(root, 'voice-1', { registrationId: 'vr_hero' })
  const previous = process.env['ELEVENLABS_API_KEY']
  delete process.env['ELEVENLABS_API_KEY']
  try {
    await rejectVoice(
      ['voice', 'inspect', draft.registrationId],
      'ELEVENLABS_API_KEY environment variable is required'
    )
  } finally {
    if (previous === undefined) delete process.env['ELEVENLABS_API_KEY']
    else process.env['ELEVENLABS_API_KEY'] = previous
  }
})

test('omitted generation-id uses the sole catalog generation or current index and refuses ambiguity', async () => {
  const root = await makeTempRoot('autoshow-voice-generation-')
  configureCharactersRoot(root)
  const first = await writeDraft(root, 'voice-1', { registrationId: 'vr_shared', createdAt: '2026-08-11T00:00:00.000Z' })
  const logs = await captureLogs(async () => {
    const parsed = parseRoot(['voice', 'list', first.registrationId])
    await parsed.command!.handler(asCtx(parsed))
  })
  expect(JSON.parse(logs.at(-1) ?? '{}').generationId).toBe(first.generationId)

  expect((await resolveRegistrationGeneration(root, first.registrationId)).generationId).toBe(first.generationId)
  expect((await resolveRegistrationGeneration(root, first.registrationId, first.generationId)).generationId).toBe(first.generationId)

  const approved = await writeDraft(root, 'voice-current', {
    registrationId: 'vr_current',
    createdAt: '2026-08-11T00:00:00.000Z',
    approval: approvedState,
    approvedAuditionId: approvedState.auditionId
  })
  const successor = await writeDraft(root, 'voice-next', {
    registrationId: approved.registrationId,
    priorGenerationId: approved.generationId,
    createdAt: '2026-08-11T00:03:00.000Z'
  })
  await writeCurrentIndex(root, [{ registrationId: approved.registrationId, generationId: approved.generationId }])
  const currentLogs = await captureLogs(async () => {
    const parsed = parseRoot(['voice', 'list', approved.registrationId])
    await parsed.command!.handler(asCtx(parsed))
  })
  expect(JSON.parse(currentLogs.at(-1) ?? '{}').generationId).toBe(approved.generationId)
  expect(JSON.parse(currentLogs.at(-1) ?? '{}').generationId).not.toBe(successor.generationId)
  expect((await resolveRegistrationGeneration(root, approved.registrationId)).generationId).toBe(approved.generationId)
  expect((await resolveRegistrationGeneration(root, approved.registrationId, successor.generationId)).generationId).toBe(successor.generationId)

  const tipRoot = await writeDraft(root, 'voice-tip-root', {
    registrationId: 'vr_tip',
    createdAt: '2026-08-11T00:00:00.000Z'
  })
  const tip = await writeDraft(root, 'voice-tip', {
    registrationId: tipRoot.registrationId,
    priorGenerationId: tipRoot.generationId,
    createdAt: '2026-08-11T00:01:00.000Z'
  })
  const tipLogs = await captureLogs(async () => {
    const parsed = parseRoot(['voice', 'list', tipRoot.registrationId])
    await parsed.command!.handler(asCtx(parsed))
  })
  expect(JSON.parse(tipLogs.at(-1) ?? '{}').generationId).toBe(tip.generationId)
  expect((await resolveRegistrationGeneration(root, tipRoot.registrationId)).generationId).toBe(tip.generationId)

  const left = await writeDraft(root, 'voice-a', {
    registrationId: 'vr_ambiguous',
    createdAt: '2026-08-11T00:00:00.000Z',
    approval: approvedState,
    approvedAuditionId: approvedState.auditionId
  })
  const right = await writeDraft(root, 'voice-b', {
    registrationId: 'vr_ambiguous',
    profileKey: 'alt',
    priorGenerationId: left.generationId,
    createdAt: '2026-08-11T00:01:00.000Z',
    approval: approvedState,
    approvedAuditionId: approvedState.auditionId
  })
  await writeCurrentIndex(root, [
    { registrationId: left.registrationId, generationId: left.generationId },
    { registrationId: right.registrationId, generationId: right.generationId, profileKey: 'alt' }
  ])
  await rejectVoice(
    ['voice', 'list', 'vr_ambiguous'],
    `Voice registration vr_ambiguous has multiple matching generations: ${[left.generationId, right.generationId].sort().join(', ')}. Pass --generation-id.`
  )
  await expect(resolveRegistrationGeneration(root, 'vr_ambiguous')).rejects.toThrow(
    `Voice registration vr_ambiguous has multiple matching generations: ${[left.generationId, right.generationId].sort().join(', ')}. Pass --generation-id.`
  )
  await expect(resolveRegistrationGeneration(root, 'vr_nonexistent')).rejects.toThrow(
    'Voice registration generation was not found.'
  )
})

test('voice audition --approve requires actor-id and does not approve on --price', async () => {
  await rejectVoice(
    ['voice', 'audition', 'vr_123', '--representative-line', 'We leave at dawn.', '--approve', '--price'],
    '--actor-id is required.'
  )
  const root = await makeTempRoot('autoshow-voice-approve-price-')
  configureCharactersRoot(root)
  const draft = await writeDraft(root, 'voice-1', { registrationId: 'vr_hero' })
  const logs = await captureLogs(async () => {
    const parsed = parseRoot([
      'voice', 'audition', draft.registrationId,
      '--representative-line', 'We leave at dawn.',
      '--approve', '--actor-id', 'casting_editor', '--price'
    ])
    await parsed.command!.handler(asCtx(parsed))
  })
  const payload = JSON.parse(logs.at(-1) ?? '{}') as { operation?: string, state?: string }
  expect(payload.operation).toBe('voice-audition')
  expect(payload.state).toBeUndefined()
})

test('voice consent grant stays deny-by-default and revoke uses --revoke', async () => {
  await rejectVoice(
    ['voice', 'consent', 'hero', '--provenance-ref', 'release:hero-v1', '--actor-id', 'casting_editor', '--price'],
    '--allow must grant at least one explicit consent action; omitted actions remain denied.'
  )
  await rejectVoice(
    ['voice', 'consent', '--revoke', 'protected-consent:v1:STORE:ASSET:SHA256', '--actor-id', 'casting_editor'],
    '--reason is required.'
  )
  await rejectVoice(
    ['voice', 'consent', '--revoke', 'protected-consent:v1:STORE:ASSET:SHA256', '--allow', 'upload', '--reason', 'Authorization withdrawn', '--actor-id', 'casting_editor'],
    '--revoke cannot be combined with --allow.'
  )
  await rejectVoice(
    ['voice', 'consent', 'hero', '--revoke', 'protected-consent:v1:STORE:ASSET:SHA256', '--reason', 'Authorization withdrawn', '--actor-id', 'casting_editor'],
    '--revoke cannot be combined with a subject key.'
  )
  await rejectVoice(
    ['voice', 'revoke-consent', 'protected-consent:v1:STORE:ASSET:SHA256'],
    '--actor-id is required.'
  )
})

test('voice retire without reason does not revoke, and --reason matches revoke', async () => {
  const root = await makeTempRoot('autoshow-voice-retire-')
  configureCharactersRoot(root)
  const retired = await writeDraft(root, 'voice-retire', {
    registrationId: 'vr_retire',
    approval: approvedState,
    approvedAuditionId: approvedState.auditionId
  })
  const retiredLogs = await captureLogs(async () => {
    const parsed = parseRoot(['voice', 'retire', retired.registrationId])
    await parsed.command!.handler(asCtx(parsed))
  })
  const retiredPayload = JSON.parse(retiredLogs.at(-1) ?? '{}') as { state?: string, cleanupState?: string }
  expect(retiredPayload.state).toBe('retired')
  expect(retiredPayload.cleanupState).not.toBe('deletion-required')

  const revoked = await writeDraft(root, 'voice-revoke', {
    registrationId: 'vr_revoke',
    createdAt: '2026-08-11T00:04:00.000Z',
    approval: approvedState,
    approvedAuditionId: approvedState.auditionId
  })
  const revokedLogs = await captureLogs(async () => {
    const parsed = parseRoot(['voice', 'retire', revoked.registrationId, '--reason', 'Casting changed'])
    await parsed.command!.handler(asCtx(parsed))
  })
  const revokedPayload = JSON.parse(revokedLogs.at(-1) ?? '{}') as { state?: string, cleanupState?: string }
  expect(revokedPayload.state).toBe('revoked')
  expect(revokedPayload.cleanupState).toBe('deletion-required')

  await rejectVoice(['voice', 'revoke', 'vr_missing'], 'Voice registration generation was not found.')
  const retireCommand = parseRoot(['voice', 'retire', 'vr_retire']).command!
  expect(() => parseCommandInvocation(
    [retireCommand.name, 'vr_retire', '--delete'],
    retireCommand,
    GLOBAL_FLAG_DEFINITIONS
  )).toThrow('Unexpected flag: --delete')
})

test('voice design --save requires a candidate and rejects preview flags', async () => {
  await rejectVoice(
    ['voice', 'design', '--save', 'candidate-missing', '--provider', 'elevenlabs', '--subject-key', 'hero', '--price'],
    '--voice-name is required.'
  )
  await rejectVoice(
    ['voice', 'design', '--save', 'candidate-missing', '--provider', 'elevenlabs', '--subject-key', 'hero', '--voice-name', 'HeroGuide', '--provenance-ref', 'project:casting', '--description', 'Warm, weathered guide', '--price'],
    '--save cannot be combined with --description.'
  )
  await rejectVoice(
    ['voice', 'design', '--save', 'candidate-missing', '--provider', 'elevenlabs', '--subject-key', 'hero', '--voice-name', 'HeroGuide', '--provenance-ref', 'project:casting', '--candidates', '1', '--price'],
    '--save cannot be combined with --candidates.'
  )
  const root = await makeTempRoot('autoshow-voice-save-')
  configureCharactersRoot(root)
  await writeCharacterVoiceBriefCatalog(root, { schemaVersion: 1, briefs: [brief] })
  await rejectVoice(
    ['voice', 'design', '--save', 'candidate-missing', '--provider', 'elevenlabs', '--subject-key', 'hero', '--voice-name', 'HeroGuide', '--provenance-ref', 'project:casting', '--price'],
    'Voice candidate candidate-missing was not found or is corrupt.'
  )
  await rejectVoice(
    ['voice', 'materialize', 'candidate-missing', '--provider', 'elevenlabs', '--subject-key', 'hero', '--voice-name', 'HeroGuide', '--provenance-ref', 'project:casting', '--price'],
    'Voice candidate candidate-missing was not found or is corrupt.'
  )
})

const writeJournal = async (registrationId: string, attempt: VoiceProvisioningAttempt): Promise<string> => {
  const dir = join(MANAGED_VOICE_STORE_ROOT, 'journals', registrationId, attempt.attemptId)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'voice-provisioning-attempt.json'), `${JSON.stringify(attempt, null, 2)}\n`)
  return join(MANAGED_VOICE_STORE_ROOT, 'journals', registrationId)
}

const fishAttempt = (registrationId: string, extras: Partial<VoiceProvisioningAttempt> = {}): VoiceProvisioningAttempt => ({
  schemaVersion: 1,
  attemptId: 'vp_testcomplete',
  registrationDraftId: registrationId,
  operation: 'design',
  accountScopeHash: 'c'.repeat(64),
  lockLeaseId: 'lease_testcomplete',
  requestFingerprint: 'd'.repeat(64),
  protectedRequestEvidence: { storeId: 'managed_voice_assets_v1', assetId: `sha256_${'a'.repeat(64)}`, sha256: 'a'.repeat(64) },
  reconciliation: { strategy: 'provider-search', providerHandle: 'Hero', protectedLookupEvidence: { storeId: 'managed_voice_assets_v1', assetId: `sha256_${'b'.repeat(64)}`, sha256: 'b'.repeat(64) } },
  transitions: [
    { sequence: 1, phase: 'prepared', at: '2026-08-11T00:00:00.000Z' },
    { sequence: 2, phase: 'request-sent', at: '2026-08-11T00:00:01.000Z' },
    { sequence: 3, phase: 'ambiguous', at: '2026-08-11T00:00:02.000Z' }
  ],
  issuedResources: [],
  outcome: { state: 'reconciliation-required', attemptId: 'vp_testcomplete', reason: 'Provider mutation may have been admitted.' },
  compareAndSwapVersion: 3,
  ...extras
})

test('voice list completes an unambiguous journal and refuses an ambiguous one until --reconcile', async () => {
  const root = await makeTempRoot('autoshow-voice-journal-')
  configureCharactersRoot(root)
  const fishVoice = {
    kind: 'remote-resource' as const,
    provider: 'fish' as const,
    resourceId: 'fish-voice-1',
    namespace: 'account' as const,
    accountScopeHash: 'c'.repeat(64),
    origin: 'designed' as const,
    ownership: 'project' as const,
    deletion: { state: 'eligible' as const, checkedAt: '2026-08-11T00:00:00.000Z' }
  }
  const draft = buildReadyVoiceRegistrationDraft({
    registrationId: 'vr_fishjournal',
    subjectKey: 'hero',
    profileKey: 'default',
    provider: 'fish',
    providerModel: 's2.1-pro',
    providerVoice: fishVoice,
    brief: { ...brief, allowedOrigins: ['provider-stock', 'designed'] },
    provenanceRef: 'project:casting',
    capabilityFixtureHash: 'b'.repeat(64),
    sanitizedProviderMetadata: { attemptId: 'vp_testcomplete', desiredName: 'Hero' },
    createdAt: '2026-08-11T00:00:00.000Z'
  })
  await writeCharacterVoiceBriefCatalog(root, { schemaVersion: 1, briefs: [{ ...brief, allowedOrigins: ['provider-stock', 'designed'] }] })
  await appendVoiceRegistration(root, draft)

  const unambiguous = fishAttempt(draft.registrationId, {
    issuedResources: [{
      providerVoice: fishVoice,
      observedAt: '2026-08-11T00:00:02.000Z',
      sanitizedResponseHash: 'e'.repeat(64)
    }]
  })
  const journalRoot = await writeJournal(draft.registrationId, unambiguous)
  try {
    const priceLogs = await captureLogs(async () => {
      const parsed = parseRoot(['voice', 'list', draft.registrationId, '--price'])
      await parsed.command!.handler(asCtx(parsed))
    })
    expect(JSON.parse(priceLogs.at(-1) ?? '{}').state).not.toBe('ready')
    const stillPending = JSON.parse(await Bun.file(join(journalRoot, unambiguous.attemptId, 'voice-provisioning-attempt.json')).text()) as VoiceProvisioningAttempt
    expect(stillPending.outcome?.state).toBe('reconciliation-required')

    const logs = await captureLogs(async () => {
      const parsed = parseRoot(['voice', 'list', draft.registrationId])
      await parsed.command!.handler(asCtx(parsed))
    })
    expect(JSON.parse(logs.at(-1) ?? '{}').state).toBe('ready')
    const completed = JSON.parse(await Bun.file(join(journalRoot, unambiguous.attemptId, 'voice-provisioning-attempt.json')).text()) as VoiceProvisioningAttempt
    expect(completed.outcome?.state).toBe('ready')
  } finally {
    await rm(journalRoot, { recursive: true, force: true })
  }

  const ambiguousDraft = buildReadyVoiceRegistrationDraft({
    registrationId: 'vr_fishambig',
    subjectKey: 'hero',
    profileKey: 'alt',
    provider: 'fish',
    providerModel: 's2.1-pro',
    providerVoice: { ...fishVoice, resourceId: 'fish-voice-2' },
    brief: { ...brief, profileKey: 'alt', allowedOrigins: ['provider-stock', 'designed'] },
    provenanceRef: 'project:casting',
    capabilityFixtureHash: 'b'.repeat(64),
    sanitizedProviderMetadata: { attemptId: 'vp_testambig' },
    createdAt: '2026-08-11T00:01:00.000Z'
  })
  await writeCharacterVoiceBriefCatalog(root, { schemaVersion: 1, briefs: [brief, { ...brief, profileKey: 'alt', allowedOrigins: ['provider-stock', 'designed'] }] })
  await appendVoiceRegistration(root, ambiguousDraft)
  const ambiguous = fishAttempt(ambiguousDraft.registrationId, {
    attemptId: 'vp_testambig',
    lockLeaseId: 'lease_testambig',
    reconciliation: { strategy: 'provider-search', protectedLookupEvidence: { storeId: 'managed_voice_assets_v1', assetId: `sha256_${'b'.repeat(64)}`, sha256: 'b'.repeat(64) } }
  })
  const ambiguousRoot = await writeJournal(ambiguousDraft.registrationId, ambiguous)
  try {
    await rejectVoice(['voice', 'list', ambiguousDraft.registrationId], AMBIGUOUS_VOICE_REDISPATCH_MESSAGE)
    await rejectVoice(
      ['voice', 'list', ambiguousDraft.registrationId, '--reconcile'],
      'Fish provisioning journal has no safe reconciliation lookup handle; refuse to recreate the model.'
    )
  } finally {
    await rm(ambiguousRoot, { recursive: true, force: true })
  }
})

test('voice clone is instant and rejects --kind professional with import guidance', async () => {
  await rejectVoice(
    ['voice', 'clone', 'hero', '--provider', 'elevenlabs', '--model', 'eleven_v3', '--kind', 'professional', '--voice-name', 'Hero', '--consent-ref', 'protected-consent:v1:ID', '--provenance-ref', 'project:casting', '--price'],
    'elevenlabs professional clone is a verification-gated external workflow; finish it in the provider console, then import the approved ID with voice import --voice-id.'
  )
  await rejectVoice(
    ['voice', 'clone', 'hero', '--provider', 'elevenlabs', '--model', 'eleven_v3', '--voice-name', 'Hero', '--consent-ref', 'protected-consent:v1:ID', '--provenance-ref', 'project:casting', '--price'],
    'elevenlabs instant voice clone requires at least one --sample.'
  )
  await rejectVoice(
    ['voice', 'clone', 'hero', '--provider', 'elevenlabs', '--model', 'eleven_v3', '--kind', 'instant', '--voice-name', 'Hero', '--consent-ref', 'protected-consent:v1:ID', '--provenance-ref', 'project:casting', '--price'],
    'elevenlabs instant voice clone requires at least one --sample.'
  )
})

test('voice list --reconcile without a registration id is rejected', async () => {
  await rejectVoice(['voice', 'list', '--reconcile'], '--reconcile requires a registration id.')
  await rejectVoice(['voice', 'design', 'hero', '--reconcile', '--provider', 'elevenlabs', '--price'], '--reconcile is only valid with --save.')
})

test('unambiguous journals complete on design --save, clone, and delete without --reconcile', async () => {
  const root = await makeTempRoot('autoshow-voice-journal-retry-')
  configureCharactersRoot(root)
  const fishVoice = {
    kind: 'remote-resource' as const,
    provider: 'fish' as const,
    resourceId: 'fish-voice-retry',
    namespace: 'account' as const,
    accountScopeHash: 'c'.repeat(64),
    origin: 'designed' as const,
    ownership: 'project' as const,
    deletion: { state: 'eligible' as const, checkedAt: '2026-08-11T00:00:00.000Z' }
  }
  const fishBrief = { ...brief, allowedOrigins: ['provider-stock', 'designed', 'instant-clone'] as typeof brief.allowedOrigins }
  await writeCharacterVoiceBriefCatalog(root, { schemaVersion: 1, briefs: [fishBrief] })

  const saveDraft = buildReadyVoiceRegistrationDraft({
    registrationId: 'vr_fishsave',
    subjectKey: 'hero',
    profileKey: 'default',
    provider: 'fish',
    providerModel: 's2.1-pro',
    providerVoice: fishVoice,
    brief: fishBrief,
    provenanceRef: 'project:casting',
    capabilityFixtureHash: 'b'.repeat(64),
    sanitizedProviderMetadata: { attemptId: 'vp_testsave', desiredName: 'Hero' },
    createdAt: '2026-08-11T00:00:00.000Z'
  })
  await appendVoiceRegistration(root, saveDraft)
  const withoutId = {
    schemaVersion: 1 as const,
    registrationDraftId: saveDraft.registrationId,
    provider: 'fish' as const,
    providerModel: 's2.1-pro',
    operation: 'design' as const,
    sourceIdentityHash: 'd'.repeat(64),
    previewAssets: [] as [],
    plannedCost: { amounts: [] },
    expiryState: 'not-applicable' as const,
    createdAt: '2026-08-11T00:00:00.000Z',
    materialization: { state: 'not-materialized' as const }
  }
  const candidate = { ...withoutId, candidateId: computeVoiceCandidateId(withoutId) }
  await writeVoiceCandidate(root, candidate)
  const saveJournal = await writeJournal(saveDraft.registrationId, fishAttempt(saveDraft.registrationId, {
    attemptId: 'vp_testsave',
    lockLeaseId: 'lease_testsave',
    issuedResources: [{ providerVoice: fishVoice, observedAt: '2026-08-11T00:00:02.000Z', sanitizedResponseHash: 'e'.repeat(64) }]
  }))
  try {
    const logs = await captureLogs(async () => {
      const parsed = parseRoot([
        'voice', 'design', '--save', candidate.candidateId,
        '--provider', 'fish', '--subject-key', 'hero', '--voice-name', 'Hero', '--provenance-ref', 'project:casting'
      ])
      await parsed.command!.handler(asCtx(parsed))
    })
    expect(JSON.parse(logs.at(-1) ?? '{}').state).toBe('ready')
  } finally {
    await rm(saveJournal, { recursive: true, force: true })
  }

  const cloneDraft = buildReadyVoiceRegistrationDraft({
    registrationId: 'vr_fishclone',
    subjectKey: 'hero',
    profileKey: 'default',
    provider: 'fish',
    providerModel: 's2.1-pro',
    providerVoice: { ...fishVoice, resourceId: 'fish-voice-clone' },
    brief: fishBrief,
    provenanceRef: 'project:casting',
    capabilityFixtureHash: 'b'.repeat(64),
    sanitizedProviderMetadata: { attemptId: 'vp_testclone', desiredName: 'HeroClone' },
    createdAt: '2026-08-11T00:02:00.000Z'
  })
  await appendVoiceRegistration(root, cloneDraft)
  const cloneJournal = await writeJournal(cloneDraft.registrationId, fishAttempt(cloneDraft.registrationId, {
    attemptId: 'vp_testclone',
    lockLeaseId: 'lease_testclone',
    issuedResources: [{ providerVoice: { ...fishVoice, resourceId: 'fish-voice-clone' }, observedAt: '2026-08-11T00:02:02.000Z', sanitizedResponseHash: 'f'.repeat(64) }]
  }))
  try {
    const logs = await captureLogs(async () => {
      const parsed = parseRoot(['voice', 'clone', 'hero', '--provider', 'fish', '--model', 's2.1-pro'])
      await parsed.command!.handler(asCtx(parsed))
    })
    expect(JSON.parse(logs.at(-1) ?? '{}').state).toBe('ready')
  } finally {
    await rm(cloneJournal, { recursive: true, force: true })
  }

  const deleteDraft = buildReadyVoiceRegistrationDraft({
    registrationId: 'vr_fishdelete',
    subjectKey: 'hero',
    profileKey: 'default',
    provider: 'fish',
    providerModel: 's2.1-pro',
    providerVoice: { ...fishVoice, resourceId: 'fish-voice-delete' },
    brief: fishBrief,
    provenanceRef: 'project:casting',
    capabilityFixtureHash: 'b'.repeat(64),
    sanitizedProviderMetadata: { attemptId: 'vp_testdelete', desiredName: 'HeroDelete' },
    createdAt: '2026-08-11T00:03:00.000Z'
  })
  await appendVoiceRegistration(root, deleteDraft)
  const deleteJournal = await writeJournal(deleteDraft.registrationId, fishAttempt(deleteDraft.registrationId, {
    attemptId: 'vp_testdelete',
    lockLeaseId: 'lease_testdelete',
    issuedResources: [{ providerVoice: { ...fishVoice, resourceId: 'fish-voice-delete' }, observedAt: '2026-08-11T00:03:02.000Z', sanitizedResponseHash: '1'.repeat(64) }]
  }))
  try {
    await rejectVoice(['voice', 'delete', deleteDraft.registrationId], '--confirm-voice-id is required.')
    const completed = JSON.parse(await Bun.file(join(deleteJournal, 'vp_testdelete', 'voice-provisioning-attempt.json')).text()) as VoiceProvisioningAttempt
    expect(completed.outcome?.state).toBe('ready')
  } finally {
    await rm(deleteJournal, { recursive: true, force: true })
  }
})
