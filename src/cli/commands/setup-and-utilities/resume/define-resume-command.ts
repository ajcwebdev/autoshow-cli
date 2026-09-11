import { defineCliCommand } from '~/cli/native/native-types'
import { resumeFlags } from '~/cli/flags/resume-flags'
import { dispatchResume } from './resume-dispatch'

const outputDirParameter = [{
  key: '<outputDirs...>',
  description: 'Existing pipeline output directories (contain manifest.json)'
}] as const

export const resumeCommand = defineCliCommand({
  name: 'resume',
  description: 'Resume missing outputs or recorded comic stages in an existing run directory',
  parameters: outputDirParameter,
  flags: resumeFlags,
  help: {
    beforeFlags: [
      'The existing manifest determines each shared flag meaning. Comic runs restore recorded choices and reject provider, rendering, and configuration overrides.',
    ],
    notes: [
      'Comic runs restore recorded image, audio, and presentation choices. Provider, rendering, and configuration overrides are rejected.',
      'For comic --price results, inspect stage blockers and comicPlans[].ready before execution; unrequested stages stay unrequested.',
    ],
    examples: [
      ['bun autoshow resume ./output/comic-run --price', 'Inspect recorded comic recovery work and blockers without calls or writes'],
      ['bun autoshow resume ./output/comic-run', 'Continue recorded comic choices; use explicit comic commands to change them'],
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_item', 'Resume a single run directory in place'],
      ['bun autoshow resume ./output/run-a ./output/run-b ./output/run-c', 'Resume multiple output directories sequentially'],
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_batch', 'Resume a batch directory in place'],
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_batch --provider deepinfra --price', 'Estimate missing or additive resume providers without running them'],
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_batch --provider deepinfra', 'Retry or add DeepInfra STT outputs'],
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_batch --provider glm=glm-ocr', 'Retry or add GLM OCR outputs'],
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider elevenlabs=eleven_v3', 'Retry or add ElevenLabs TTS outputs'],
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider gemini=gemini-3.1-flash-lite-image', 'Retry or add Gemini image outputs'],
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider ltx=ltx-2-3-fast', 'Retry or add LTX video outputs'],
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider minimax=music-3.0', 'Retry or add MiniMax music outputs']
    ]
  }
}, async (ctx) => {
  await dispatchResume(
    ctx.parameters.outputDirs,
    ctx.flags,
    ctx.rawParsed.doubleDash,
    ctx.rawParsed.flagOccurrences
  )
})
