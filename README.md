# Krillion.io — Niche Tab + Puffer

Unofficial Violentmonkey userscript for **https://krillion.io/**, not krillion.live.

## Install

1. Install Violentmonkey.
2. Open `dist/krillion-io-helper.user.js` in its script editor and save. Replace the previous `.io` helper rather than running two copies.
3. Approve the script's OpenRouter network permission if prompted, then reload Krillion.
4. For optional AI fallback, create an API key at <https://openrouter.ai/settings/keys>.
5. On Krillion, open Violentmonkey's popup → this script → **Krillion: set/remove OpenRouter API key**. Enter the key there, never in source code or GitHub.

No API key is included in this repository. Keys stay in Violentmonkey storage. The browser extension itself must be trusted. Private-repository raw URLs may require GitHub login; automatic script updates are not configured.

## Controls

- **Tab / Shift+Tab** or **↓ / ↑**: cycle matching candidates.
- **Enter**: normal game submission; the helper never submits automatically.
- **Escape**: hide the panel. Click its header to fold it.
- **AI guesses**: manually request suggestions for the exact current category.
- **Add words**: custom unverified guesses for the exact current prompt.
- **Export learned**: export learned Puffer answers/custom words, not the API key.

Typing filters suggestions locally. It does **not** call an AI model per keystroke. Chat fields and native Puffer turn restrictions are left alone.

## Where answers come from

- **Daily / eligible solo games:** public answer sheets for the currently loaded game. Highest official tier score first; known daily submission counts break ties. A 402/403 is treated as unavailable, not bypassed.
- **Puffer:** an embedded historical daily sample bank covering 693 prompts and 21,282 sample answer entries, eligible sheets observed during the session, and accepted answers learned from normal room events. Daily/pack scores are labeled separately from **Puffer ✓** confirmations; catalogs can differ.
- **Unknown prompts:** optional free OpenRouter suggestions. Automatic fallback starts when no eligible local candidates remain and a key has been configured. Use the Violentmonkey menu to toggle automatic fallback; manual AI requests remain available.

Puffer repeats are excluded only when observed in this session/category. Joining mid-category cannot prove the complete used-answer history. Learning an accepted answer generally helps future appearances: that answer is already used in the current category.

### AI limitations and privacy

AI outputs are **unverified guesses**, with **no game score or acceptance claim**. A model can invent facts or propose answers the game's private catalog rejects. Only later normal game events establish Puffer acceptance/tier. Free providers can be slow, rate-limited, or unavailable; a response can arrive after a turn ends.

Requests use only `openrouter/free` with zero maximum prompt/completion/request prices. There are no paid fallback models, plugins, or automatic upstream retries. An OpenRouter key is still required; free quotas and availability are controlled by OpenRouter and its providers.

Only category text and output constraints are sent to OpenRouter. Player names, room codes, chat, current typed answers, and game credentials are not sent. Provider retention/training policies can vary; review your OpenRouter free-model privacy settings.

AI suggestions are cached in Violentmonkey for seven days, up to 250 prompt/length combinations. Local safeguards allow at most three attempts/minute and 40 attempts/rolling 24 hours; these are best-effort across tabs, not server-side enforcement. Distinct pending requests queue, and failed responses require manual retry. Network timeout: 25 seconds.

The key remains in the isolated userscript context and is used only in the extension's HTTPS request to OpenRouter. It is not serialized into injected page code, DOM, game localStorage, exports, or the repository. **The page can see category text and suggestions and can invoke the narrow request bridge. The bridge is not an authentication boundary.** Free-only routing, bounded requests, and local rate safeguards reduce abuse; use a dedicated OpenRouter key and revoke it if needed.

## Build and test

Requirements: Python 3, Node.js, npm.

```sh
npm ci
npx playwright install chromium
npm run build
npm run check
npm test
```

`npm test` uses the live public Daily page and read-only Puffer preview fixture, with mocked OpenRouter responses and mocked party events. It does not submit Daily answers, join public matchmaking, create rooms, or use a real API key. Authenticated OpenRouter inference and actual Violentmonkey extension isolation are not covered by these mocks.

An optional integration test creates a **private** room with two test participants and attempts one normal answer if a matching bank category appears. It is opt-in and can fail when no supported category appears:

```sh
PUFFER_PRIVATE_TEST=1 npm run test:private-room
```

`python3 build.py --install-local` also updates `../krillion-io-helper.user.js` for the original local installation path. Generated userscript is committed under `dist/` for installation without a build.

## Data attribution

Embedded seed: **KrillionHQ (2026), Krillion Daily Dive Dataset**, distributed by <https://github.com/StruggleYang/krillion-dataset> under **CC BY 4.0**: <https://creativecommons.org/licenses/by/4.0/>. Full dataset license: `data/LICENSE`.

Modifications: converted historical samples dated 2026-07-16 through 2026-10-22 to prompt-indexed autocomplete records, normalized tier identifiers, and filtered invalid/oversized entries. Samples are not complete answer catalogs. Independent dataset; no game-developer endorsement. Provided as-is.
