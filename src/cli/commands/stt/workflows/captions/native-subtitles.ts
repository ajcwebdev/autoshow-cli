import { writeFileExact } from '~/utils/bun-file-io'

import { ProviderError } from '~/utils/error-handler'

// Export failure must never turn completed, potentially paid ASR into a retry.
export const saveNativeSubtitle = async (
  outputBase: string,
  format: 'srt' | 'vtt',
  load: () => Promise<string>
): Promise<void> => {
  try {
    const text = await load()
    if (!text.trim() || !text.includes('-->')) throw ProviderError('Provider returned no recognizable subtitle cues', { stage: 'stt:subtitle-export', retryable: false })
    await writeFileExact(`${outputBase}.native.${format}`, text)
  } catch (error) {
    await writeFileExact(`${outputBase}.native.${format}.error.json`, JSON.stringify({
      format, error: error instanceof Error ? error.message : String(error),
      recovery: 'Canonical JSON transcription is retained. Export local captions from result.json without another transcription.'
    }, null, 2) + '\n')
  }
}

export const fetchNativeSubtitle = async (url: string, headers: Record<string, string> = {}): Promise<string> => {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw ProviderError(`Subtitle export failed: HTTP ${response.status}`, { stage: 'stt:subtitle-export', status: response.status, retryable: false })
  return await response.text()
}
