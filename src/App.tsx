import { useAppStore } from './app/store.ts'

export default function App() {
  const paused = useAppStore((s) => s.paused)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <h1 className="text-5xl font-semibold tracking-tight">Drishva</h1>
      <p className="mt-3 text-lg text-zinc-400">See. Speak. Browse.</p>
      <p className="mt-8 text-sm text-zinc-500">
        {paused ? 'Paused' : 'Ready'}
      </p>
    </main>
  )
}
