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

Requests use `dots-studio/dots-3-note-preview:free` through OpenRouter, with reasoning disabled and zero maximum prompt/completion/request prices. This model returned valid suggestions in a live $0 test. The random `openrouter/free` router previously selected mandatory-reasoning models that exhausted the output budget without producing answers; pinning a model avoids that failure. There are no paid fallback models, plugins, or automatic upstream retries. An OpenRouter key is still required; free quotas and availability are controlled by OpenRouter and its providers.

Only category text and output constraints are sent to OpenRouter. Player names, room codes, chat, current typed answers, and game credentials are not sent. Provider retention/training policies can vary; review your OpenRouter free-model privacy settings.

AI suggestions are cached in Violentmonkey for seven days, up to 250 prompt/length combinations. Local safeguards allow at most three attempts/minute and 40 attempts/rolling 24 hours; these are best-effort across tabs, not server-side enforcement. At most two distinct requests may be pending (one running, one queued), and failed responses require manual retry. Network timeout: 25 seconds, plus an independent 26-second watchdog if Violentmonkey never calls back. The page expects a bridge acknowledgement within five seconds and has a final 60-second deadline including queue time. Every failure leaves loading state and re-enables manual retry.

The page/userscript bridge uses document-level `CustomEvent`s containing **JSON strings only**, not `window.postMessage` objects or cross-realm object identity checks. An actual Firefox 158.0.1 + Violentmonkey 2.49.0 reproduction showed that the old message's `source` was neither the userscript's virtual `window` nor `null`, so both earlier source guards discarded legitimate requests. This avoids Firefox userscript/Xray wrapper assumptions; Firefox explicitly restricts non-string event detail across extension/page boundaries ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent)). Each direction has its own random event name, bounded payloads, channel/shape validation, and request IDs. Same-page code can observe/invoke this bridge; it is not authentication. The panel distinguishes connecting to the userscript bridge from a queued/running model request.

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

`npm test` uses the live public Daily page and read-only Puffer preview fixture, with mocked OpenRouter responses and mocked party events. Fast local-fixture regressions also cover disabled `window.postMessage`, string-only DOM payloads, rejected malformed/object/wrong-channel messages, a missing bridge, missing userscript network callbacks, and a lost reply after acknowledgement. It does not submit Daily answers, join public matchmaking, create rooms, or use a real API key. Authenticated OpenRouter inference and actual Violentmonkey extension isolation are not covered by these mocks. A separate manual live request verified a valid JSON response in approximately 1.7 seconds with reported cost $0; no credential was saved in project files.

### Actual Firefox + Violentmonkey regression

Unlike the same-context browser mocks, this test starts a separate temporary Firefox profile and installs the real extension. It verifies actual GM missing-key handling, then mocks only key lookup/network completion inside the installed script while exercising the real userscript sandbox, page injection, string bridge, unknown prompt, candidate rendering, and Tab completion. No real credential or live inference is used. Your normal browser profile is untouched.

Provide a Firefox binary, geckodriver, and the official Violentmonkey XPI downloaded from Mozilla Add-ons:

```sh
python3 -m venv .venv-firefox
.venv-firefox/bin/pip install -r tests/requirements-firefox.txt
.venv-firefox/bin/python tests/firefox-extension.py \
  --firefox "$FIREFOX_BIN" \
  --geckodriver "$GECKODRIVER_BIN" \
  --violentmonkey "$VIOLENTMONKEY_XPI"
```

Optional `--baseline /path/to/v2.1.2.user.js` first reproduces the old missing-acknowledgement failure in the same real extension setup. This regression passed using the screenshot's exact prompt: `Name an English word containing "atter"`.

An optional integration test creates a **private** room with two test participants and attempts one normal answer if a matching bank category appears. It is opt-in and can fail when no supported category appears:

```sh
PUFFER_PRIVATE_TEST=1 npm run test:private-room
```

`python3 build.py --install-local` also updates `../krillion-io-helper.user.js` for the original local installation path. Generated userscript is committed under `dist/` for installation without a build.

## Data attribution

Embedded seed: **KrillionHQ (2026), Krillion Daily Dive Dataset**, distributed by <https://github.com/StruggleYang/krillion-dataset> under **CC BY 4.0**: <https://creativecommons.org/licenses/by/4.0/>. Full dataset license: `data/LICENSE`.

Modifications: converted historical samples dated 2026-07-16 through 2026-10-22 to prompt-indexed autocomplete records, normalized tier identifiers, and filtered invalid/oversized entries. Samples are not complete answer catalogs. Independent dataset; no game-developer endorsement. Provided as-is.
