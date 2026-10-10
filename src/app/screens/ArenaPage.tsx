import { useEffect, useState } from 'react'
import { bus } from '../../core/bus.ts'
import type { BenchmarkMode, BenchmarkTask } from '../../core/events.ts'

const tasks: ReadonlyArray<{ id: BenchmarkTask; title: string; path: string }> = [
  { id: 'search-service', title: 'Search an appointment type', path: '#/booking' },
  { id: 'select-slot', title: 'Choose an appointment time', path: '#/booking' },
  { id: 'complete-booking', title: 'Complete a demo booking', path: '#/booking' },
]

export function ArenaPage() {
  const [mode, setMode] = useState<BenchmarkMode | null>(null)
  const [completed, setCompleted] = useState<BenchmarkTask[]>([])

  useEffect(() => {
    const offUpdate = bus.on('BENCHMARK_UPDATED', (update) => {
      setMode(update.activeMode)
      setCompleted(update.completedTasks)
    })
    bus.emit('BENCHMARK_STATUS_REQUESTED')
    return () => offUpdate()
  }, [])

  return (
    <main className="min-h-[70vh] px-[8%] py-12 max-sm:px-5">
      <span className="section-label">TASK COMPARISON</span>
      <h1 className="font-[Manrope,sans-serif] text-4xl font-extrabold text-[#17324f]">Browsing benchmark</h1>
      <p className="mt-3 max-w-2xl text-[#718096]">Preliminary prototype measurements. Run the same appointment tasks with mouse/keyboard and Drishva controls.</p>
      <div className="mt-7 flex flex-wrap gap-3">
        <button type="button" className="button secondary" onClick={() => bus.emit('BENCHMARK_STARTED', { mode: 'mouse' })}>Start mouse/keyboard run</button>
        <button type="button" className="button primary" onClick={() => bus.emit('BENCHMARK_STARTED', { mode: 'drishva' })}>Start Drishva run</button>
      </div>
      <p className="mt-4 text-sm text-[#718096]" role="status">
        {mode ? `Active mode: ${mode === 'mouse' ? 'Mouse/keyboard' : 'Drishva'}` : 'No active run'}
      </p>
      <ol className="mt-5 max-w-2xl divide-y divide-[#e3e9ef] border-y border-[#e3e9ef]">
        {tasks.map((task, index) => {
          const done = completed.includes(task.id)
          return (
            <li key={task.id} className="flex items-center justify-between gap-4 py-4">
              <span className="text-sm font-medium text-[#293b4f]">{String(index + 1).padStart(2, '0')} · {task.title}</span>
              <span className={done ? 'text-sm font-bold text-[#087f8c]' : 'text-xs text-[#718096]'}>{done ? 'Complete' : 'Pending'}</span>
            </li>
          )
        })}
      </ol>
      <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
        <a className="text-[#066772] underline" href="#/booking">Open appointment tasks</a>
        <a className="text-[#066772] underline" href="#/results">View results</a>
      </div>
    </main>
  )
}
