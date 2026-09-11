import { ValidationError, UsageError } from '~/utils/error-handler'
import { writeFile } from 'node:fs/promises'
import { readAlignmentModel } from './stt-onnx-model'
import { computeOnnxEmissions } from './stt-onnx-emissions'

// The compiled distribution runs this bundled worker with Bun because standalone
// executables cannot resolve the optional native package and its dependencies.
if (import.meta.main) {
  const [modelPath, manifestPath, outputPath, projectRoot] = Bun.argv.slice(2)
  if (!modelPath || !manifestPath || !outputPath || !projectRoot || Bun.argv.length !== 6) throw UsageError('Expected model directory, clip manifest, new emissions output path, and project root.')
  const clips: unknown = await Bun.file(manifestPath).json()
  if (!Array.isArray(clips) || !clips.length || clips.some(clip => !clip || typeof clip.audio !== 'string' || !Array.isArray(clip.words) || !clip.words.length || clip.words.some((word: unknown) => typeof word !== 'string'))) throw ValidationError('Invalid local alignment clip manifest.')
  const response = await computeOnnxEmissions(await readAlignmentModel(modelPath), clips, projectRoot)
  await writeFile(outputPath, `${JSON.stringify(response)}\n`, { flag: 'wx' })
}
