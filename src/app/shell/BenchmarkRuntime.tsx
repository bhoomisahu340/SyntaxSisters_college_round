import { useEffect } from 'react'
import { attachBenchmarkLogger } from '../../core/metrics/logger.ts'

export function BenchmarkRuntime() {
  useEffect(() => attachBenchmarkLogger(), [])
  return null
}
