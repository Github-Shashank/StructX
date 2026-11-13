# StructX React

React + Vite app. The original StructX UI and C++ subset interpreter are preserved in `public/structx-legacy.html`. The React layer renders pointer connections as SVG Bézier paths, keeping the connectors in the same coordinate space as the heap diagram without a separate graph-layout engine.

## Run

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

Build for production:

```bash
npm run build
npm run preview
```

The existing HTML remains responsible for code editing, examples, execution, stack/heap cards, nullptr markers, playback, and line highlighting. It sends refresh notifications while cards or the canvas are dragged. The React layer also tracks scrolling inside the iframe, outer-page scrolling, and viewport resizing so connectors remain aligned.

## Troubleshooting

Use Node.js 18 or newer. From the project root run `npm install`, wait for it to finish, then run `npm run dev`. Do not open `index.html` directly as a `file://` URL; Vite must serve the app.
