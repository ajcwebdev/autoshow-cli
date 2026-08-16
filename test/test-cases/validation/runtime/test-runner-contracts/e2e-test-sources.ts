export type E2eTestSource = {
  file: string
  source: string
}

let cachedE2eTestSources: Promise<E2eTestSource[]> | undefined

export const loadE2eTestSources = (): Promise<E2eTestSource[]> => {
  cachedE2eTestSources ??= (async () => {
    const glob = new Bun.Glob('test/test-cases/e2e/**/*.test.ts')
    const files = (await Array.fromAsync(glob.scan({ dot: false }))).sort()
    return Promise.all(files.map(async (file) => ({
      file,
      source: await Bun.file(file).text(),
    })))
  })()
  return cachedE2eTestSources
}
