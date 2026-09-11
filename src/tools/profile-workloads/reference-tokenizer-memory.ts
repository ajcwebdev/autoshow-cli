import {
  clearReferenceTokenizerCache,
  encodeReferenceTokens,
  getReferenceTokenizerCacheEntryCount
} from '~/utils/reference-tokenizer'

type ProfileState = 'before-load' | 'after-load' | 'after-eviction' | 'after-reconstruction'

const state = Bun.argv[2] as ProfileState | undefined
if (!state || !['before-load', 'after-load', 'after-eviction', 'after-reconstruction'].includes(state)) {
  throw new Error('Expected tokenizer profile state: before-load, after-load, after-eviction, or after-reconstruction')
}

const fixture = Array.from({ length: 4000 }, (_, index) =>
  `Tokenizer fixture ${index}: café 東京 🧭 cache reconstruction remains deterministic.`
).join('\n')
const tokenHash = (tokens: number[]): string => new Bun.CryptoHasher('sha256')
  .update(new Uint8Array(new Uint32Array(tokens).buffer))
  .digest('hex')

clearReferenceTokenizerCache()
let baselineHash: string | null = null
let rebuiltHash: string | null = null

if (state !== 'before-load') {
  baselineHash = tokenHash(encodeReferenceTokens(fixture))
}
if (state === 'after-eviction' || state === 'after-reconstruction') {
  clearReferenceTokenizerCache()
  Bun.gc(true)
}
if (state === 'after-reconstruction') {
  rebuiltHash = tokenHash(encodeReferenceTokens(fixture))
  if (rebuiltHash !== baselineHash) throw new Error('Reference tokenizer changed after cache reconstruction')
}

process.stdout.write(`${JSON.stringify({
  fixture: 'synthetic-reference-tokenizer-v1',
  state,
  cacheEntries: getReferenceTokenizerCacheEntryCount(),
  baselineHash,
  rebuiltHash,
  memoryUsage: process.memoryUsage()
})}\n`)
