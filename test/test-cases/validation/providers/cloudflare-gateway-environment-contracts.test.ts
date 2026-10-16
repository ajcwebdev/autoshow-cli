import { expect, test } from 'bun:test'
import { liveCredentialContext } from '../../../test-utils/live-credential-context'
import { withEnv } from '../../../test-utils/rest-contract-helpers'
import { buildChildEnv } from '../../../test-utils/test-command-options'

const observeChild = async (overrides?: Record<string, string | undefined>) => {
  const child = Bun.spawn([process.execPath, '--no-env-file', '-e', `console.log(JSON.stringify({
    gateway: process.env.CLOUDFLARE_AI_GATEWAY_ID ?? null,
    cloudflare: process.env.CLOUDFLARE_API_TOKEN !== undefined,
    unrelated: process.env.GEMINI_API_KEY !== undefined
  }))`], { env: buildChildEnv(overrides), stdout: 'pipe', stderr: 'pipe' })
  const [output, errors, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ])
  expect(exitCode).toBe(0)
  expect(errors).toBe('')
  return JSON.parse(output) as { gateway: string | null, cloudflare: boolean, unrelated: boolean }
}

test('declared Cloudflare callbacks preserve optional gateway billing choice through actual CLI child environments', async () => {
  await withEnv({ CLOUDFLARE_AI_GATEWAY_ID: undefined, GEMINI_API_KEY: 'unrelated-synthetic-key' }, async () => {
    await liveCredentialContext.run({ CLOUDFLARE_API_TOKEN: 'synthetic-cloudflare-token' }, async () => {
      expect(await observeChild()).toEqual({ gateway: null, cloudflare: true, unrelated: false })
      process.env['CLOUDFLARE_AI_GATEWAY_ID'] = 'prepaid-gateway'
      expect(await observeChild()).toEqual({ gateway: 'prepaid-gateway', cloudflare: true, unrelated: false })
      expect(await observeChild({ CLOUDFLARE_AI_GATEWAY_ID: 'explicit-gateway' })).toEqual({ gateway: 'explicit-gateway', cloudflare: true, unrelated: false })
      expect(await observeChild({ CLOUDFLARE_AI_GATEWAY_ID: undefined })).toEqual({ gateway: null, cloudflare: true, unrelated: false })
      delete process.env['CLOUDFLARE_AI_GATEWAY_ID']
      expect(await observeChild()).toEqual({ gateway: null, cloudflare: true, unrelated: false })
    })
  })
})

test('ambient gateway settings stay isolated from ordinary and unrelated provider test children', async () => {
  await withEnv({ CLOUDFLARE_AI_GATEWAY_ID: 'private-routing-choice', CLOUDFLARE_API_TOKEN: 'ambient-synthetic-token' }, async () => {
    expect(await observeChild()).toEqual({ gateway: null, cloudflare: false, unrelated: false })
    await liveCredentialContext.run({ OPENAI_API_KEY: 'declared-other-provider' }, async () => {
      expect(await observeChild()).toEqual({ gateway: null, cloudflare: false, unrelated: false })
    })
  })
})
