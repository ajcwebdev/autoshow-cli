export const createMediaTargetCollector = <
  TOptions,
  TRawModel,
  TModel extends string,
  const TService extends string,
  TRunArgs extends unknown[],
  TResult,
  TTargetFields extends object = Record<never, never>
>(descriptor: {
  service: TService
  readModels: (options: TOptions) => readonly TRawModel[]
  validateModel: (rawModel: TRawModel) => TModel
  targetFields?: ((options: TOptions, model: TModel) => TTargetFields) | undefined
  ensureSetup?: (() => Promise<void> | void) | undefined
  run: (options: TOptions, model: TModel, fields: TTargetFields, ...args: TRunArgs) => Promise<TResult>
}): ((options: TOptions) => Array<TTargetFields & {
  service: TService
  model: TModel
  run: (...args: TRunArgs) => Promise<TResult>
}>) => (options: TOptions) => descriptor.readModels(options).map((rawModel) => {
  const model = descriptor.validateModel(rawModel)
  const fields = descriptor.targetFields?.(options, model) ?? {} as TTargetFields
  return {
    ...fields,
    service: descriptor.service,
    model,
    run: async (...args: TRunArgs): Promise<TResult> => {
      await descriptor.ensureSetup?.()
      return await descriptor.run(options, model, fields, ...args)
    }
  }
})
