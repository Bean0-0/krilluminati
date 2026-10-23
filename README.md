# Krilluminati

Tab completion for [Krillion](https://krillion.io/), including Puffer.

## Install

1. Install Violentmonkey.
2. Import `dist/krillion-io-helper.user.js`. Replace any older copy.
3. Reload Krillion.

For AI suggestions, add an [OpenRouter API key](https://openrouter.ai/settings/keys) through the script's Violentmonkey menu. Only free models are used; availability and quotas vary.

## Controls

- **Tab / Shift+Tab** or **↓ / ↑**: cycle suggestions.
- **Enter**: submit normally. Nothing is submitted automatically.
- **Escape**: hide the panel.
- **AI guesses**: request suggestions for the current category.
- **Add words**: save your own guesses.
- **Export learned**: download learned answers and custom words.

Suggestions come from public answer sheets, historical samples, and accepted answers seen while playing. Known scores rank first. Puffer may use a different answer catalog; AI and custom guesses are unverified. Answers already used are excluded when observed, but joining mid-round can miss earlier answers.

AI fallback runs for unknown categories, not on each keystroke. It can be switched off in the Violentmonkey menu.

## Privacy

Your API key stays in Violentmonkey storage, not the game or repository. OpenRouter receives the category and answer-length limit—not chat, player names, or room details. The game page can trigger requests through the helper's bridge, so use a dedicated key. Requests are limited and cached locally; OpenRouter's provider privacy policies still apply.

## Development

Requires Python 3 and Node.js.

```sh
npm ci
npx playwright install chromium
npm run build
npm run check
npm test
```

Builds go to `dist/`. Tests use public game pages with mocked AI responses and party events; they don't submit answers or join rooms.

For the real Firefox/Violentmonkey test, install `tests/requirements-firefox.txt` and run `python3 tests/firefox-extension.py --help` for setup options. It uses a temporary profile and mocked AI responses.

## Dataset

Historical samples: KrillionHQ (2026), [Krillion Daily Dive Dataset](https://github.com/StruggleYang/krillion-dataset), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Converted to prompt-indexed suggestions with normalized tiers and invalid entries removed. Samples are incomplete. License: [`data/LICENSE`](data/LICENSE).

Unofficial project; no affiliation or endorsement.
