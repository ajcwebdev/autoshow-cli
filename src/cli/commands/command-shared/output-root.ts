import { isAbsolute, join, resolve } from 'node:path'

const DEFAULT_OUTPUT_ROOT = './output'

let outputRoot = DEFAULT_OUTPUT_ROOT

export const configureOutputRoot = (dir: string): void => {
  const trimmed = dir.trim()
  if (trimmed.length > 0) {
    outputRoot = trimmed
  }
}

export const getOutputRoot = (): string => outputRoot

export const getOutputRootAbsolute = (projectRoot = process.cwd()): string => {
  const outputRoot = getOutputRoot()
  return isAbsolute(outputRoot) ? outputRoot : resolve(projectRoot, outputRoot)
}

export const joinOutputRoot = (...segments: string[]): string =>
  join(getOutputRoot(), ...segments)
