import { stripAnsi } from '~/utils/terminal-colors'

// The capture helpers live in test-utils so every suite shares one implementation.
export { captureConsole, createCapturingLogger } from '../../../../test-utils/console-capture'

export const withColorEnv = <T>(
  env: { forceColor?: string | undefined; noColor?: string | undefined },
  fn: () => T
): T => {
  const originalForceColor = process.env['FORCE_COLOR']
  const originalNoColor = process.env['NO_COLOR']

  if (env.forceColor === undefined) {
    delete process.env['FORCE_COLOR']
  } else {
    process.env['FORCE_COLOR'] = env.forceColor
  }

  if (env.noColor === undefined) {
    delete process.env['NO_COLOR']
  } else {
    process.env['NO_COLOR'] = env.noColor
  }

  try {
    return fn()
  } finally {
    if (originalForceColor === undefined) {
      delete process.env['FORCE_COLOR']
    } else {
      process.env['FORCE_COLOR'] = originalForceColor
    }

    if (originalNoColor === undefined) {
      delete process.env['NO_COLOR']
    } else {
      process.env['NO_COLOR'] = originalNoColor
    }
  }
}

export const hasAnsi = (text: string): boolean => stripAnsi(text) !== text
