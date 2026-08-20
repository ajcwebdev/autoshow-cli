import { join } from 'node:path'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'
import { waitFor } from '../../../../test-utils/wait-for'

export { installMockFetch }

export const LOCAL_SHORT_AUDIO_PATH = join('input/examples/audio', '0-audio-short.mp3')

export const LOCAL_AUDIO_PATH = join('input/examples/audio', '1-audio.mp3')

const TTS_CONTRACT_ENV_KEYS = [
  'ELEVENLABS_API_KEY',
  'SPEECHIFY_API_KEY',
  'HUME_API_KEY',
  'CARTESIA_API_KEY',
  'MISTRAL_API_KEY',
  'OPENAI_API_KEY',
  'GROQ_API_KEY',
  'XAI_API_KEY',
  'MINIMAX_API_KEY',
  'DEEPGRAM_API_KEY'
]

export const setupTtsContractLifecycle = (): { makeTempDir: (prefix: string) => Promise<string> } => {
  const tempDirs = setupContractSuiteLifecycle({
    envKeys: TTS_CONTRACT_ENV_KEYS,
    tempPrefix: 'autoshow-tts-contract-',
    restoreBunSleep: true,
    beforeEachExtra: () => {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
    }
  })

  return { makeTempDir: tempDirs.make }
}

export const waitForCondition = async (
  predicate: () => boolean,
  message: string
): Promise<void> => await waitFor(predicate, { timeoutMs: 1_000, intervalMs: 5, label: message })

/**
 * Runs gated assertions without letting a failure hang the test.
 *
 * These scheduler contracts hold provider chunks open behind manual release callbacks. An
 * assertion that throws before the gate opens leaves those promises pending, so the test
 * times out instead of reporting the assertion — which is why every site pasted the same
 * `try/catch/finally + rethrow-after-await` shape. Here it is once: the failure is captured,
 * the gate is always released, and the returned function rethrows once the caller has
 * awaited the in-flight work.
 */
export const captureGatedAssertions = async (
  assertions: () => Promise<void> | void,
  release: () => void
): Promise<() => void> => {
  let failure: unknown
  let failed = false
  try {
    await assertions()
  } catch (error) {
    failed = true
    failure = error
  } finally {
    release()
  }

  return () => {
    if (failed) throw failure
  }
}

export const readWavSamples = async (path: string): Promise<number[]> => {
  const buffer = Buffer.from(await Bun.file(path).arrayBuffer())
  let offset = 12
  while (offset + 8 <= buffer.byteLength) {
    const chunkId = buffer.toString('ascii', offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    const chunkDataOffset = offset + 8
    if (chunkId === 'data') {
      const samples: number[] = []
      for (let sampleOffset = chunkDataOffset; sampleOffset + 1 < chunkDataOffset + chunkSize; sampleOffset += 2) {
        samples.push(buffer.readInt16LE(sampleOffset))
      }
      return samples
    }
    offset = chunkDataOffset + chunkSize + (chunkSize % 2)
  }
  throw new Error(`No data chunk found in WAV file: ${path}`)
}

export const segmentRms = (samples: number[], segmentIndex: number, segmentCount: number): number => {
  const segmentLength = Math.floor(samples.length / segmentCount)
  const start = segmentIndex * segmentLength + Math.floor(segmentLength * 0.25)
  const end = (segmentIndex + 1) * segmentLength - Math.floor(segmentLength * 0.25)
  const selected = samples.slice(start, end)
  const meanSquare = selected.reduce((sum, sample) => sum + sample * sample, 0) / Math.max(1, selected.length)
  return Math.sqrt(meanSquare)
}
