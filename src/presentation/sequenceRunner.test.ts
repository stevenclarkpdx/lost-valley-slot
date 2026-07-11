import { describe, expect, it } from 'vitest'
import { buildPresentationTimeline, schedulePresentationSequence } from './sequenceRunner'

describe('presentation sequence runner', () => {
  it('builds ordered beats with cumulative timing', () => {
    expect(
      buildPresentationTimeline([
        { phase: 'spin-started', duration: 80 },
        { phase: 'reels-spinning', duration: 420 },
        { phase: 'credit-award', duration: 220 },
      ]),
    ).toEqual([
      { phase: 'spin-started', index: 0, startMs: 0, endMs: 80 },
      { phase: 'reels-spinning', index: 1, startMs: 80, endMs: 500 },
      { phase: 'credit-award', index: 2, startMs: 500, endMs: 720 },
    ])
  })

  it('schedules every beat and returns the total input-lock duration', () => {
    const scheduled: Array<{ phase: string; timeout: number }> = []
    const duration = schedulePresentationSequence({
      steps: [
        { phase: 'cluster-resolution', duration: 100 },
        { phase: 'credit-award', duration: 200 },
      ],
      setPhase: (phase) => scheduled.push({ phase, timeout: -1 }),
      setTimeoutFn: (handler, timeout) => {
        scheduled.push({ phase: 'timer', timeout })
        handler()
        return timeout
      },
    })

    expect(duration).toBe(300)
    expect(scheduled).toEqual([
      { phase: 'timer', timeout: 0 },
      { phase: 'cluster-resolution', timeout: -1 },
      { phase: 'timer', timeout: 100 },
      { phase: 'credit-award', timeout: -1 },
    ])
  })
})
