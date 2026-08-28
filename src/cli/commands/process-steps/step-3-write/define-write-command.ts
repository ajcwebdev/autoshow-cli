import { defineCliCommand } from '~/cli/native/native-types'
import { writeFlags } from '~/cli/flags/write-flags'
import { runWriteCommand } from './run-write-command'

const inputParameter = [{ key: '[input]', description: 'Local .md or .txt file, or a directory of those files' }] as const

export const writeCommand = defineCliCommand({
  name: 'write',
  description: 'Generate structured LLM text from local markdown or plaintext',
  parameters: inputParameter,
  flags: writeFlags,
  help: {
    examples: [
      ['bun autoshow write notes.md --llm openai --prompt shortSummary', 'Summarize a local markdown file with OpenAI'],
      ['bun autoshow write output/<extract-run>/transcription.txt --llm grok=grok-4.5 --prompt shortSummary', 'Write from an extract transcript'],
      ['bun autoshow write chapter.txt --llm openai --prompt shortSummary longSummary --rendered-text', 'Generate multiple summaries and save rendered markdown'],
      ['bun autoshow write ./output/demo/text --prompt rockSong', 'Generate lyric drafts from project text into ./output/demo/lyrics'],
      ['bun autoshow write ./output/demo/text/01-track-one.md --llm openai=gpt-5.5 --prompt folkSong', 'Generate one project lyric draft with a hosted LLM'],
      ['bun autoshow write notes.md --price', 'Estimate LLM cost for a text file']
    ],
    notes: [
      'write accepts only local .md or .txt files. Transcribe URLs, media, documents, or X Spaces with extract first.'
    ]
  }
}, async (ctx) => {
  await runWriteCommand(ctx.parameters.input, ctx.flags, ctx.rawParsed.explicitFlags, ctx.rawParsed.flagOccurrences)
})
