export const childLifecycleEnterLine = (label: string): string =>
  `console.log('${label}:enter:' + Date.now())`

export const childLifecycleExitLine = (label: string): string =>
  `console.log('${label}:exit:' + Date.now())`

export const readChildLifecycleTimestamp = (
  stdout: string,
  label: string,
  phase: 'enter' | 'exit'
): number => {
  const prefix = `${label}:${phase}:`
  const line = stdout.trim().split('\n').find((entry) => entry.startsWith(prefix))
  return Number(line?.split(':')[2] ?? '0')
}
