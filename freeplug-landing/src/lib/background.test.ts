import { beforeEach, describe, expect, it, vi } from 'vitest'

const after = vi.hoisted(() => ({ fns: [] as (() => Promise<void>)[], throws: false }))
vi.mock('next/server', () => ({
  after: (fn: () => Promise<void>) => {
    if (after.throws) throw new Error('`after` was called outside a request scope')
    after.fns.push(fn)
  },
}))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: () => { throw new Error('no ctx') } }))

import { scheduleAfterResponse } from './background'

describe('scheduleAfterResponse', () => {
  beforeEach(() => {
    after.fns = []
    after.throws = false
  })
  it('hands the task to after(): nothing runs until the response is done', async () => {
    const task = vi.fn(async () => {})
    scheduleAfterResponse('t', task)
    expect(task).not.toHaveBeenCalled()
    await after.fns[0]()
    expect(task).toHaveBeenCalledTimes(1)
  })
  it('swallows and logs task errors', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    scheduleAfterResponse('t', async () => {
      throw new Error('boom')
    })
    await expect(after.fns[0]()).resolves.toBeUndefined()
    expect(err).toHaveBeenCalledWith('[t] background task failed:', 'boom')
    err.mockRestore()
  })
  it('outside a request scope falls back to running it in the background', async () => {
    after.throws = true
    const task = vi.fn(async () => {})
    scheduleAfterResponse('t', task)
    await Promise.resolve()
    expect(task).toHaveBeenCalledTimes(1)
  })
})
