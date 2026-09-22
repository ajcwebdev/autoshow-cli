import { chmodSync, linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { InfraError } from '~/utils/error-handler'
import { RUNTIME_DIR } from '~/utils/runtime-paths'

const ACCOUNT_SCOPE_DERIVATION_KEY_PATH = join(RUNTIME_DIR, '.account-scope-derivation-key')
const ACCOUNT_SCOPE_DERIVATION_KEY_BYTES = 32
export const ACCOUNT_SCOPE_HASH_DERIVATION_VERSION = 2 as const
// Filesystems such as exFAT and some network mounts cannot hard-link, so the key is created in place there.
const HARD_LINK_UNSUPPORTED_CODES = new Set(['EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS', 'EXDEV', 'EMLINK'])

const invalidKeyLength = (): Error => InfraError(`Account-scope derivation key has invalid length: ${ACCOUNT_SCOPE_DERIVATION_KEY_PATH}`, {
  stage: 'tts:account-scope-key',
  retryable: false
})

const readExistingKey = (): Uint8Array | undefined => {
  try {
    const existing = readFileSync(ACCOUNT_SCOPE_DERIVATION_KEY_PATH)
    if (existing.byteLength === ACCOUNT_SCOPE_DERIVATION_KEY_BYTES) return existing
    throw invalidKeyLength()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return undefined
  }
}

const readAccountScopeDerivationKey = (): Uint8Array => {
  const existing = readExistingKey()
  if (existing) return existing

  mkdirSync(RUNTIME_DIR, { recursive: true, mode: 0o700 })
  const generated = crypto.getRandomValues(new Uint8Array(ACCOUNT_SCOPE_DERIVATION_KEY_BYTES))
  const stagedPath = `${ACCOUNT_SCOPE_DERIVATION_KEY_PATH}.${process.pid}.${crypto.randomUUID()}.tmp`
  writeFileSync(stagedPath, generated, { flag: 'wx', mode: 0o600 })
  try {
    // Creating the key in place would expose it empty to a concurrent first run. A hard link
    // publishes it only once complete, and fails if another process has already published one.
    linkSync(stagedPath, ACCOUNT_SCOPE_DERIVATION_KEY_PATH)
    return generated
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? ''
    if (HARD_LINK_UNSUPPORTED_CODES.has(code)) {
      writeFileSync(ACCOUNT_SCOPE_DERIVATION_KEY_PATH, generated, { flag: 'wx', mode: 0o600 })
      return generated
    }
    if (code !== 'EEXIST') throw error
    const published = readExistingKey()
    if (!published) throw invalidKeyLength()
    chmodSync(ACCOUNT_SCOPE_DERIVATION_KEY_PATH, 0o600)
    return published
  } finally {
    rmSync(stagedPath, { force: true })
  }
}

export const deriveProviderAccountScopeHash = (
  provider: string,
  credential: string,
  derivationKey: Uint8Array = readAccountScopeDerivationKey()
): string => new Bun.CryptoHasher('sha256', derivationKey)
  .update(`autoshow-account-scope-v${ACCOUNT_SCOPE_HASH_DERIVATION_VERSION}\0${provider}\0${credential.trim()}`, 'utf8')
  .digest('hex')
