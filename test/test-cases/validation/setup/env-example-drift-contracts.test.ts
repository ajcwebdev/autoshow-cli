import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { HOSTED_PROVIDER_ENV_CHECKS } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { MISSING_ENV_HINTS } from '~/utils/error-handler'
import { PROJECT_ROOT } from '~/utils/runtime-paths'

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
