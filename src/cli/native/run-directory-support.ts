// Commands that only read, resume, or configure existing directories. Accepting --output-dir there
// would silently do nothing, so it is rejected instead.
const COMMANDS_WITHOUT_RUN_DIRECTORIES = new Set([
  'config',
  'setup',
  'links',
  'resume',
  'voice',
  'comic reference-voice'
])

export const commandCreatesRunDirectory = (commandName: string): boolean =>
  !COMMANDS_WITHOUT_RUN_DIRECTORIES.has(commandName)
  && !COMMANDS_WITHOUT_RUN_DIRECTORIES.has(commandName.split(' ')[0]!)
