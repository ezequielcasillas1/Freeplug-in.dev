import 'server-only'

/** Next.js entry for the notify wiring (server only). The Durable Object imports server-core directly. */
export { notifyDeps, isRealSendEnabled, adminNotifyEmail } from './server-core'
