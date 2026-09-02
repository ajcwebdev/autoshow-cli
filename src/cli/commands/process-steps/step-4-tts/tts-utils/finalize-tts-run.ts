import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import type { FinalizeTtsRunOptions, Step4Metadata } from '~/types'

export const finalizeTtsRun = ({
  service,
  model,
  speaker,
  audioPath,
  chunkCount,
  startTime
}: FinalizeTtsRunOptions): { audioPath: string, metadata: Step4Metadata } => {
  const processingTime = Date.now() - startTime
  const audioFile = Bun.file(audioPath)

  logMediaGenerationStatus( {
    mediaType: 'tts',
    provider: service,
    model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: chunkCount,
    ...(speaker ? { detail: `speaker: ${speaker}` } : {}),
    artifacts: [{ artifact: 'speech', path: audioPath }]
  })

  return {
    audioPath,
    metadata: {
      ttsService: service,
      ttsModel: model,
      ...(speaker ? { speaker } : {}),
      processingTime,
      audioFileName: 'speech.wav',
      audioFileSize: audioFile.size,
      chunkCount
    }
  }
}
