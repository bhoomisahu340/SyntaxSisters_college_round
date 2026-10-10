import fs from 'node:fs'
import path from 'node:path'

const src = path.join(
  process.cwd(),
  'node_modules',
  '@mediapipe',
  'tasks-vision',
  'wasm',
)
const dest = path.join(process.cwd(), 'public', 'wasm')

if (!fs.existsSync(src)) {
  console.warn(`copy-wasm: source not found: ${src}`)
  process.exit(0)
}

fs.mkdirSync(dest, { recursive: true })
fs.cpSync(src, dest, { recursive: true })
console.log(`Copied MediaPipe wasm → ${dest}`)
