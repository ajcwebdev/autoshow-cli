import { CLI_INVOCATION } from '~/cli/cli-invocation'
import { defineCliCommand } from '~/cli/native/native-types'
import { COMIC_SUBCOMMAND_DEFINITIONS, generateAudioCommandDefinition } from './comic-utils/subcommand-help'

export const comicCommand = defineCliCommand({
  name: 'comic',
  description: 'Generate comic scenes, panels, character audio, and synchronized local slideshows from project-defined assets',
  subcommands: COMIC_SUBCOMMAND_DEFINITIONS,
  help: {
    examples: [
      ['bun autoshow comic draft-treatment input/camp.md --episode 02 --speaker papa-bear', 'Draft a fixed-count episode script and catalog entries from a prose treatment'],
      ['bun autoshow comic draft-scenes 05-01', 'Prepare the script locally, draft the scene JSON, and build panel prompts'],
      ['bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only panel-prompts', 'Build panel prompt bundles'],
      ['bun autoshow comic generate-images 05-01 --panels-per-image 6', 'Generate page images'],
      generateAudioCommandDefinition.help!.examples![0]!,
      ['bun autoshow comic generate-slideshow 05-01', 'Render a synchronized still-panel MP4 locally'],
      ['bun autoshow comic reference-sketch --character hero', 'Generate a character reference sheet'],
      ['bun autoshow comic reference-sketch --location cargo-bay', 'Generate a canonical location reference'],
      ['bun autoshow comic review 05-01 --export-doc', 'Build the local review sheet and document export'],
      ['bun autoshow comic review 05-01 --run <image-run-id> --use --panels 3', 'Select panel 3 from a later image run'],
      ['bun autoshow voice list', 'Manage character voices with the shared voice command'],
      ['bun autoshow comic generate-images --help', 'Show the flags for one subcommand']
    ],
    notes: [
      `Each subcommand has its own flags: ${CLI_INVOCATION} comic <subcommand> --help`,
      'Use voice for character voice registrations. The deprecated reference-voice alias remains callable for one compatibility release; use its --help for the replacement.',
      'The first valid generated individual panel becomes the slideshow selection automatically; comic review --run <id> --use replaces it explicitly.',
      'Comic artifacts are read from input and written under output.'
    ]
  }
}, () => {})
