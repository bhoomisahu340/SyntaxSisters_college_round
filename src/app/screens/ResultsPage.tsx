import { useEffect, useState } from 'react'
import { bus } from '../../core/bus.ts'
import type { BenchmarkSummary } from '../../core/events.ts'

function formatDuration(milliseconds: number): string {
  const seconds = milliseconds / 1000
  return `${seconds.toFixed(1)} s`
}

export function ResultsPage() {
  const [runs, setRuns] = useState<BenchmarkSummary[]>([])

  useEffect(() => {
    const offUpdate = bus.on('BENCHMARK_UPDATED', ({ runs: nextRuns }) => setRuns(nextRuns))
    bus.emit('BENCHMARK_STATUS_REQUESTED')
    return () => offUpdate()
  }, [])

  const mouseRun = [...runs].reverse().find((run) => run.mode === 'mouse')
  const handsFreeRun = [...runs].reverse().find((run) => run.mode === 'drishva')
  const metrics = [
    { label: 'Completion time', value: (run: BenchmarkSummary) => run.completionTimeMs, display: (run: BenchmarkSummary) => formatDuration(run.completionTimeMs) },
    { label: 'Command accuracy', value: (run: BenchmarkSummary) => run.commandAccuracy ?? 0, display: (run: BenchmarkSummary) => run.commandAccuracy === null ? 'Not applicable' : `${Math.round(run.commandAccuracy * 100)}%` },
    { label: 'Selection errors', value: (run: BenchmarkSummary) => run.selectionErrors, display: (run: BenchmarkSummary) => String(run.selectionErrors) },
    { label: 'Accidental activations', value: (_run: BenchmarkSummary) => 0, display: (_run: BenchmarkSummary) => 'Not instrumented' },
    { label: 'Prevented by Shield', value: (run: BenchmarkSummary) => run.preventedByShield, display: (run: BenchmarkSummary) => String(run.preventedByShield) },
  ]

  return (
    <main className="min-h-[70vh] px-[8%] py-12 max-sm:px-5">
      <span className="section-label">MEASURED IN THIS BROWSER</span>
      <h1 className="font-[Manrope,sans-serif] text-4xl font-extrabold text-[#17324f]">Benchmark results</h1>
      <p className="mt-3 max-w-2xl text-[#718096]">Preliminary prototype measurements. Runs remain in memory and are not uploaded.</p>
      {!mouseRun && !handsFreeRun ? (
        <p className="mt-8 border-y border-[#e3e9ef] py-5 text-sm text-[#718096]">Complete both benchmark modes to compare results.</p>
      ) : (
        <div className="mt-8 max-w-3xl overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#d7e0e6] text-[#718096]">
                <th className="py-3 pr-4 font-medium">Measure</th>
                <th className="py-3 pr-4 font-medium">Mouse/keyboard</th>
                <th className="py-3 font-medium">Drishva</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => {
                const mouseValue = mouseRun ? metric.value(mouseRun) : 0
                const drishvaValue = handsFreeRun ? metric.value(handsFreeRun) : 0
                const scale = Math.max(mouseValue, drishvaValue, 1)
                return (
                  <tr className="border-b border-[#e3e9ef]" key={metric.label}>
                    <th className="py-4 pr-4 font-semibold text-[#293b4f]">{metric.label}</th>
                    <td className="min-w-32 py-4 pr-4">
                      {mouseRun ? metric.display(mouseRun) : 'Not run'}
                      <div className="mt-2 h-2 overflow-hidden rounded bg-[#edf2f5]">
                        <div className="h-full bg-[#17324f]" style={{ width: `${mouseRun ? Math.max(4, mouseValue / scale * 100) : 0}%` }} />
                      </div>
                    </td>
                    <td className="min-w-32 py-4">
                      {handsFreeRun ? metric.display(handsFreeRun) : 'Not run'}
                      <div className="mt-2 h-2 overflow-hidden rounded bg-[#edf2f5]">
                        <div className="h-full bg-[#087f8c]" style={{ width: `${handsFreeRun ? Math.max(4, drishvaValue / scale * 100) : 0}%` }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-[#718096]">Accidental activations are not yet instrumented; actions blocked by the Intent Shield are counted separately.</p>
        </div>
      )}
      <a className="mt-6 inline-block text-sm font-semibold text-[#066772] underline" href="#/arena">Back to benchmark</a>
    </main>
  )
}
