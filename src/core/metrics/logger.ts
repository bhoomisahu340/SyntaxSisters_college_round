import { bus } from '../bus.ts'
import type {
  BenchmarkMode,
  BenchmarkSummary,
  BenchmarkTask,
} from '../events.ts'

let attached = false

export function attachBenchmarkLogger(): () => void {
  if (attached) return () => {}
  attached = true

  const runs: BenchmarkSummary[] = []
  let mode: BenchmarkMode | null = null
  let startedAt = 0
  let matched = 0
  let total = 0
  let selectionErrors = 0
  let preventedByShield = 0
  const tasks = new Set<BenchmarkTask>()

  const publish = () => {
    bus.emit('BENCHMARK_UPDATED', {
      runs: [...runs],
      activeMode: mode,
      completedTasks: [...tasks],
    })
  }

  const offStart = bus.on('BENCHMARK_STARTED', ({ mode: nextMode }) => {
    mode = nextMode
    startedAt = Date.now()
    matched = 0
    total = 0
    selectionErrors = 0
    preventedByShield = 0
    tasks.clear()
    publish()
  })
  const offStatusRequest = bus.on('BENCHMARK_STATUS_REQUESTED', publish)
  const offCommand = bus.on('VOICE_COMMAND_MATCHED', ({ matched: isMatched }) => {
    if (mode !== 'drishva') return
    total += 1
    if (isMatched) matched += 1
    else selectionErrors += 1
    publish()
  })
  const offBlocked = bus.on('ACTION_BLOCKED', ({ reason }) => {
    if (mode !== 'drishva') return
    if (reason === 'paused') return
    if (/confirm|risky|not-locked|no-target-locked/.test(reason)) preventedByShield += 1
    else selectionErrors += 1
    publish()
  })
  const offTask = bus.on('BENCHMARK_TASK_SIGNAL', ({ task }) => {
    if (!mode) return
    tasks.add(task)
    publish()
    if (task !== 'complete-booking') return

    const summary: BenchmarkSummary = {
      id: `${mode}-${startedAt}`,
      mode,
      completionTimeMs: Math.max(0, Date.now() - startedAt),
      commandAccuracy: mode === 'drishva' && total ? matched / total : null,
      commandsMatched: matched,
      commandsTotal: total,
      selectionErrors,
      preventedByShield,
      completedAt: Date.now(),
    }
    runs.push(summary)
    mode = null
    publish()
  })

  publish()
  return () => {
    offStart()
    offStatusRequest()
    offCommand()
    offBlocked()
    offTask()
    attached = false
  }
}
