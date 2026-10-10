import { StatusHUD } from './app/shell/StatusHUD.tsx'
import { useAppStore } from './app/store.ts'

export default function App() {
  const paused = useAppStore((s) => s.paused)

  return (
    <>
      <main className="min-h-[220vh] bg-zinc-950 px-6 pb-28 pt-16 text-zinc-100">
        <div className="mx-auto max-w-xl text-center">
          <h1 className="text-5xl font-semibold tracking-tight">Drishva</h1>
          <p className="mt-3 text-lg text-zinc-400">See. Speak. Browse.</p>
          <p className="mt-8 text-sm text-zinc-500">
            {paused ? 'Paused' : 'Ready'}
          </p>
        </div>
        <p className="mx-auto mt-[70vh] max-w-xl text-center text-zinc-500">
          Mid page — try “scroll down”
        </p>
        <p className="mx-auto mt-[70vh] max-w-xl text-center text-zinc-600">
          End of page
        </p>
      </main>
      <StatusHUD />
    </>
  )
}
