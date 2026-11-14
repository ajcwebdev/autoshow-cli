import { InfraError } from '~/utils/error-handler'

export const verifyWhisperfileArtifact = async (path: string, expected: { sha256: string; size: number }): Promise<void> => {
  const file = Bun.file(path)
  const hash = new Bun.CryptoHasher('sha256')
  if (file.size === expected.size) {
    for await (const bytes of file.stream()) hash.update(bytes)
    if (hash.digest('hex') === expected.sha256) return
  }
  throw InfraError(`Whisperfile integrity check failed: ${path}. Cache preserved; run bun autoshow setup --step whisperfile to repair the managed artifact.`, { stage: 'setup:whisperfile' })
}
