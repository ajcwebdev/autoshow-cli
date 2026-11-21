import { basename } from 'node:path'
import { ValidationError } from '~/utils/error-handler'
import { normalizeLineEndings } from './markdown-blocks'

export const RETIRED_STAGING_LABELS = ['BLOCKING', 'CAMERA', 'BREAK-180', 'COSTUME', 'EXTRAS', 'SKIP-PANELS'] as const

// Matches both authored forms of the retired directives: `**CAMERA:** text` / `**CAMERA: text**` on one line,
// and a bare `**CAMERA:**` label whose prose follows in a separate block.
const RETIRED_LABEL_LINE = new RegExp(`^\\*\\*\\s*(${RETIRED_STAGING_LABELS.join('|')})\\s*:`, 'iu')

type RetiredStagingLabelOccurrence = { label: string; line: number; text: string }

export const findRetiredStagingLabels = (content: string): RetiredStagingLabelOccurrence[] => {
  const lines = normalizeLineEndings(content).split('\n')
  const titleIndex = lines.findIndex(line => line.trim().startsWith('# '))
  const sceneHeadingIndex = lines.findIndex((line, index) => index > titleIndex && line.trim().startsWith('## '))
  const occurrences: RetiredStagingLabelOccurrence[] = []
  for (let index = sceneHeadingIndex < 0 ? 0 : sceneHeadingIndex + 1; index < lines.length; index += 1) {
    const text = lines[index]!.trim()
    const match = RETIRED_LABEL_LINE.exec(text)
    if (match?.[1]) occurrences.push({ label: match[1].toUpperCase(), line: index + 1, text })
  }
  return occurrences
}

/**
 * Staging directives belonged to the retired blocking workflow. Left in a script, an unrecognized directive after an
 * active speaker would be parsed as dialogue, so a script that still carries one fails before any structure is published.
 */
export const assertNoRetiredStagingLabels = (content: string, scriptPath: string): void => {
  const occurrences = findRetiredStagingLabels(content)
  if (occurrences.length === 0) return
  const file = basename(scriptPath)
  const listed = occurrences.map(occurrence => `- ${file}:${occurrence.line} **${occurrence.label}:** ${JSON.stringify(occurrence.text)}`).join('\n')
  throw ValidationError(
    `Script "${file}" uses retired staging directive${occurrences.length === 1 ? '' : 's'} (${RETIRED_STAGING_LABELS.join(', ')}), which are no longer read:\n${listed}\n` +
    'Rewrite each one as ordinary script prose or a bracketed [panel note] in the same position, keeping speech and source order, or delete it; then rerun draft-scenes --only prepare.',
    { stage: 'comic:script-parse' }
  )
}
