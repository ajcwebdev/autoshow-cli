// A tiny acoustic Conv graph encoded directly as ONNX protobuf, with no model download.
const integer = (value: number): Buffer => {
  const bytes = []
  do { bytes.push((value % 128) | (value >= 128 ? 128 : 0)); value = Math.floor(value / 128) } while (value)
  return Buffer.from(bytes)
}
const numeric = (field: number, value: number): Buffer => Buffer.concat([integer(field * 8), integer(value)])
const bytes = (field: number, value: Uint8Array | string): Buffer => {
  const data = typeof value === 'string' ? Buffer.from(value) : Buffer.from(value)
  return Buffer.concat([integer(field * 8 + 2), integer(data.length), data])
}
const message = (...fields: Buffer[]): Buffer => Buffer.concat(fields)
const attribute = (name: string, values: number[]): Buffer => bytes(5, message(bytes(1, name), ...values.map(value => numeric(8, value)), numeric(20, 7)))
const node = (op: string, inputs: string[], output: string, attributes: Buffer[] = []): Buffer => bytes(1, message(...inputs.map(input => bytes(1, input)), bytes(2, output), bytes(4, op), ...attributes))
const tensor = (name: string, dimensions: number[], values: number[]): Buffer => {
  const data = Buffer.alloc(values.length * 4)
  values.forEach((value, index) => data.writeFloatLE(value, index * 4))
  return bytes(5, message(...dimensions.map(dimension => numeric(1, dimension)), numeric(2, 1), bytes(8, name), bytes(9, data)))
}
const valueInfo = (field: number, name: string, dimensions: Array<number | string>): Buffer => bytes(field, message(bytes(1, name), bytes(2, bytes(1, message(numeric(1, 1), bytes(2, message(...dimensions.map(dimension => bytes(1, typeof dimension === 'number' ? numeric(1, dimension) : bytes(2, dimension))))))))))

export const syntheticAlignmentGraph = (): Buffer => message(
  numeric(1, 7), bytes(2, 'autoshow-synthetic-test'), bytes(8, numeric(2, 11)),
  bytes(7, message(
    node('Unsqueeze', ['input_values'], 'channels', [attribute('axes', [1])]),
    node('Conv', ['channels', 'weights', 'bias'], 'scores', [attribute('kernel_shape', [400]), attribute('strides', [320])]),
    node('Transpose', ['scores'], 'logits', [attribute('perm', [0, 2, 1])]),
    bytes(2, 'synthetic-acoustic-ctc'),
    tensor('weights', [5, 1, 400], Array.from({ length: 2000 }, (_, index) => (Math.floor(index / 400) - 2) * .0025)),
    tensor('bias', [5], [0, .1, .2, .3, .4]),
    valueInfo(11, 'input_values', [1, 'samples']), valueInfo(12, 'logits', [1, 'frames', 5])
  ))
)

export const syntheticAlignmentWave = (count = 3200, frequency = .05): Buffer => {
  const bytes = Buffer.alloc(44 + count * 2)
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36); bytes.writeUInt32LE(count * 2, 40)
  for (let index = 0; index < count; index++) bytes.writeInt16LE(Math.round(Math.sin(index * frequency) * 10000), 44 + index * 2)
  return bytes
}

export const writeSyntheticAlignmentModel = async (root: string): Promise<void> => {
  await Bun.write(`${root}/config.json`, JSON.stringify({ model_type: 'wav2vec2', architectures: ['Wav2Vec2ForCTC'], vocab_size: 5, pad_token_id: 0, conv_stride: [320], conv_kernel: [400] }))
  await Bun.write(`${root}/preprocessor_config.json`, JSON.stringify({ sampling_rate: 16000, feature_size: 1, do_normalize: false }))
  await Bun.write(`${root}/vocab.json`, JSON.stringify({ '<pad>': 0, '<unk>': 1, '|': 2, A: 3, B: 4 }))
  await Bun.write(`${root}/model.onnx`, syntheticAlignmentGraph())
}
