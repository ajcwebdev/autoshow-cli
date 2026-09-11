import { describe, expect, test } from 'bun:test'
import { symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { validateManagedArtifact } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact'
import type { ManagedPrebuiltPayloadManifest } from '~/types'
import { setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { writeManagedPrebuiltFixture } from './managed-prebuilt-fixtures'

const tempDirs = setupContractSuiteLifecycle({ envKeys: [], tempPrefix: 'autoshow-prebuilt-validation-' })
const verifiers = (trace: string[]) => ({
  verifyArchitecture: async (_path: string, architecture: string) => { trace.push(`architecture:${architecture}`) },
  verifyCodeSignature: async (_path: string, identity: { signingIdentity: string, teamId: string }) => { trace.push(`signature:${identity.teamId}`) }
})
const host = { platform: 'darwin' as const, architecture: 'arm64', macosVersion: '15.4' }

describe('managed prebuilt trust and payload validation', () => {
  test('validates the complete synthetic trust chain before architecture and signature verification', async () => {
    const toolDir = await tempDirs.make()
    const { candidate } = await writeManagedPrebuiltFixture(toolDir)
    const trace: string[] = []
    expect(await validateManagedArtifact('qpdf', { ...host, toolDir, expectedPrebuiltCandidate: candidate, ...verifiers(trace) })).toMatchObject({ healthy: true, distribution: 'prebuilt', architecture: 'arm64' })
    expect(trace).toEqual(['architecture:arm64', 'signature:TESTTEAM01'])
    candidate.releaseManifestSha256 = '0'.repeat(64)
    expect(await validateManagedArtifact('qpdf', { ...host, toolDir, expectedPrebuiltCandidate: candidate, ...verifiers(trace) })).toMatchObject({ healthy: false, reason: 'release manifest SHA-256 does not match candidate metadata' })
    expect(trace).toHaveLength(2)
  })

  const mutations: Array<[string, (payload: ManagedPrebuiltPayloadManifest) => void, string]> = [
    ['source pins', payload => { payload.sources[0]!.sha256 = '0'.repeat(64) }, 'payload source pins'],
    ['build flags', payload => { payload.buildFlags = [] }, 'payload build flags'],
    ['signer', payload => { payload.trust.teamId = 'DIFFERENT1' }, 'payload Team ID'],
    ['license', payload => { payload.license.primaryLicense = 'unreviewed' }, 'distribution license inventory'],
    ['closed schema', payload => { Object.assign(payload, { unreviewed: true }) }, 'Invalid managed prebuilt payload manifest']
  ]
  for (const [label, mutate, reason] of mutations) {
    test(`rejects ${label} even with matching outer manifest hashes`, async () => {
      const toolDir = await tempDirs.make()
      const { candidate } = await writeManagedPrebuiltFixture(toolDir, mutate)
      const trace: string[] = []
      const result = await validateManagedArtifact('qpdf', { ...host, toolDir, expectedPrebuiltCandidate: candidate, ...verifiers(trace) })
      expect(result.healthy).toBe(false)
      if (!result.healthy) expect(result.reason).toContain(reason)
      expect(trace).toEqual([])
    })
  }

  for (const kind of ['hash', 'inventory', 'symlink', 'architecture', 'signature'] as const) {
    test(`rejects ${kind} failures without running later verification`, async () => {
      const toolDir = await tempDirs.make()
      const { candidate } = await writeManagedPrebuiltFixture(toolDir)
      const trace: string[] = []
      const checks = verifiers(trace)
      if (kind === 'hash') await Bun.write(join(toolDir, 'bin/qpdf'), 'corrupt')
      if (kind === 'inventory') await Bun.write(join(toolDir, 'unexpected.txt'), 'extra')
      if (kind === 'symlink') await symlink('bin/qpdf', join(toolDir, 'linked'))
      if (kind === 'architecture') checks.verifyArchitecture = async () => { throw new Error('wrong architecture') }
      if (kind === 'signature') checks.verifyCodeSignature = async () => { throw new Error('wrong signature') }
      const result = await validateManagedArtifact('qpdf', { ...host, toolDir, expectedPrebuiltCandidate: candidate, ...checks })
      expect(result.healthy).toBe(false)
      expect(trace).toEqual(kind === 'signature' ? ['architecture:arm64'] : [])
    })
  }
})
