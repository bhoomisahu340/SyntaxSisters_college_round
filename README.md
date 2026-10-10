# Drishva

**See. Speak. Browse.** A client-side hands-free browsing prototype with Home, Shop, and appointment pages, voice commands, numbered targets, Intent Shield confirmation, an optional head cursor, and a small task benchmark.

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:5173/`. Use a current Chrome or Chromium browser for Web Speech support. Camera access requires localhost or HTTPS and explicit permission.

## Local Vision Assets

The FaceLandmarker model is loaded from `public/models/face_landmarker.task`. If it is missing, download the official task bundle and place it at that path:

https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task

WASM runtime files are copied from `@mediapipe/tasks-vision/wasm` to `public/wasm` by the existing `postinstall` script. No vision assets are fetched from a CDN at runtime.

## Hands-Free Use

Click **Enable hands-free** in the floating preview and allow camera/microphone access. The camera preview and tracking service persist while moving between Home, Shop, and Appointments. Calibration is available at `#/calibrate`; the development vision screen is `#/debug/vision`.

Commands use the configured wake word (`computer`) except pause/resume: “computer, go to shop,” “computer, show numbers,” “computer, click 4,” “computer, search for reading,” and “computer, recenter.” Use “pause” or Escape to pause, and “resume” to continue. A risky locked action requires a separate “confirm.” Dictation starts with “computer, start typing” while a supported text field is focused/locked, and ends with “computer, stop typing.” Dictation never submits a form.

The Shop uses the existing demo product data. Booking offers appointment types and time slots; it does not connect to real doctors or a clinic. The benchmark reports preliminary measurements from completed in-browser runs. Accidental activation counts are not yet instrumented.

## Privacy And Limitations

Webcam frames are processed locally and this app does not upload or save video. Calibration values only are stored in versioned localStorage JSON. Browser Web Speech implementations, including Chrome speech recognition, may send audio to Google's speech recognition service; audio is not recorded by this app.

Web Speech is not supported consistently across browsers. Real webcam/face tracking requires a working camera, model asset, local WASM files, and user permission. Automated validation used a generated video stream; physical camera behavior should be verified on the target device. This prototype does not replace assistive technology or clinical services.

## Build And Deploy

```bash
npm run build
npm run preview
```

Deploy the repository root to Vercel. Keep the `public/models/face_landmarker.task` asset and `public/wasm/` files in the deployment. Security headers and camera/microphone permissions are configured in `vercel.json`.

Vercel checklist: verify the model and WASM assets are included in the production output, deploy from the repository root, then allow camera and microphone access on the HTTPS deployment. Test both `/` and the hash routes `/#/shop` and `/#/booking` after deployment.
