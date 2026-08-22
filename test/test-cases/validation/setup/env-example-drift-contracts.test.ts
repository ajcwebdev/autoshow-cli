import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { STANDALONE_TTS_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { HOSTED_PROVIDER_ENV_CHECKS } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { AppUsageError, MISSING_ENV_HINTS } from '~/utils/error-handler'
import { PROJECT_ROOT } from '~/utils/runtime-paths'
import { resolveCredential } from '~/utils/validate/env-utils'

const registryEnvVars = HOSTED_PROVIDER_ENV_CHECKS.map(check => check.envVar)

const readEnvExampleNames = async (): Promise<string[]> => {
  const content = await Bun.file(join(PROJECT_ROOT, '.env.example')).text()
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
    .map(line => line.split('=')[0]?.trim() ?? '')
    .filter(Boolean)
}

test('.env.example names exactly the HOSTED_PROVIDER_ENV_CHECKS inventory', async () => {
  const exampleNames = await readEnvExampleNames()
  expect(new Set(exampleNames).size).toBe(exampleNames.length)
  expect([...exampleNames].sort()).toEqual([...registryEnvVars].sort())
})

test('MISSING_ENV_HINTS covers exactly the HOSTED_PROVIDER_ENV_CHECKS inventory', () => {
  expect(Object.keys(MISSING_ENV_HINTS).sort()).toEqual([...registryEnvVars].sort())
})

test('every missing-key hint names its own env var', () => {
  for (const [envVar, hint] of Object.entries(MISSING_ENV_HINTS)) {
    expect(hint).toContain(envVar)
  }
})

test('hosted credential specifications have unique complete identities and remediation metadata', () => {
  const providerIds = HOSTED_PROVIDER_ENV_CHECKS.map(check => check.providerId)
  expect(new Set(providerIds).size).toBe(providerIds.length)
  expect(new Set(registryEnvVars).size).toBe(registryEnvVars.length)

  for (const check of HOSTED_PROVIDER_ENV_CHECKS) {
    expect(check.providerId.trim()).not.toBe('')
    expect(check.label.trim()).not.toBe('')
    expect(check.stages.length).toBeGreaterThan(0)
    expect(new URL(check.hintUrl).protocol).toBe('https:')
  }
})

test('every standalone TTS provider derives its credential from the hosted specification', () => {
  const specifiedProviders = HOSTED_PROVIDER_ENV_CHECKS
    .flatMap(check => 'ttsPreflight' in check ? [String(check.ttsPreflight.provider)] : [])
    .sort()
  expect(specifiedProviders).toEqual(Object.keys(STANDALONE_TTS_PROVIDER_TARGETS).sort())
})

test('every managed credential supports the same observe and require contract', () => {
  for (const check of HOSTED_PROVIDER_ENV_CHECKS) {
    const missing = resolveCredential(check.providerId, 'observe', { env: {} })
    expect(missing).toMatchObject({
      providerId: check.providerId,
      envVar: check.envVar,
      available: false
    })
    expect(() => resolveCredential(check.providerId, 'require', { stage: 'contract', env: {} }))
      .toThrow(AppUsageError)

    const available = resolveCredential(check.providerId, 'observe', {
      env: { [check.envVar]: '  configured-secret  ' }
    })
    expect(available).toMatchObject({ available: true, value: 'configured-secret' })
    expect(resolveCredential(check.providerId, 'require', {
      stage: 'contract',
      env: { [check.envVar]: '  configured-secret  ' }
    })).toBe('configured-secret')
  }
})
