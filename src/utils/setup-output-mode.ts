let compactSetupMode = false

export const setCompactSetupMode = (enabled: boolean): void => {
  compactSetupMode = enabled
}

export const isCompactSetupMode = (): boolean => compactSetupMode
