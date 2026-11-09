import base from './vitest.config'
import { mergeConfig } from 'vitest/config'
export default mergeConfig(base, { cacheDir: '/workspace/freeplug-qa/picker-notify-r1/tmp-vitecache' })
