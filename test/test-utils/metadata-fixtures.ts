export const createMetadataFixtureBuilder = <T>(defaults: T) => (
  overrides: Partial<T> = {}
): T => ({ ...defaults, ...overrides })
