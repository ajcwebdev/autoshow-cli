import { expect, spyOn, test } from 'bun:test'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readAlignmentModel, tokenizeCtcWords } from '~/cli/commands/stt/workflows/timing/stt-onnx-model'
import { ctcLogProbabilities, decodeAlignmentWave } from '~/cli/commands/stt/workflows/timing/stt-alignment-audio'
import { computeOnnxEmissions } from '~/cli/commands/stt/workflows/timing/stt-onnx-emissions'
import { alignCtcWords } from '~/cli/commands/stt/workflows/timing/ctc-word-alignment'
import { syntheticAlignmentWave, writeSyntheticAlignmentModel } from '../../../../../test-utils/onnx-alignment-fixture'

const withModel = async (run: (root: string) => Promise<void>) => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-onnx-test-'))
  try { await writeSyntheticAlignmentModel(root); await run(root) } finally { await rm(root, { recursive: true, force: true }) }
}

test('alignment validates model assets and vocabulary before loading the native backend', async () => withModel(async root => {
  const model = await readAlignmentModel(root)
  expect(model.frameSeconds).toBe(.02)
  expect(tokenizeCtcWords(['A,', 'b!'], model.vocabulary)).toEqual([{ text: 'A,', tokens: [3] }, { text: 'b!', tokens: [4] }])
  expect(() => tokenizeCtcWords(['123'], model.vocabulary)).toThrow('cannot be represented')
  await Bun.write(join(root, 'vocab.json'), '{"<pad>":0,"<unk>":1,"|":2,"A":3,"A":4}')
  await expect(readAlignmentModel(root)).rejects.toThrow('Duplicate')
  await writeSyntheticAlignmentModel(root)
  await Bun.write(join(root, 'tokenizer_config.json'), '{"auto_map":{"AutoTokenizer":"remote.Code"}}')
  await expect(readAlignmentModel(root)).rejects.toThrow('dispatch')
  await rm(join(root, 'tokenizer_config.json'))
  await Bun.write(join(root, 'pytorch_model.bin'), 'unsupported')
  await expect(readAlignmentModel(root)).rejects.toThrow('PyTorch weights')
  await rm(join(root, 'pytorch_model.bin'))
  await rm(join(root, 'model.onnx'))
  await symlink(join(root, 'config.json'), join(root, 'model.onnx'))
  await expect(readAlignmentModel(root)).rejects.toThrow('Unsupported')
}))

test('PCM preprocessing and log-softmax preserve acoustic values and reject malformed input', () => {
  const wave = syntheticAlignmentWave()
  const raw = decodeAlignmentWave(wave, false), normalized = decodeAlignmentWave(wave, true)
  expect(raw[1]).toBe(wave.readInt16LE(46) / 32768)
  expect(normalized.reduce((sum, value) => sum + value, 0) / normalized.length).toBeCloseTo(0, 6)
  expect(normalized.reduce((sum, value) => sum + value * value, 0) / normalized.length).toBeCloseTo(1, 4)
  const invalid = Buffer.from(wave); invalid.writeUInt32LE(44100, 24)
  expect(() => decodeAlignmentWave(invalid, true)).toThrow('16 kHz')
  expect(() => decodeAlignmentWave(wave.subarray(0, 60), true)).toThrow('complete PCM')
  expect(ctcLogProbabilities([1000, 1000], 1, 2)[0]).toEqual([-Math.log(2), -Math.log(2)])
  expect(() => ctcLogProbabilities([NaN], 1, 1)).toThrow('non-finite')
})

test('native ONNX inference produces audio-dependent logits and usable CTC timing without downloads', async () => withModel(async root => {
  const model = await readAlignmentModel(root)
  const audio = join(tmpdir(), `autoshow-onnx-audio-${crypto.randomUUID()}.wav`)
  const noNetwork = () => { throw new Error('Offline alignment attempted a download') }
  const fetch = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(noNetwork, { preconnect: noNetwork }))
  try {
    const wave = syntheticAlignmentWave()
    await Bun.write(audio, wave)
    const result = await computeOnnxEmissions(model, [{ audio, words: ['A', 'B'] }])
    expect(result.backend).toBe('onnxruntime-wav2vec2-ctc')
    const clip = result.clips[0]!
    expect(clip.frames).toHaveLength(9)
    expect(clip.frames[0]).toHaveLength(5)
    const samples = decodeAlignmentWave(wave, false)
    const sum = samples.slice(0, 400).reduce((a, b) => a + b, 0)
    const expected = ctcLogProbabilities(Array.from({ length: 5 }, (_, index) => sum * (index - 2) * .0025 + index * .1), 1, 5)[0]!
    clip.frames[0]!.forEach((score, index) => expect(score).toBeCloseTo(expected[index]!, 5))
    const words = alignCtcWords(clip.frames, clip.words, clip.blank, clip.frameSeconds, clip.separator)
    expect(words.map(word => word.text)).toEqual(['A', 'B'])
    expect(words.every(word => word.startSeconds >= 0 && word.endSeconds > word.startSeconds && word.endSeconds <= .2)).toBe(true)
    await Bun.write(audio, syntheticAlignmentWave(3200, .1))
    const changed = await computeOnnxEmissions(model, [{ audio, words: ['A', 'B'] }])
    expect(changed.clips[0]!.frames[0]).not.toEqual(clip.frames[0])
  } finally { fetch.mockRestore(); await rm(audio, { force: true }) }
}))

test('bundled alignment worker resolves the optional runtime and refuses to overwrite emissions', async () => withModel(async model => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-onnx-worker-test-'))
  try {
    const worker = join(directory, 'worker.js'), audio = join(directory, 'audio.wav'), manifest = join(directory, 'clips.json'), output = join(directory, 'emissions.json')
    await Bun.write(audio, syntheticAlignmentWave())
    await Bun.write(manifest, JSON.stringify([{ audio, words: ['A', 'B'] }]))
    const build = Bun.spawn([process.execPath, '--no-env-file', 'build', 'src/cli/commands/stt/workflows/timing/stt-onnx-worker.ts', '--target=bun', `--outfile=${worker}`], { stdout: 'ignore', stderr: 'pipe' })
    const [buildCode, buildError] = await Promise.all([build.exited, new Response(build.stderr).text()])
    expect({ buildCode, buildError }).toEqual({ buildCode: 0, buildError: '' })
    const run = () => Bun.spawn([process.execPath, '--no-env-file', worker, model, manifest, output, process.cwd()], { env: { PATH: '' }, stdout: 'ignore', stderr: 'pipe' })
    const first = run()
    const [firstCode, firstError] = await Promise.all([first.exited, new Response(first.stderr).text()])
    expect(firstCode, firstError).toBe(0)
    const bytes = await Bun.file(output).text()
    expect(JSON.parse(bytes).clips[0].frames).toHaveLength(9)
    const second = run()
    const [secondCode, secondError] = await Promise.all([second.exited, new Response(second.stderr).text()])
    expect(secondCode).not.toBe(0)
    expect(secondError).toContain('EEXIST')
    expect(await Bun.file(output).text()).toBe(bytes)
  } finally { await rm(directory, { recursive: true, force: true }) }
}))
