import { colorizeHelpDescription } from '~/cli/help-colors'
import { LOG_LEVELS, RUNTIME_TOOL_IDS } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { boolFlag, formatValueList, strFlag } from '~/cli/flags/flag-utils'

const BIN_DIR_TOOL_NAMES = [...RUNTIME_TOOL_IDS, 'defuddle'] as const

export const GLOBAL_FLAG_DEFINITIONS = {
  help: {
    description: colorizeHelpDescription('Show help'),
    short: 'h',
    type: Boolean,
    default: false,
    negatable: false
  },
  version: {
    description: colorizeHelpDescription('Print current version'),
    short: 'v',
    type: Boolean,
    default: false,
    negatable: false
  },
  'config-path': strFlag(colorizeHelpDescription('Path to config file (default: config/autoshow.json in project root)')),
  'output-root': strFlag(colorizeHelpDescription('Base output directory under which per-step subdirectories are created (default: ./output)')),
  'output-dir': strFlag(colorizeHelpDescription('Pin the run directory instead of a timestamped output/<timestamp>_<slug> dir')),
  'characters-root': strFlag(colorizeHelpDescription('Directory of comic character reference images and characters-reference.json (default: input/characters)')),
  'bin-dir': strFlag(colorizeHelpDescription(`Directory of external tool binaries (${BIN_DIR_TOOL_NAMES.join(', ')}) to use before the managed install and PATH`)),
  'allow-over-budget': boolFlag(colorizeHelpDescription('Continue even if cost estimate exceeds the configured budget limit')),
  verbose: boolFlag(colorizeHelpDescription('Enable debug-level logging')),
  quiet: {
    description: colorizeHelpDescription('Suppress non-error diagnostics; JSON terminal results are always emitted'),
    short: 'q',
    type: Boolean,
    default: false,
    negatable: false
  },
  json: boolFlag(colorizeHelpDescription('Emit versioned diagnostic records on stderr and one terminal result on stdout')),
  'log-level': strFlag(colorizeHelpDescription(`Minimum log level: ${formatValueList(LOG_LEVELS)} (default: info)`)),
  color: {
    description: colorizeHelpDescription('Force ANSI colors on, or use --no-color to disable (overrides FORCE_COLOR/NO_COLOR; default: auto-detect TTY)'),
    type: Boolean,
    negatable: true
  }
} as const satisfies CliFlagsDefinition
