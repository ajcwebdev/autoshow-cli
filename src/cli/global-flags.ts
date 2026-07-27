import { colorizeHelpDescription } from '~/cli/help-colors'
import { LOG_LEVELS, RUNTIME_TOOL_IDS } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { LOG_FORMAT_CHOICES } from '~/utils/app-logger/app-logger'
import { formatValueList } from '~/cli/flags/flag-utils'

// defuddle is resolved from --bin-dir by its own resolver rather than the runtime tool
// registry, so it is listed alongside the registry ids.
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
  'config-path': {
    description: colorizeHelpDescription('Path to config file (default: config/autoshow.json in project root)'),
    type: String
  },
  'output-root': {
    description: colorizeHelpDescription('Base output directory under which per-step subdirectories are created (default: ./output)'),
    type: String
  },
  'output-dir': {
    description: colorizeHelpDescription('Pin the run directory instead of a timestamped output/<timestamp>_<slug> dir'),
    type: String
  },
  'characters-root': {
    description: colorizeHelpDescription('Directory of comic character reference images and characters-reference.json (default: input/characters)'),
    type: String
  },
  'bin-dir': {
    description: colorizeHelpDescription(`Directory of external tool binaries (${BIN_DIR_TOOL_NAMES.join(', ')}) to use before the managed install and PATH`),
    type: String
  },
  'allow-over-budget': {
    description: colorizeHelpDescription('Continue even if cost estimate exceeds the configured budget limit'),
    type: Boolean,
    default: false,
    negatable: false
  },
  verbose: {
    description: colorizeHelpDescription('Enable debug-level logging'),
    type: Boolean,
    default: false,
    negatable: false
  },
  quiet: {
    description: colorizeHelpDescription('Suppress all output except errors'),
    short: 'q',
    type: Boolean,
    default: false,
    negatable: false
  },
  json: {
    description: colorizeHelpDescription('Output logs as JSON (shortcut for --log-format json)'),
    type: Boolean,
    default: false,
    negatable: false
  },
  'log-level': {
    description: colorizeHelpDescription(`Minimum log level: ${formatValueList(LOG_LEVELS)} (default: info)`),
    type: String
  },
  'log-format': {
    description: colorizeHelpDescription(`Log output format: ${formatValueList(LOG_FORMAT_CHOICES)} (default: human)`),
    type: String
  },
  color: {
    description: colorizeHelpDescription('Force ANSI colors on, or use --no-color to disable (overrides FORCE_COLOR/NO_COLOR; default: auto-detect TTY)'),
    type: Boolean,
    negatable: true
  },
  cookies: {
    description: colorizeHelpDescription('Path to cookies.txt file for authenticated downloads'),
    type: String
  },
  'cookies-from-browser': {
    description: colorizeHelpDescription('Import cookies from browser for authenticated downloads: chrome|firefox|opera|edge|chromium|brave|vivaldi|safari (passed to yt-dlp --cookies-from-browser)'),
    type: String
  },
  'model-path': {
    description: colorizeHelpDescription('Path to a local GGUF model file for llama.cpp inference (overrides the default downloaded model)'),
    type: String
  }
} as const satisfies CliFlagsDefinition
