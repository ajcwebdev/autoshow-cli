import type { NativeCliUsageErrorCode } from '~/types'
import { AppUsageError } from '~/utils/error-handler'

class NativeCliUsageError extends AppUsageError {
  readonly code: NativeCliUsageErrorCode

  constructor(code: NativeCliUsageErrorCode, message: string, usageMessage?: string, hints?: string[]) {
    super(message, {
      ...(usageMessage !== undefined ? { usageMessage } : {}),
      ...(hints !== undefined ? { hints } : {})
    })
    this.name = 'NativeCliUsageError'
    this.code = code
  }
}

export class NativeNoSuchCommandError extends NativeCliUsageError {
  readonly commandName: string

  constructor(commandName: string) {
    const removedLogFormat = commandName === '--log-format' || commandName.startsWith('--log-format=')
    super(
      'no-such-command',
      removedLogFormat ? `Unexpected flag: ${commandName}` : `Unknown command "${commandName}"`,
      removedLogFormat ? undefined : `Unknown command "${commandName}". Run: bun autoshow help`,
      removedLogFormat ? ['Use default text output or pass --json for the versioned machine protocol.'] : undefined
    )
    this.name = 'NativeNoSuchCommandError'
    this.commandName = commandName
  }
}

export class NativeInvalidParametersError extends NativeCliUsageError {
  constructor(message: string) {
    super('invalid-parameters', message, `${message}. Run: bun autoshow help <command>`)
    this.name = 'NativeInvalidParametersError'
  }
}

export class NativeUnknownFlagError extends NativeCliUsageError {
  readonly flagNames: string[]
  readonly flagSpellings: string[]

  constructor(flagSpellings: string[]) {
    const removedLogFormat = flagSpellings.some((flag) => flag === '--log-format' || flag.startsWith('--log-format='))
    super(
      'unknown-flag',
      flagSpellings.length === 1
        ? `Unexpected flag: ${flagSpellings[0]}`
        : `Unexpected flags: ${flagSpellings.join(', ')}`,
      undefined,
      removedLogFormat
        ? ['Use default text output or pass --json for the versioned machine protocol.']
        : undefined
    )
    this.name = 'NativeUnknownFlagError'
    this.flagNames = flagSpellings
    this.flagSpellings = flagSpellings
  }
}

export class NativeMissingFlagValueError extends NativeCliUsageError {
  readonly flagName: string

  constructor(flagName: string) {
    super(
      'missing-required-value',
      `Missing value for --${flagName}`,
      `Missing value for --${flagName}. Run: bun autoshow help <command>`
    )
    this.name = 'NativeMissingFlagValueError'
    this.flagName = flagName
  }
}
