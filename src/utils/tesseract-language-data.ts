import type { RunResult } from '~/types'

type EnglishDataInspection = { status: 'ready' } | { status: 'missing' | 'invalid', detail: string }

const runIssue = (result: RunResult): string =>
  (result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`).slice(0, 300)

// Listing languages only lists filenames: even a corrupt eng.traineddata is listed.
// Initialize the same English LSTM engine used by OCR before declaring it usable.
export const inspectTesseractEnglishData = async (
  run: (args: string[]) => Promise<RunResult>
): Promise<EnglishDataInspection> => {
  const listed = await run(['--list-langs'])
  if (listed.exitCode !== 0) return { status: 'invalid', detail: `could not list languages: ${runIssue(listed)}` }
  if (!listed.stdout.split('\n').some(line => line.trim() === 'eng')) {
    return { status: 'missing', detail: 'eng not listed by tesseract --list-langs' }
  }
  const initialized = await run(['--print-parameters', '-l', 'eng', '--oem', '1'])
  return initialized.exitCode === 0
    ? { status: 'ready' }
    : { status: 'invalid', detail: `could not initialize English language data: ${runIssue(initialized)}` }
}
