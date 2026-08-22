const COMMANDS_WITHOUT_RUN_DIRECTORIES = new Set([
  'config',
  'setup',
  'resume',
  'voice',
  'comic reference-voice'
])

export const commandCreatesRunDirectory = (commandName: string): boolean => {
  const parts = commandName.split(' ')
  return !COMMANDS_WITHOUT_RUN_DIRECTORIES.has(commandName)
    && !COMMANDS_WITHOUT_RUN_DIRECTORIES.has(parts[0]!)
    && !COMMANDS_WITHOUT_RUN_DIRECTORIES.has(parts.slice(0, 2).join(' '))
}
