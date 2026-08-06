import { defineCliCommand } from '~/cli/native/native-types'
import { resumeFlags } from '~/cli/flags/resume-flags'
import { dispatchResume } from './resume-dispatch'

const outputDirParameter = [{
  key: '<outputDirs...>',
  description: 'Existing run or batch output directories (contain run.json or batch.json)'
}] as const

export const resumeCommand = defineCliCommand({
  name: 'resume',
  description: 'Resume missing provider outputs in an existing run or batch directory',
  parameters: outputDirParameter,
  flags: resumeFlags,
  help: {
    examples: [
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_item', 'Resume a single run directory in place'],
      ['bun autoshow resume ./output/run-a ./output/run-b ./output/run-c', 'Resume multiple output directories sequentially'],
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_batch', 'Resume a batch directory in place'],
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_batch --provider deepinfra --price', 'Estimate missing or additive resume providers without running them'],
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_batch --provider deepinfra', 'Retry or add DeepInfra STT outputs'],
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_batch --provider glm=glm-ocr', 'Retry or add GLM OCR outputs'],
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider elevenlabs=eleven_v3', 'Retry or add ElevenLabs TTS outputs'],
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider gemini=gemini-3.1-flash-lite-image', 'Retry or add Gemini image outputs'],
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider runway=gen4.5', 'Retry or add Runway video outputs'],
      ['bun autoshow resume ./output/2026-04-22_12-00-00-000_run --provider minimax=music-2.6', 'Retry or add MiniMax music outputs']
    ]
  }
}, async (ctx) => {
  await dispatchResume(
    ctx.parameters.outputDirs,
    ctx.flags,
    ctx.rawParsed.doubleDash,
    ctx.argv,
    ctx.rawParsed.positionals.map((entry) => entry.index)
  )
})
