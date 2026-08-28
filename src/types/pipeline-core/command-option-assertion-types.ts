export type OptionsAssertion<TOptions extends object, TNarrowed extends TOptions> = (
  options: TOptions
) => asserts options is TNarrowed
