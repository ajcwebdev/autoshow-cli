import { writeFile as writeFileWithMode } from 'node:fs/promises'

export type ExactFileWriteData = Bun.BlobOrStringOrBuffer

export type ExactFileWriteOptions = {
  mode?: number
}

export const readTextFile = async (path: string): Promise<string> =>
  await Bun.file(path).text()

export const readFileBytes = async (path: string): Promise<Buffer> =>
  Buffer.from(await Bun.file(path).bytes())

export const writeFileExact = async (
  path: string,
  data: ExactFileWriteData,
  options: ExactFileWriteOptions = {}
): Promise<void> => {
  if (options.mode === undefined) {
    await Bun.write(path, data, { createPath: false })
    return
  }

  const compatibleData = data instanceof Blob
    ? Buffer.from(await data.arrayBuffer())
    : typeof data === 'string' || ArrayBuffer.isView(data)
      ? data
      : Buffer.from(data)
  await writeFileWithMode(path, compatibleData, { mode: options.mode })
}

export const copyFileExact = async (source: string, destination: string): Promise<void> => {
  await Bun.write(destination, Bun.file(source), { createPath: false })
}

export const statPath = async (path: string) =>
  await Bun.file(path).stat()

export const unlinkPath = async (path: string): Promise<void> => {
  await Bun.file(path).delete()
}
