import { ValidationError } from '~/utils/error-handler'

export type OptionsAssertion<TOptions extends object, TNarrowed extends TOptions> = (
  options: TOptions
) => asserts options is TNarrowed

export const createOptionsAssertion = <TOptions extends object, TNarrowed extends TOptions>(
  message: string,
  requiredKeys: readonly (keyof TNarrowed)[]
): OptionsAssertion<TOptions, TNarrowed> => (
  options: TOptions
): asserts options is TNarrowed => {
  if (requiredKeys.some(key => !(key in options))) {
    throw ValidationError(message)
  }
}
