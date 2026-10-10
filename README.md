# Drishva

See. Speak. Browse.

Hands-free browsing with a webcam and microphone. 100% client-side.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Use Chrome.

## MediaPipe model (required later)

Download and save as `public/models/face_landmarker.task`:

https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task

WASM files are copied from `@mediapipe/tasks-vision` into `public/wasm` on `npm install`.

## Deploy

Vercel. Headers live in `vercel.json`.
