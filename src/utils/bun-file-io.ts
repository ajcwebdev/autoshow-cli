import { writeFile as writeFileWithMode } from 'node:fs/promises'

export type ExactFileWriteData = Bun.BlobOrStringOrBuffer

export type ExactFileWriteOptions = {
  mode?: number
}

/** Read a UTF-8 text file without implicitly creating or normalizing its path. */
export const readTextFile = async (path: string): Promise<string> =>
  await Bun.file(path).text()

/** Read exact file bytes while preserving the Buffer contract used by existing callers. */
export const readFileBytes = async (path: string): Promise<Buffer> =>
  Buffer.from(await Bun.file(path).bytes())

/**
 * Replace one file's contents without creating missing parent directories. The byte-count return
 * from Bun.write is deliberately normalized away so this matches the existing Promise<void> flow.
 */
export const writeFileExact = async (
  path: string,
  data: ExactFileWriteData,
  options: ExactFileWriteOptions = {}
): Promise<void> => {
  if (options.mode === undefined) {
    await Bun.write(path, data, { createPath: false })
    return
  }

  // Bun 1.3.14 does not reliably apply `mode` on macOS. Keep the protected-write contract
  // behind this adapter by using the compatibility call only for the explicit-mode branch.
  const compatibleData = data instanceof Blob
    ? Buffer.from(await data.arrayBuffer())
    : typeof data === 'string' || ArrayBuffer.isView(data)
      ? data
      : Buffer.from(data)
  await writeFileWithMode(path, compatibleData, { mode: options.mode })
}

/** Copy regular file contents without creating a missing destination parent directory. */
export const copyFileExact = async (source: string, destination: string): Promise<void> => {
  await Bun.write(destination, Bun.file(source), { createPath: false })
}

/** Follow symlinks and return the same Stats shape as fs.promises.stat. */
export const statPath = async (path: string) =>
  await Bun.file(path).stat()

/** Remove exactly one file or symlink; directory removal remains on node:fs compatibility. */
export const unlinkPath = async (path: string): Promise<void> => {
  await Bun.file(path).delete()
}
