import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { replicateVideo } from './cases'

defineVideoServiceTest({
  ...replicateVideo,
  models: [{ model: 'runwayml/aleph-2', extraArgs: ['--mode', 'edit', '--input-video', 'https://replicate.delivery/pbxt/PDBtfgR3ypced4Ijj1dBALbo0iIaR8jb3K2eQaiKMA1cOxrL/tmp3k1o50w7.mp4'] }],
  videoService: 'replicate'
})
