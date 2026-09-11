import type { CaptionCue } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { formatCaptionTimestamp, formatSrt, formatVtt } from '../../../audio/music/lyrics-video/captions'

export const CAPTION_FORMATS = ['srt', 'vtt', 'ass', 'ttml', 'lrc'] as const
export type CaptionOutputFormat = typeof CAPTION_FORMATS[number]

export const resolveCaptionFormats = (value: unknown): CaptionOutputFormat[] => {
  if (value === undefined || value === 'both') return ['srt', 'vtt']
  if (value === 'all') return [...CAPTION_FORMATS]
  if (CAPTION_FORMATS.includes(value as CaptionOutputFormat)) return [value as CaptionOutputFormat]
  throw UsageError('--caption-format must be srt, vtt, both, ass, ttml, lrc, or all.')
}

const xml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const assTime = (seconds: number): string => {
  const centiseconds = Math.round(seconds * 100)
  return `${Math.floor(centiseconds / 360000)}:${String(Math.floor(centiseconds / 6000) % 60).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`
}

export const formatEditorCaptions = (format: CaptionOutputFormat, cues: CaptionCue[]): string => {
  if (format === 'srt' || format === 'vtt') {
    const escaped = cues.map(cue => ({ ...cue, text: cue.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }))
    return format === 'srt' ? formatSrt(escaped) : formatVtt(escaped)
  }
  if (format === 'ttml') return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<tt xmlns="http://www.w3.org/ns/ttml" xml:lang="und"><body><div>\n'
    + cues.map(cue => `  <p begin="${formatCaptionTimestamp(cue.start, '.')}" end="${formatCaptionTimestamp(cue.end, '.')}">${xml(cue.text).replace(/\n/g, '<br/>')}</p>`).join('\n')
    + '\n</div></body></tt>\n'
  if (format === 'lrc') return cues.map(cue => {
    const centiseconds = Math.round(cue.start * 100)
    return `[${String(Math.floor(centiseconds / 6000)).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}]${cue.text.replace(/\n/g, ' ')}`
  }).join('\n') + '\n'
  const escapeAss = (text: string): string => {
    if (/[{}]|\\[Nnh]/.test(text)) throw UsageError('ASS cannot safely preserve literal braces or ASS escape sequences in transcript text. Export SRT, VTT, or TTML for this transcript.')
    return text.replace(/\r?\n/g, '\\N')
  }
  return '[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 0\n\n'
    + '[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n'
    + 'Style: Default,Arial,48,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,2,40,40,40,1\n\n'
    + '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
    + cues.map(cue => `Dialogue: 0,${assTime(cue.start)},${assTime(Math.max(cue.end, cue.start + .01))},Default,,0,0,0,,${escapeAss(cue.text)}`).join('\n') + '\n'
}
