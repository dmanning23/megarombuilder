# MegaRomBuilder

Make your own run-and-gun robot action game in the browser, with no programming. Build levels
zone by zone with tiles, enemies and ready-made pieces, play them straight away, and ask the
built-in assistant to build or change levels for you.

## Run it

You need Node.js 20 or later.

```bash
npm install
cp .env.example .env.local   # then put your Anthropic API key in .env.local
npm run dev
```

Open http://localhost:3000 to make a game or open the demo. `/play` plays the demo stage.

The assistant needs an Anthropic API key in `ANTHROPIC_API_KEY`. Without one, everything else
works and the chat says the assistant isn't available. `ANTHROPIC_MODEL` picks the model (the
default is `claude-opus-5-5`). The key stays on the server: the browser talks to `/api/chat`,
which adds the key, and allows 20 chat turns a minute from each address.

## Tests

```bash
npm test            # unit tests
npm run typecheck
npm run lint
npm run e2e         # browser tests: builds the app and serves it on port 3100
```

The tests never call the real assistant: they answer it with scripted replies. To try the real
one, use the prompts in `docs/superpowers/ai-prompts.md`.

## How it is built

The design is in `docs/superpowers/specs/2026-10-02-playable-core-ai-level-builder-design.md`,
the build plans in `docs/superpowers/plans/`, and where things stand in
`docs/superpowers/status.md`.
