import { InternalError } from '~/utils/error-handler'

export function assertNever(x: never): never {
  throw InternalError(`Unreachable state reached: ${JSON.stringify(x)}`, { stage: 'validate:assert-never' })
}
