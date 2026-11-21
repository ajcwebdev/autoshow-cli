import { verifyPngSamples } from '~/utils/lossless-png'

/** Hash and decoded dimensions of a PNG that passed strict integrity verification. */
export type VerifiedPngEvidence = {
  sha256: string
  width: number
  height: number
}

export const verifyStrictPngIntegrity = (bytes: Uint8Array): VerifiedPngEvidence => {
  const { width, height } = verifyPngSamples(bytes)
  return { sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'), width, height }
}
