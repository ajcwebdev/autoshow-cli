import { extname, join } from 'node:path'
import type { Step4Metadata, TtsExportOptions } from '~/types'
import { encodeTtsDelivery, ttsExportExtension } from './tts-utils/tts-delivery-encode'

export const ttsDeliveryExportFileName = (audioFileName: string, options: Pick<TtsExportOptions, 'format'>): string => {
  const extension = extname(audioFileName)
  return `${extension ? audioFileName.slice(0, -extension.length) : audioFileName}${ttsExportExtension(options.format)}`
}

// The mastered WAV stays in place as the render's reported output; the export is written beside it.
// Audio named in `reuseExisting` was already delivered, so an export that already exists is kept.
export const exportTtsDeliveryAudio = async (
  audioDir: string,
  metadata: readonly Step4Metadata[],
  options: TtsExportOptions | undefined,
  reuseExisting: ReadonlySet<string> = new Set()
): Promise<Step4Metadata[]> => {
  if (!options || options.format === 'wav') return [...metadata]
  const exported: Step4Metadata[] = []
  for (const entry of metadata) {
    if (entry.generationCheckpoint) {
      exported.push(entry)
      continue
    }
    const fileName = ttsDeliveryExportFileName(entry.audioFileName, options)
    const existingPath = join(audioDir, fileName)
    const outputPath = reuseExisting.has(entry.audioFileName) && await Bun.file(existingPath).exists()
      ? existingPath
      : await encodeTtsDelivery({ sourcePaths: [join(audioDir, entry.audioFileName)], outputPath: existingPath, options })
    exported.push({
      ...entry,
      deliveryExport: {
        fileName,
        format: options.format,
        sizeBytes: Bun.file(outputPath).size,
        ...(options.bitrateKbps !== undefined ? { bitrateKbps: options.bitrateKbps } : {}),
        ...(options.metadata ? { metadata: options.metadata } : {}),
      },
    })
  }
  return exported
}
