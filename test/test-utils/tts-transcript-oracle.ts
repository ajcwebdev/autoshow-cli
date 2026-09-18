import { mkdir, copyFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { createSyntheticWavBytes } from './media-fixtures'
import { getFfprobeBinary } from '~/utils/runtime-paths'
import { whisperfileBinaryPath } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { WHISPERFILE_ARTIFACTS } from '~/cli/commands/stt/local/whisperfile/whisperfile-artifacts'
import { verifyWhisperfileArtifact } from '~/cli/commands/stt/local/whisperfile/whisperfile-integrity'
import { transcribeWhisperfile } from '~/cli/commands/stt/local/whisperfile/transcribe'
import { makeTempDir, withTempDir } from './temp-dirs'

const ORACLE_MODEL = 'small.en'

// No model download or hosted transcription fallback is permitted in this oracle.
export const requireTtsTranscriptOracle = async (): Promise<void> => {
  await verifyWhisperfileArtifact(whisperfileBinaryPath(ORACLE_MODEL), WHISPERFILE_ARTIFACTS[ORACLE_MODEL]!)
  // Verify the executable/decoder before synthesis can spend money, not just its file hash.
  await withTempDir('tts-oracle-preflight-', async dir => {
    const audioPath = join(dir, 'probe.wav')
    await Bun.write(audioPath, createSyntheticWavBytes({ durationSeconds: 0.3, frequencyHz: 440, amplitude: 0.1 }))
    await transcribeWhisperfile(audioPath, dir, { model: ORACLE_MODEL, segmentOffsetMinutes: 0 })
  })
}

const words = (text: string): string[] => text
  .replace(/\[\d{2}:\d{2}:\d{2}(?:\.\d{3})?\]|\[speaker[- ]?\d+\]/gi, '')
  .replace(/autoshow/gi, 'auto show').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []

export const assertSpokenTextMatch = (expected: string, recognized: string, maxWordErrorRate = 0.25): void => {
  const reference = words(expected)
  const actual = words(recognized.replace(/\[BLANK_AUDIO\]/g, ""))
  if (!reference.length || !actual.length) throw new Error('Spoken-text comparison requires nonempty reference and transcription')
  if (reference.length > 5000 || actual.length > 5000) throw new Error('Spoken-text oracle exceeds its short-fixture limit')
  let previous = Array.from({ length: actual.length + 1 }, (_, index) => index)
  for (const [index, word] of reference.entries()) {
    const row = [index + 1]
    for (let column = 0; column < actual.length; column++) row.push(Math.min(row[column]! + 1, previous[column + 1]! + 1, previous[column]! + (word === actual[column] ? 0 : 1)))
    previous = row
  }
  const rate = previous[actual.length]! / reference.length
  if (rate > maxWordErrorRate) throw new Error(`Spoken text differs from its reference (word error rate ${rate.toFixed(3)}, maximum ${maxWordErrorRate}): ${recognized}`)
}

const probeAudio = async (path: string): Promise<string> => {
  const child = Bun.spawn([getFfprobeBinary(), '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], { stdout: 'pipe', stderr: 'pipe' })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  if (exitCode !== 0) return `ffprobe failed (${exitCode}): ${stderr.trim().slice(-500)}`
  const probe = JSON.parse(stdout) as { streams?: Array<Record<string, unknown>>, format?: Record<string, unknown> }
  const stream = probe.streams?.find(entry => entry['codec_type'] === 'audio') ?? {}
  return JSON.stringify({
    container: probe.format?.['format_name'],
    duration: probe.format?.['duration'],
    codec: stream['codec_name'],
    sampleRate: stream['sample_rate'],
    channels: stream['channels']
  })
}

// A transcription failure here has repeatedly been unreproducible afterwards because the run
// directory is cleaned before anyone can look at the audio. Keep the exact bytes the oracle
// choked on, next to the run's other retained artifacts, and describe them in the failure.
const retainOracleFailureEvidence = async (audioPath: string, error: unknown): Promise<never> => {
  const retainedRoot = join(process.env['AUTOSHOW_TEST_ARTIFACTS_DIR'] ?? (await makeTempDir('tts-oracle-failure-')), 'oracle-failures')
  await mkdir(retainedRoot, { recursive: true })
  const retained = join(retainedRoot, `${Date.now()}-${basename(audioPath)}`)
  const copied = await copyFile(audioPath, retained).then(() => true).catch(() => false)
  const size = await Bun.file(audioPath).stat().then(stat => `${stat.size} bytes`).catch(() => 'unreadable')
  throw new Error([
    `Whisperfile oracle could not transcribe ${audioPath} (${size}, ${await probeAudio(audioPath)})`,
    copied ? `Audio retained at ${retained}` : `Audio could not be copied to ${retained}`,
    String(error)
  ].join('\n'))
}

export const assertTtsSpokenText = async (audioPath: string, expected: string): Promise<void> => {
  const source = resolve(audioPath)
  await withTempDir('tts-transcript-oracle-', async dir => {
    const { result } = await transcribeWhisperfile(source, dir, { model: ORACLE_MODEL, segmentOffsetMinutes: 0 })
      .catch(async (error: unknown) => await retainOracleFailureEvidence(source, error))
    assertSpokenTextMatch(expected, result.text)
  })
}
