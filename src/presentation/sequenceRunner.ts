export interface PresentationBeatStep<TPhase extends string> {
  phase: TPhase
  duration: number
  onStart?: () => void
}

export interface PresentationTimelineStep<TPhase extends string> {
  phase: TPhase
  index: number
  startMs: number
  endMs: number
}

export function buildPresentationTimeline<TPhase extends string>(
  steps: Array<PresentationBeatStep<TPhase>>,
): Array<PresentationTimelineStep<TPhase>> {
  let elapsed = 0
  return steps.map((step, index) => {
    const startMs = elapsed
    elapsed += step.duration
    return {
      phase: step.phase,
      index,
      startMs,
      endMs: elapsed,
    }
  })
}

export function getPresentationDuration<TPhase extends string>(
  steps: Array<PresentationBeatStep<TPhase>>,
): number {
  return steps.reduce((sum, step) => sum + step.duration, 0)
}

export function schedulePresentationSequence<TPhase extends string>({
  steps,
  setPhase,
  setTimeoutFn = window.setTimeout,
  collectTimer,
}: {
  steps: Array<PresentationBeatStep<TPhase>>
  setPhase: (phase: TPhase) => void
  setTimeoutFn?: (handler: () => void, timeout: number) => number
  collectTimer?: (timerId: number) => void
}): number {
  for (const timelineStep of buildPresentationTimeline(steps)) {
    const step = steps[timelineStep.index]
    const timerId = setTimeoutFn(() => {
      setPhase(timelineStep.phase)
      step?.onStart?.()
    }, timelineStep.startMs)
    collectTimer?.(timerId)
  }
  return getPresentationDuration(steps)
}
