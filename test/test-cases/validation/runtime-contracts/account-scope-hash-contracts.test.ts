import { describe, expect, test } from 'bun:test'
import {
  ACCOUNT_SCOPE_HASH_DERIVATION_VERSION,
  deriveProviderAccountScopeHash
} from '~/utils/account-scope-hash'

describe('provider account-scope hash derivation', () => {
  const installationKey = Uint8Array.from({ length: 32 }, (_value, index) => index + 1)

  test('uses the version-2 installation-keyed derivation deterministically', () => {
    const first = deriveProviderAccountScopeHash('fish', '  credential-value  ', installationKey)
    const second = deriveProviderAccountScopeHash('fish', 'credential-value', installationKey)
    const formerUnsaltedDigest = new Bun.CryptoHasher('sha256')
      .update(JSON.stringify({ schemaVersion: 1, provider: 'fish', credential: 'credential-value' }))
      .digest('hex')

    expect(ACCOUNT_SCOPE_HASH_DERIVATION_VERSION).toBe(2)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
    expect(first).toBe(second)
    expect(first).not.toBe(formerUnsaltedDigest)
  })

  test('separates installations providers and credentials', () => {
    const baseline = deriveProviderAccountScopeHash('fish', 'credential-value', installationKey)
    const otherInstallation = deriveProviderAccountScopeHash('fish', 'credential-value', new Uint8Array(32).fill(9))
    const otherProvider = deriveProviderAccountScopeHash('inworld', 'credential-value', installationKey)
    const otherCredential = deriveProviderAccountScopeHash('fish', 'another-credential', installationKey)

    expect(new Set([baseline, otherInstallation, otherProvider, otherCredential]).size).toBe(4)
  })
})
