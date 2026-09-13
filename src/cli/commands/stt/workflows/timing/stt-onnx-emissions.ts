import { createRequire } from 'node:module'
import { join } from 'node:path'
import { PROJECT_ROOT } from '~/utils/runtime-paths'
import { UsageError, ValidationError } from '~/utils/error-handler'
import { readAlignmentModel, tokenizeCtcWords } from './stt-onnx-model'
import { ctcLogProbabilities, decodeAlignmentWave } from './stt-alignment-audio'

type OnnxTensor = { data: Float32Array | Float64Array | BigInt64Array; dims: readonly number[]; dispose(): void }
type OnnxSession = {
  inputNames: readonly string[]; outputNames: readonly string[]
  run(feeds: Record<string, OnnxTensor>): Promise<Record<string, OnnxTensor>>
  release(): Promise<void>
}
type OnnxRuntime = {
  Tensor: new (type: 'float32' | 'int64', data: Float32Array | BigInt64Array, dims: number[]) => OnnxTensor
  InferenceSession: { create(bytes: Uint8Array, options: { executionProviders: string[]; intraOpNumThreads: number; interOpNumThreads: number }): Promise<OnnxSession> }
}
export const ALIGNMENT_RUNTIME_VERSION = '1.29.0'

export const loadAlignmentRuntime = (projectRoot = PROJECT_ROOT): OnnxRuntime => {
  try {
    const require = createRequire(join(projectRoot, 'config/stt-alignment/package.json'))
    if ((require('onnxruntime-node/package.json') as { version: string }).version !== ALIGNMENT_RUNTIME_VERSION) throw UsageError('Runtime version differs from the frozen alignment graph.')
    return require('onnxruntime-node') as OnnxRuntime
  } catch (cause) {
    throw UsageError(`Local ONNX alignment runtime is unavailable. Run bun --no-env-file install --cwd config/stt-alignment --frozen-lockfile --ignore-scripts with the supported Bun version. ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}

export const computeOnnxEmissions = async (model: Awaited<ReturnType<typeof readAlignmentModel>>, clips: Array<{ audio: string; words: string[] }>, projectRoot = PROJECT_ROOT) => {
  const wordInputs = clips.map(clip => tokenizeCtcWords(clip.words, model.vocabulary))
  const runtime = loadAlignmentRuntime(projectRoot)
  // Loading bytes requires a self-contained graph; no model repository or loader code is invoked.
  const session = await runtime.InferenceSession.create(await Bun.file(join(model.root, 'model.onnx')).bytes(), { executionProviders: ['cpu'], intraOpNumThreads: 1, interOpNumThreads: 1 })
  try {
    if (!session.inputNames.includes('input_values') || session.inputNames.some(name => !['input_values', 'attention_mask'].includes(name)) || !session.outputNames.includes('logits')) throw ValidationError('Expected ONNX input_values, optional int64 attention_mask, and logits output.')
    const results = []
    for (const [index, clip] of clips.entries()) {
      const file = Bun.file(clip.audio)
      if (file.size > 4 * 1024 * 1024) throw ValidationError('Alignment WAV exceeds the bounded clip size.')
      const samples = decodeAlignmentWave(await file.bytes(), model.normalize)
      const feeds: Record<string, OnnxTensor> = { input_values: new runtime.Tensor('float32', samples, [1, samples.length]) }
      if (session.inputNames.includes('attention_mask')) feeds['attention_mask'] = new runtime.Tensor('int64', new BigInt64Array(samples.length).fill(1n), [1, samples.length])
      let outputs: Record<string, OnnxTensor> = {}
      try {
        outputs = await session.run(feeds)
        const logits = outputs['logits']
        const frameCount = model.strides.reduce((length, stride, layer) => Math.floor((length - model.kernels[layer]!) / stride) + 1, samples.length)
        const vocabularySize = Object.keys(model.vocabulary).length
        if (!logits || !(logits.data instanceof Float32Array || logits.data instanceof Float64Array) || logits.dims.length !== 3 || logits.dims[0] !== 1 || logits.dims[1] !== frameCount || logits.dims[2] !== vocabularySize) throw ValidationError('ONNX logits disagree with the model vocabulary or acoustic frame rate.')
        results.push({ words: wordInputs[index]!, frames: ctcLogProbabilities(logits.data, frameCount, vocabularySize), blank: model.blank, separator: model.separator, frameSeconds: model.frameSeconds })
      } finally {
        for (const tensor of [...Object.values(feeds), ...Object.values(outputs)]) tensor.dispose()
      }
    }
    return { schemaVersion: 1, backend: 'onnxruntime-wav2vec2-ctc', runtimeVersion: ALIGNMENT_RUNTIME_VERSION, modelHashes: model.modelHashes, clips: results }
  } finally { await session.release() }
}
