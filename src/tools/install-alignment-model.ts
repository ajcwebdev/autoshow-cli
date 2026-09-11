import { InfraError, UsageError } from '~/utils/error-handler'
import { link, mkdir, open, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

export const ALIGNMENT_MODEL_REVISION = '729c1a6730fb549c20a1c73a3d3f96f11020225e'
export const ALIGNMENT_MODEL_FILES = [
  { source: 'config.json', name: 'config.json', size: 2157, sha256: '15c7cf6378153bdcb33fce27780ab9aae37fd154fbb674cacc3347992055d323' },
  { source: 'preprocessor_config.json', name: 'preprocessor_config.json', size: 215, sha256: '8cdfd65ff4115423185a1512bdae100e2e0cd744f5b322417429944aaafd0827' },
  { source: 'vocab.json', name: 'vocab.json', size: 358, sha256: '4178db26b3c7570f6a47f14ac6a1c7b32950b8c2800fb097287e53776934f1c5' },
  { source: 'onnx/model.onnx', name: 'model.onnx', size: 377911891, sha256: '00b7cc69516c1ab63c429e63a2b543e4d42bb77441ec5b98ee935de175b00de1' }
] as const

const hashFile = async (path: string): Promise<string> => {
  const hash = new Bun.CryptoHasher('sha256')
  for await (const bytes of Bun.file(path).stream()) hash.update(bytes)
  return hash.digest('hex')
}

if (import.meta.main) {
  const args = Bun.argv.slice(2)
  if (args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: bun src/tools/install-alignment-model.ts [model-directory]\nDownloads the pinned English Wav2Vec2 ONNX model (378 MB). Verifies SHA-256 and reuses matching files. Defaults to runtime/models/alignment/wav2vec2-base-960h-onnx.')
  } else {
    if (args.length > 1 || args[0]?.startsWith('-')) throw UsageError('Expected an optional model directory; use --help.')
    const root = resolve(args[0] ?? 'runtime/models/alignment/wav2vec2-base-960h-onnx')
    await mkdir(root, { recursive: true })
    for (const asset of ALIGNMENT_MODEL_FILES) {
      const path = join(root, asset.name)
      if (await Bun.file(path).exists()) {
        if (Bun.file(path).size !== asset.size || await hashFile(path) !== asset.sha256) throw InfraError(`Existing model file differs from the pinned asset: ${path}. File preserved; choose a new model directory.`)
        console.log(`Verified cached ${asset.name}`)
        continue
      }
      const response = await fetch(`https://huggingface.co/onnx-community/wav2vec2-base-960h-ONNX/resolve/${ALIGNMENT_MODEL_REVISION}/${asset.source}`, { signal: AbortSignal.timeout(10 * 60_000) })
      if (!response.ok || !response.body) throw InfraError(`Model download failed: ${response.status} ${asset.source}`)
      const temporary = join(dirname(root), `.alignment-${asset.name}.${crypto.randomUUID()}.partial`)
      const file = await open(temporary, 'wx')
      const hash = new Bun.CryptoHasher('sha256')
      let size = 0
      try {
        for await (const bytes of response.body) {
          size += bytes.length
          if (size > asset.size) throw InfraError(`Download exceeds pinned size: ${asset.name}`)
          hash.update(bytes)
          let offset = 0
          while (offset < bytes.length) offset += (await file.write(bytes, offset)).bytesWritten
        }
      } finally { await file.close() }
      if (size !== asset.size || hash.digest('hex') !== asset.sha256) throw InfraError(`Downloaded asset failed integrity verification: ${asset.name}. Partial file retained at ${temporary}.`)
      await link(temporary, path)
      await unlink(temporary)
      console.log(`Installed ${asset.name}`)
    }
    console.log(root)
  }
}
