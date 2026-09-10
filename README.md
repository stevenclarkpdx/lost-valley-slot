# Lost Valley Slot Prototype

Lost Valley is a browser-based slot design prototype for exploring commercial-style slot math, feature structure, presentation, and implementation. It is an independent design prototype, not a real-money gambling product.

## Run locally

```bash
npm install
npm run dev
```

## Test and build

```bash
npm test
npm run build
```

The production build outputs to `dist/`.

## Netlify deployment

Use these settings for a manual Netlify deployment:

- Build command: `npm run build`
- Publish directory: `dist`
- Framework preset: Vite, or no preset with the settings above

The app is entirely client-side. `netlify.toml` includes a single-page-app fallback so refreshes and direct navigation return `index.html`.

## Environment variables

No environment variables are required for the public game build.

The local art-generation pipeline can use provider credentials from local environment files, but those files are ignored and are not needed at runtime. Do not commit real API keys or generated provider logs.

## Debug and designer tools

Math simulation, tuning controls, engine diagnostics, and cluster-scan debug details are hidden in normal public use.

They are shown automatically on:

- `localhost`
- `127.0.0.1`

For a public deployment, append `?debug=1` to the URL to show the designer/debug tools.

For local previewing of the normal public experience, append `?debug=0`; localhost otherwise shows designer tools automatically.

## Art assets

Runtime artwork is bundled from `src/assets/concept/`. The game does not call image-generation providers during build or runtime.
