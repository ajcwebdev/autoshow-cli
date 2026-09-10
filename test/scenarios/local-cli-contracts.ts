import assert from 'node:assert/strict'
import { access, stat } from 'node:fs/promises'
import { join } from 'node:path'

// Test-neutral contracts: importing these never registers or runs a provider suite.
export interface CliOutcome {
  exitCode: number
  stdout: string
  stderr: string
  outputDir: string | null
  outputRoot: string
}

export interface LocalExecutionAdapter {
  fixture(name: string): string
  hostPath(path: string, relativeTo?: string): string
  execute(args: string[]): Promise<CliOutcome>
  probe(path: string): Promise<{ codec_name: string; width: number; height: number }>
}

export async function artifactExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

export async function assertArtifact(path: string): Promise<void> {
  assert((await stat(path)).size > 0, `Empty artifact: ${path}`)
}

export function assertContains(actual: unknown, expected: unknown, path = 'value'): void {
  if (expected !== null && typeof expected === 'object') {
    assert(actual !== null && typeof actual === 'object', `Missing ${path}`)
    if (Array.isArray(expected)) {
      assert(Array.isArray(actual), `Expected array at ${path}`)
      assert.equal(actual.length, expected.length, `Array length at ${path}`)
    }
    for (const [key, value] of Object.entries(expected)) {
      assertContains((actual as Record<string, unknown>)[key], value, `${path}.${key}`)
    }
  } else {
    assert.deepEqual(actual, expected, path)
  }
}

export type FixturePath = (name: string) => string
export const DOWNLOAD_TIMESTAMPED_CHILD_DIR_PATTERN = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}_/
export const PUBLIC_DOWNLOADS = {
  audio: 'https://ajc.pics/autoshow/1-audio.mp3',
  video: 'https://ajc.pics/autoshow/2-video.mp4',
  youtube: 'https://www.youtube.com/watch?v=u1-WHqATSQU',
  twitch: 'https://www.twitch.tv/videos/1844440442',
  article: 'https://ajcwebdev.com'
} as const

export interface DownloadScenario {
  id: string
  name: string
  input: string
  kind: 'audio' | 'video' | 'pdf' | 'youtube' | 'twitch' | 'url_list' | 'podcast_rss'
  args: string[]
  batch: boolean
}

export function downloadScenarios(fixture: FixturePath, urls: Record<keyof typeof PUBLIC_DOWNLOADS, string> = PUBLIC_DOWNLOADS, feed = ''): DownloadScenario[] {
  return [
    { id: 'download-local-audio', name: 'download local audio input', input: fixture('audio'), kind: 'audio', batch: false, args: [] },
    { id: 'download-local-document', name: 'download local document input', input: fixture('pdf'), kind: 'pdf', batch: false, args: [] },
    { id: 'download-direct-audio', name: 'download direct audio URL input', input: urls.audio, kind: 'audio', batch: false, args: [] },
    { id: 'download-direct-video', name: 'download direct video URL input', input: urls.video, kind: 'video', batch: false, args: [] },
    { id: 'download-url-list', name: 'download URL list of direct URLs input', input: fixture('urls'), kind: 'url_list', batch: true, args: ['--batch-limit', '1'] },
    { id: 'download-rss', name: 'download RSS feed input', input: feed, kind: 'podcast_rss', batch: true, args: ['--batch-limit', '1'] },
    { id: 'download-youtube', name: 'download YouTube video URL input', input: urls.youtube, kind: 'youtube', batch: false, args: [] },
    { id: 'download-twitch', name: 'download Twitch video URL input', input: urls.twitch, kind: 'twitch', batch: false, args: [] }
  ]
}

export async function assertDownloadRecord(kind: DownloadScenario['kind'], metadata: { step1?: { audioFileName?: string; audioFileSize?: number; format?: string; pageCount?: number; fileSize?: number; title?: string; channel?: string } }, dir: string): Promise<void> {
  const step = metadata.step1
  assert(step, 'Missing download metadata')
  if (kind === 'pdf') {
    assert.equal(step.format, 'pdf')
    assert((step.pageCount ?? 0) > 0)
    assert((step.fileSize ?? 0) > 0)
  } else {
    assert(step.audioFileName)
    assert((step.audioFileSize ?? 0) > 0)
    if (kind === 'audio') assert(step.audioFileName.endsWith('.mp3'))
    if (kind === 'video') assert(!step.audioFileName.endsWith('.wav'))
    if (kind === 'youtube') { assert(step.title); assert(step.channel) }
    await assertArtifact(join(dir, step.audioFileName))
  }
}

export async function assertDownloadOnly(dir: string, metadata: Record<string, unknown>): Promise<void> {
  for (const name of ['transcription.txt', 'extraction.txt', 'text.json', 'prompt.md']) {
    assert.equal(await artifactExists(join(dir, name)), false, `Unexpected ${name}`)
  }
  assert.equal(metadata['step2'], undefined)
  assert.equal(metadata['step3'], undefined)
}

export interface RejectionScenario {
  id: string
  name: string
  source: string
  args: string[]
  exitCode: number
  diagnostic: string
  absent?: string[]
}

export function rejectionScenarios(fixture: FixturePath): RejectionScenario[] {
  const mistral = ['tts', fixture('text'), '--provider', 'mistral=voxtral-mini-tts-2603']
  const bfl = ['image', 'a sunset', '--provider', 'bfl=flux-2-pro']
  const luma = ['image', 'a sunset', '--provider', 'lumalabs=uni-1']
  const tts = 'audio/tts/'
  return [
    { id: 'reject-mistral-model', name: 'rejects invalid mistral model', source: `${tts}mistral-validation.test.ts`, args: ['tts', fixture('text'), '--provider', 'mistral=invalid-model'], exitCode: 2, diagnostic: 'Invalid model "invalid-model" for --provider/--tts mistral[=model]' },
    { id: 'reject-mistral-voice', name: 'mistral execution rejects a missing voice source before provider setup', source: `${tts}mistral-validation.test.ts`, args: mistral, exitCode: 2, diagnostic: 'requires an existing voice ID or an explicitly authorized unnamed request reference', absent: ['MISTRAL_API_KEY'] },
    { id: 'reject-mistral-voice-name', name: 'mistral named saved-voice creation flag is rejected as an unknown flag', source: `${tts}mistral-voxtral-mini-tts-2603-voice.test.ts`, args: [...mistral, '--tts-ref-audio', fixture('audio'), '--tts-voice-name', 'AutoShowVoice'], exitCode: 2, diagnostic: 'Unexpected flag: --tts-voice-name', absent: ['MISTRAL_API_KEY'] },
    { id: 'reject-mistral-remote-reference', name: 'mistral dialogue rejects remote reference locators before provider setup', source: `${tts}mistral-dialogue-ref-audio.test.ts`, args: ['tts', fixture('dialogue'), '--provider', 'mistral=voxtral-mini-tts-2603', '--tts-dialogue-format', 'labeled', '--tts-speaker', `Host=${fixture('audio')}`, '--tts-speaker', `Guest=${PUBLIC_DOWNLOADS.audio}`], exitCode: 1, diagnostic: 'Unable to read the authorized reference audio.', absent: ['MISTRAL_API_KEY', PUBLIC_DOWNLOADS.audio, fixture('audio')] },
    { id: 'reject-bfl-aspect', name: 'rejects unsupported BFL shared image flags', source: 'visuals/image/bfl-validation.test.ts', args: [...bfl, '--aspect-ratio', '1:1'], exitCode: 2, diagnostic: '--aspect-ratio is not supported by BFL/flux-2-pro' },
    { id: 'reject-bfl-size', name: 'rejects invalid BFL image size values', source: 'visuals/image/bfl-validation.test.ts', args: [...bfl, '--size', '1024'], exitCode: 2, diagnostic: 'Invalid --size value "1024" for BFL' },
    { id: 'reject-luma-size', name: 'rejects unsupported Luma Labs image size flag', source: 'visuals/image/lumalabs-validation.test.ts', args: [...luma, '--size', '1024x1024'], exitCode: 2, diagnostic: '--size is not supported by Luma Labs/uni-1' },
    { id: 'reject-luma-aspect', name: 'rejects invalid Luma Labs aspect ratio values', source: 'visuals/image/lumalabs-validation.test.ts', args: [...luma, '--aspect-ratio', '5:7'], exitCode: 2, diagnostic: 'Invalid --aspect-ratio value "5:7" for Luma Labs' },
    { id: 'reject-luma-format', name: 'rejects invalid Luma Labs output format values', source: 'visuals/image/lumalabs-validation.test.ts', args: [...luma, '--format', 'webp'], exitCode: 2, diagnostic: 'Invalid --format value "webp" for Luma Labs' },
    { id: 'reject-music-provider', name: 'requires a music provider flag', source: 'audio/music/provider-flag-validation.test.ts', args: ['music', 'an ambient piano song'], exitCode: 2, diagnostic: 'Specify a music generation provider' }
  ]
}

export function assertRejection(result: CliOutcome, scenario: RejectionScenario): void {
  assert.equal(result.exitCode, scenario.exitCode, result.stderr)
  assert.equal(result.outputDir, null, 'Rejection must not create a run')
  const output = `${result.stdout}\n${result.stderr}`
  assert(output.includes(scenario.diagnostic), `Missing diagnostic: ${scenario.diagnostic}\n${output}`)
  for (const absent of scenario.absent ?? []) assert(!output.includes(absent), `Unexpected diagnostic disclosure: ${absent}`)
}
