import { lstat, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { ValidationError } from '~/utils/error-handler'
import { hashLocalTimingFile } from './stt-local-workspace'

const readModelJson = async (root: string, name: string): Promise<Record<string, unknown>> => {
  const file = Bun.file(join(root, name))
  if (file.size > 1024 * 1024) throw ValidationError(`Alignment JSON exceeds 1 MiB: ${name}`)
  const source = await file.text()
  const value: unknown = JSON.parse(source)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw ValidationError(`Expected JSON object: ${name}`)
  const objects: Array<Set<string> | null> = []
  for (const token of source.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]]/g)) {
    const text = token[0]
    if (text === '{' || text === '[') objects.push(text === '{' ? new Set() : null)
    else if (text === '}' || text === ']') objects.pop()
    else if (/^\s*:/.test(source.slice(token.index + text.length))) {
      const key = JSON.parse(text) as string
      const keys = objects.at(-1)
      if (keys?.has(key)) throw ValidationError(`Duplicate configuration key: ${key}`)
      keys?.add(key)
      if (['auto_map', 'custom_pipelines', 'quantization_config'].includes(key)) throw ValidationError(`Unsupported model dispatch configuration: ${key}`)
    }
  }
  return value as Record<string, unknown>
}

const dimensions = (value: unknown, name: string): number[] => {
  if (!Array.isArray(value) || !value.length || value.length > 32 || value.some(item => !Number.isInteger(item) || item < 1 || item > 16000)) throw ValidationError(`Invalid Wav2Vec2 ${name}`)
  return value as number[]
}

export const readAlignmentModel = async (model: string) => {
  const root = resolve(model)
  const allowed = new Set(['config.json', 'preprocessor_config.json', 'vocab.json', 'model.onnx', 'tokenizer_config.json', 'special_tokens_map.json', 'README.md', 'LICENSE', '.gitattributes'])
  for (const name of await readdir(root)) {
    const info = await lstat(join(root, name))
    if (!allowed.has(name) || !info.isFile() || info.isSymbolicLink()) throw ValidationError(`Unsupported alignment model asset: ${name}. Supply a local ONNX model directory; PyTorch weights are no longer supported.`)
  }
  for (const name of ['config.json', 'preprocessor_config.json', 'vocab.json', 'model.onnx']) {
    if (!await Bun.file(join(root, name)).exists()) throw ValidationError(`Alignment requires ${name} in the local ONNX model directory.`)
  }
  const config = await readModelJson(root, 'config.json')
  if (config['model_type'] !== 'wav2vec2' || JSON.stringify(config['architectures'] ?? ['Wav2Vec2ForCTC']) !== '["Wav2Vec2ForCTC"]' || config['add_adapter'] === true) throw ValidationError('Only Wav2Vec2ForCTC ONNX models without adapters are supported.')
  const strides = dimensions(config['conv_stride'], 'conv_stride'), kernels = dimensions(config['conv_kernel'], 'conv_kernel')
  if (strides.length !== kernels.length) throw ValidationError('Model convolution strides and kernels disagree.')
  const processor = await readModelJson(root, 'preprocessor_config.json')
  if (processor['sampling_rate'] !== 16000 || (processor['feature_size'] ?? 1) !== 1 || (processor['do_normalize'] !== undefined && typeof processor['do_normalize'] !== 'boolean')) throw ValidationError('Expected a mono 16 kHz Wav2Vec2 feature extractor.')
  const vocabulary = await readModelJson(root, 'vocab.json') as Record<string, number>
  const ids = Object.values(vocabulary).toSorted((a, b) => a - b)
  if (!ids.length || ids.length > 65536 || ids.some((id, index) => !Number.isInteger(id) || id !== index) || !['<pad>', '<unk>', '|'].every(key => Object.hasOwn(vocabulary, key))) throw ValidationError('Vocabulary IDs must be unique and contiguous, including <pad>, <unk>, and |.')
  if (config['vocab_size'] !== ids.length || config['pad_token_id'] !== vocabulary['<pad>']) throw ValidationError('Model and vocabulary disagree.')
  for (const name of ['tokenizer_config.json', 'special_tokens_map.json']) if (await Bun.file(join(root, name)).exists()) await readModelJson(root, name)
  const modelHashes: Record<string, string> = {}
  for (const name of (await readdir(root)).sort()) if (name.endsWith('.json') || name.endsWith('.onnx')) modelHashes[name] = await hashLocalTimingFile(join(root, name))
  return { root, vocabulary, blank: vocabulary['<pad>']!, separator: vocabulary['|']!, strides, kernels, frameSeconds: strides.reduce((a, b) => a * b, 1) / 16000, normalize: processor['do_normalize'] !== false, modelHashes }
}

export const tokenizeCtcWords = (words: string[], vocabulary: Record<string, number>) => words.map(text => {
  const letters = [...text.toUpperCase().replaceAll('’', "'")].filter(char => /[\p{L}\p{N}']/u.test(char)).join('').replace(/^'+|'+$/g, '')
  const normalized = [...letters].map(char => Object.hasOwn(vocabulary, char) ? char : char.toLowerCase())
  if (!normalized.length || normalized.some(char => !Object.hasOwn(vocabulary, char) || char === '|' || char.startsWith('<'))) throw ValidationError(`Word cannot be represented by the local alignment vocabulary: ${text}`)
  return { text, tokens: normalized.map(char => vocabulary[char]!) }
})
