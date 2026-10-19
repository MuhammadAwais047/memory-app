# Twice — a memory game

A small, sharp memory game built with vanilla JavaScript. Flip two cards at a time, match the deck from memory, and try to beat your own record. Three themes, three difficulties, a live timer, and personal bests saved in your browser.

**Live demo:** https://muhammadawais047.github.io/memory-app/

## Features

- **Three decks** — Creatures, Cosmos, and Kitchen, each with 18 illustrated emoji pairs
- **Three difficulties** — Easy (8 pairs), Medium (10 pairs), Hard (15 pairs)
- **Real 3D card flips** with deal-in animation, matched highlights, and a shake on a miss
- **Timer that starts on your first flip** — no pressure before you begin
- **Move counter** and pair progress bar
- **Personal bests** per theme and difficulty, compared by moves first, then time
- **Records panel** showing all three difficulties for the current deck
- **Win overlay** with stats, a new-best badge, and confetti
- **Synthesized sound effects** via the Web Audio API (flip, match, miss, win) with a persistent mute toggle
- **Keyboard support** — <kbd>N</kbd> deals a new game, <kbd>Tab</kbd>/<kbd>Enter</kbd> play the board, <kbd>Escape</kbd> closes the win dialog
- **Accessible** — real buttons, live-region announcements, visible focus states, labelled cards, focus-trapped win dialog
- **Reduced-motion friendly** — animations and confetti are disabled when the OS asks for it
- Fully responsive from small phones to desktop, with no horizontal overflow

## Tech

- HTML, CSS, and vanilla JavaScript — no frameworks, no build step, no dependencies
- CSS 3D transforms (`preserve-3d`, `backface-visibility`) for the card flip
- Web Audio API for procedural sound effects
- `localStorage` for personal bests and the sound preference
- Deterministic-free Fisher–Yates shuffle for the deck

## Run it locally

Because everything is static, you can simply open `index.html` in a browser. To serve it properly:

```bash
python -m http.server 8772
```

Then visit <http://localhost:8772>.

## How it plays

1. Pick a deck and a difficulty.
2. Flip two cards. A match stays face up; a miss turns back after a moment.
3. The clock starts with your first flip and stops when the last pair is found.
4. Your best result for each deck/difficulty combination is saved locally and shown in the scorebar and the records panel. A better result means fewer moves, with time as the tie-breaker.

Your records live only in this browser — there are no accounts and no network calls.

## License

MIT © 2026 Muhammad Awais
