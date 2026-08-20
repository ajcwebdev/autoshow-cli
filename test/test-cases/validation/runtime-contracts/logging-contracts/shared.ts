import { stripAnsi } from '~/utils/terminal-colors'
import { withEnvSync } from '../../../../test-utils/rest-contract-helpers'

// The capture helpers live in test-utils so every suite shares one implementation.
export { captureConsole, createCapturingLogger } from '../../../../test-utils/console-capture'

export const withColorEnv = <T>(
  env: { forceColor?: string | undefined; noColor?: string | undefined },
  fn: () => T
): T => withEnvSync({ FORCE_COLOR: env.forceColor, NO_COLOR: env.noColor }, fn)

export const hasAnsi = (text: string): boolean => stripAnsi(text) !== text
