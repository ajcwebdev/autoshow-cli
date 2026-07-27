/**
 * Builds a filesystem-safe run identifier using the project-wide
 * `YYYY-MM-DD_HH-MM-SS-mmm` datetime convention (see createUniqueDirectoryName
 * in step-1-download/audio/metadata-utils.ts). Comic image outputs nest under a
 * folder named with this id so every generation run is preserved separately
 * while the scene workspace (scene.json, panel-prompts) stays stable.
 */
export const createComicRunId = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0')
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}-${milliseconds}`
}
