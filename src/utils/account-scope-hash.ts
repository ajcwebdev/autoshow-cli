import { createHmac, randomBytes } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { InfraError } from '~/utils/error-handler'
import { RUNTIME_DIR } from '~/utils/runtime-paths'

const ACCOUNT_SCOPE_DERIVATION_KEY_PATH = join(RUNTIME_DIR, '.account-scope-derivation-key')
const ACCOUNT_SCOPE_DERIVATION_KEY_BYTES = 32
export const ACCOUNT_SCOPE_HASH_DERIVATION_VERSION = 2 as const

const readAccountScopeDerivationKey = (): Buffer => {
  try {
    const existing = readFileSync(ACCOUNT_SCOPE_DERIVATION_KEY_PATH)
    if (existing.byteLength === ACCOUNT_SCOPE_DERIVATION_KEY_BYTES) return existing
    throw InfraError(`Account-scope derivation key has invalid length: ${ACCOUNT_SCOPE_DERIVATION_KEY_PATH}`, {
      stage: 'tts:account-scope-key',
      retryable: false
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  mkdirSync(RUNTIME_DIR, { recursive: true, mode: 0o700 })
  const generated = randomBytes(ACCOUNT_SCOPE_DERIVATION_KEY_BYTES)
  try {
    writeFileSync(ACCOUNT_SCOPE_DERIVATION_KEY_PATH, generated, { flag: 'wx', mode: 0o600 })
    return generated
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    const existing = readFileSync(ACCOUNT_SCOPE_DERIVATION_KEY_PATH)
    if (existing.byteLength !== ACCOUNT_SCOPE_DERIVATION_KEY_BYTES) {
      throw InfraError(`Account-scope derivation key has invalid length: ${ACCOUNT_SCOPE_DERIVATION_KEY_PATH}`, {
        stage: 'tts:account-scope-key',
        retryable: false
      })
    }
    chmodSync(ACCOUNT_SCOPE_DERIVATION_KEY_PATH, 0o600)
    return existing
  }
}

export const deriveProviderAccountScopeHash = (
  provider: string,
  credential: string,
  derivationKey: Uint8Array = readAccountScopeDerivationKey()
): string => createHmac('sha256', derivationKey)
  .update(`autoshow-account-scope-v${ACCOUNT_SCOPE_HASH_DERIVATION_VERSION}\0${provider}\0${credential.trim()}`, 'utf8')
  .digest('hex')
