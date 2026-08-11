import { defineCliCommand } from '~/cli/native/native-types'
import { COMIC_SUBCOMMAND_DEFINITIONS } from './comic-utils/subcommand-help'

export const comicCommand = defineCliCommand({
  name: 'comic',
  description: 'Generate comic scenes, sketches, and panel images from project-defined characters and locations',
  subcommands: COMIC_SUBCOMMAND_DEFINITIONS,
  help: {
    examples: [
      ['bun autoshow comic draft-scenes 05-01', 'Draft structured scene JSON'],
      ['bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only panel-prompts', 'Build panel prompt bundles'],
      ['bun autoshow comic generate-images 05-01 --panels-per-image 6', 'Generate page images'],
      ['bun autoshow comic generate-audio 05-01 --provider gemini', 'Render approved character voices'],
      ['bun autoshow comic reference-sketch --character hero', 'Generate a character reference sheet'],
      ['bun autoshow comic reference-sketch --location cargo-bay', 'Generate a canonical location reference'],
      ['bun autoshow comic generate-images --help', 'Show the flags for one subcommand']
    ],
    notes: [
      'Each subcommand has its own flags: bun autoshow comic <subcommand> --help',
      'Comic artifacts are read from input and written under output.'
    ]
  }
}, () => {})
