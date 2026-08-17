import { defineCliCommand } from '~/cli/native/native-types'
import { writeFlags } from '~/cli/flags/write-flags'
import { handleProcessTarget } from '~/cli/commands/process-steps/step-1-download/download-targets/handle-process-target'
import { validateOcrProviderModeCommandFlags } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/command-validation'

const inputParameter = [{ key: '[input]', description: 'URL, local file, directory, or URL list (.md/.txt)' }] as const

export const writeCommand = defineCliCommand({
  name: 'write',
  description: 'Run the write pipeline for media, documents, or raw text inputs',
  parameters: inputParameter,
  flags: writeFlags,
  help: {
    examples: [
      ['bun autoshow write https://youtube.com/watch?v=abc', 'Full pipeline with the cheapest hosted LLM'],
      ['bun autoshow write video.mp4 --llm openai --prompt shortSummary longSummary', 'Summarize with OpenAI'],
      ['bun autoshow write video.mp4 --llm grok=grok-4.5 --prompt shortSummary', 'Summarize with Grok 4.5'],
      ['bun autoshow write video.mp4 --stt deepgram --llm openai --prompt shortSummary longSummary', 'Transcribe with Deepgram STT, then summarize with OpenAI'],
      ['bun autoshow write https://example.com/article --all-providers url --price', 'Estimate URL article extraction plus writing'],
      ['bun autoshow write https://x.com/i/spaces/1DXxyRYNejbKM --price', 'Estimate X Space report writing'],
      ['bun autoshow write input/examples/batch/2-urls.md --llm gemini --batch-limit all --price', 'Estimate cost for a batch'],
      ['bun autoshow write ./output/demo/text --prompt rockSong', 'Generate lyric drafts from project text into ./output/demo/lyrics'],
      ['bun autoshow write ./output/demo/text/01-track-one.md --llm openai=gpt-5.5 --prompt folkSong', 'Generate one project lyric draft with a hosted LLM']
    ]
  }
}, async (ctx) => {
  validateOcrProviderModeCommandFlags(ctx)
  await handleProcessTarget('write', ctx.parameters.input, ctx.flags, ctx.rawParsed)
})
