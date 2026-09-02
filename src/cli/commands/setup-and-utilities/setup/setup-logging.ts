import type { SetupToolStatus } from '~/types'
import * as l from '~/utils/app-logger/app-logger'

export const logSetupToolStatus = (summary: SetupToolStatus): void => {
  l.write('info', `Setup ${summary.tool}: ${summary.status}${summary.detail ? `, ${summary.detail}` : ''}`, {
    category: 'runtime',
    metadata: summary
  })
}
