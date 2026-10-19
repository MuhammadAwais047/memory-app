(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const DECKS = {
    creatures: [
      ["🦊", "Fox"], ["🦉", "Owl"], ["🐢", "Turtle"], ["🐙", "Octopus"],
      ["🦋", "Butterfly"], ["🦔", "Hedgehog"], ["🐸", "Frog"], ["🦜", "Parrot"],
      ["🐋", "Whale"], ["🐝", "Bee"], ["🦩", "Flamingo"], ["🐿️", "Squirrel"],
      ["🦌", "Deer"], ["🐌", "Snail"], ["🦈", "Shark"], ["🐞", "Ladybug"],
      ["🦦", "Otter"], ["🐺", "Wolf"]
    ],
    cosmos: [
      ["🌙", "Moon"], ["🪐", "Saturn"], ["☄️", "Comet"], ["🛰️", "Satellite"],
      ["🚀", "Rocket"], ["👽", "Alien"], ["🔭", "Telescope"], ["🌍", "Earth"],
      ["⭐", "Star"], ["🌌", "Galaxy"], ["☀️", "Sun"], ["🧑‍🚀", "Astronaut"],
      ["🛸", "UFO"], ["🌠", "Shooting star"], ["✨", "Sparkles"], ["🔆", "Sunburst"],
      ["🌗", "Half moon"], ["💫", "Orbit"]
    ],
    kitchen: [
      ["🍋", "Lemon"], ["🍞", "Bread"], ["🧀", "Cheese"], ["🍓", "Strawberry"],
      ["🥑", "Avocado"], ["🍕", "Pizza"], ["🍩", "Donut"], ["🍯", "Honey"],
      ["🥕", "Carrot"], ["🍇", "Grapes"], ["🍄", "Mushroom"], ["🥨", "Pretzel"],
      ["🍉", "Watermelon"], ["🍒", "Cherries"], ["🧄", "Garlic"], ["🥐", "Croissant"],
      ["🍑", "Peach"], ["🌽", "Corn"]
    ]
  };

  const THEME_NAMES = { creatures: "Creatures", cosmos: "Cosmos", kitchen: "Kitchen" };
  const DIFFICULTY = {
    easy: { pairs: 8, label: "Easy" },
    medium: { pairs: 10, label: "Medium" },
    hard: { pairs: 15, label: "Hard" }
  };
  const PAIR_COLORS = ["#4b3dff", "#ff6a3d", "#2e9e6b", "#c77d0a", "#b5487a", "#2a8fa8", "#7a5cd6", "#a8642a"];
  const BEST_KEY = "twice-best-v1";
  const SOUND_KEY = "twice-sound-v1";
  const WIN_COPY = [
    "Clean work. The deck did not stand a chance.",
    "Every card accounted for. Nicely held.",
    "Sharp eyes. The thread stayed unbroken.",
    "Quiet focus, tidy finish. Well played.",
    "That deck has been thoroughly learned."
  ];

  const board = $("#board");
  const timeEl = $("#time");
  const movesEl = $("#moves");
  const pairsEl = $("#pairs");
  const bestPill = $("#best-pill");
  const progress = $("#progress");
  const boardNote = $("#board-note");
  const live = $("#live");
  const win = $("#win");
  const soundBtn = $("#sound-btn");
  const recordGrid = $("#record-grid");

  const state = {
    difficulty: "easy",
    theme: "creatures",
    cards: [],
    first: null,
    lock: false,
    started: false,
    startTime: 0,
    elapsed: 0,
    moves: 0,
    matched: 0,
    timer: null,
    flipTimer: null,
    winTimer: null,
    soundOn: true,
    bests: {}
  };

  /* ---------- storage ---------- */

  function loadBests() {
    try {
      const raw = JSON.parse(localStorage.getItem(BEST_KEY) || "{}");
      if (!raw || typeof raw !== "object") return {};
      const clean = {};
      Object.keys(raw).forEach((key) => {
        const v = raw[key];
        if (v && Number.isFinite(v.moves) && Number.isFinite(v.ms) && v.moves > 0 && v.ms >= 0) {
          clean[key] = { moves: v.moves, ms: v.ms };
        }
      });
      return clean;
    } catch {
      return {};
    }
  }

  function saveBests() {
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(state.bests));
    } catch {
      /* storage full or blocked — game still works */
    }
  }

  function loadSound() {
    try {
      return localStorage.getItem(SOUND_KEY) !== "off";
    } catch {
      return true;
    }
  }

  function saveSound() {
    try {
      localStorage.setItem(SOUND_KEY, state.soundOn ? "on" : "off");
    } catch {
      /* ignore */
    }
  }

  /* ---------- audio ---------- */

  let audioCtx = null;

  function tone(freq, delay, duration, type, volume) {
    if (!state.soundOn) return;
    try {
      if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
      }
      if (audioCtx.state === "suspended") audioCtx.resume();
      const t0 = audioCtx.currentTime + (delay || 0);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(volume || 0.045, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (duration || 0.12));
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + (duration || 0.12) + 0.03);
    } catch {
      /* audio optional */
    }
  }

  const sound = {
    flip() { tone(520, 0, 0.07, "triangle", 0.03); },
    match() {
      tone(660, 0, 0.13, "sine", 0.045);
      tone(880, 0.09, 0.18, "sine", 0.04);
    },
    miss() { tone(196, 0, 0.16, "sawtooth", 0.02); },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.24, "sine", 0.04));
    }
  };

  /* ---------- helpers ---------- */

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pairKey() {
    return `${state.theme}-${state.difficulty}`;
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function currentBest() {
    return state.bests[pairKey()] || null;
  }

  function isBetter(candidate, best) {
    if (!best) return true;
    if (candidate.moves !== best.moves) return candidate.moves < best.moves;
    return candidate.ms < best.ms;
  }

  function announce(message) {
    live.textContent = "";
    window.setTimeout(() => { live.textContent = message; }, 40);
  }

  /* ---------- timer ---------- */

  function startTimer() {
    state.started = true;
    state.startTime = Date.now();
    state.elapsed = 0;
    state.timer = window.setInterval(() => {
      state.elapsed = Date.now() - state.startTime;
      timeEl.textContent = formatTime(state.elapsed);
    }, 200);
  }

  function stopTimer() {
    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = null;
    }
  }

  /* ---------- render ---------- */

  function buildDeck() {
    const config = DIFFICULTY[state.difficulty];
    const picks = shuffle(DECKS[state.theme]).slice(0, config.pairs);
    const cards = [];
    picks.forEach((pair, i) => {
      const [emoji, label] = pair;
      const color = PAIR_COLORS[i % PAIR_COLORS.length];
      cards.push({ pairId: i, emoji, label, color, matched: false, flipped: false });
      cards.push({ pairId: i, emoji, label, color, matched: false, flipped: false });
    });
    return shuffle(cards);
  }

  function cardAria(card, index) {
    if (card.matched) return `${card.emoji} ${card.label}, matched`;
    if (card.flipped) return `${card.emoji} ${card.label}`;
    return `Card ${index + 1}, face down`;
  }

  function updateCardAria(index) {
    const card = state.cards[index];
    const btn = board.querySelector(`[data-index="${index}"]`);
    if (card && btn) btn.setAttribute("aria-label", cardAria(card, index));
  }

  function renderBoard() {
    board.textContent = "";
    board.dataset.diff = state.difficulty;
    const frag = document.createDocumentFragment();

    state.cards.forEach((card, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "card";
      btn.dataset.index = String(index);
      btn.style.setProperty("--deal-delay", `${Math.min(index * 16, 320)}ms`);
      btn.style.setProperty("--pc", card.color);
      btn.setAttribute("aria-label", cardAria(card, index));
      btn.setAttribute("aria-pressed", "false");

      const inner = document.createElement("span");
      inner.className = "card-inner";

      const back = document.createElement("span");
      back.className = "card-face card-back";
      back.setAttribute("aria-hidden", "true");
      const mark = document.createElement("span");
      mark.className = "back-mark";
      mark.append(document.createElement("i"), document.createElement("i"));
      back.appendChild(mark);

      const front = document.createElement("span");
      front.className = "card-face card-front";
      front.setAttribute("aria-hidden", "true");
      const emoji = document.createElement("span");
      emoji.className = "card-emoji";
      emoji.textContent = card.emoji;
      const label = document.createElement("span");
      label.className = "card-label";
      label.textContent = card.label;
      front.append(emoji, label);

      inner.append(back, front);
      btn.appendChild(inner);
      frag.appendChild(btn);
    });

    board.appendChild(frag);
  }

  function renderScores() {
    const total = DIFFICULTY[state.difficulty].pairs;
    movesEl.textContent = String(state.moves);
    pairsEl.textContent = `${state.matched} / ${total}`;
    progress.style.width = `${(state.matched / total) * 100}%`;
    timeEl.textContent = formatTime(state.elapsed);
  }

  function renderBestPill() {
    const best = currentBest();
    bestPill.textContent = best
      ? `Best · ${best.moves} moves · ${formatTime(best.ms)}`
      : "No best yet";
  }

  function renderNote() {
    const total = DIFFICULTY[state.difficulty].pairs;
    boardNote.textContent = `${THEME_NAMES[state.theme]} deck · match ${total} pairs. The clock starts with your first flip.`;
  }

  function renderRecords() {
    recordGrid.textContent = "";
    Object.keys(DIFFICULTY).forEach((key) => {
      const best = state.bests[`${state.theme}-${key}`];
      const rec = document.createElement("div");
      rec.className = "record";
      if (!best) rec.classList.add("none");
      if (key === state.difficulty) rec.classList.add("active");

      const top = document.createElement("div");
      top.className = "record-top";
      const name = document.createElement("span");
      name.textContent = DIFFICULTY[key].label;
      const theme = document.createElement("span");
      theme.textContent = THEME_NAMES[state.theme];
      top.append(name, theme);

      const value = document.createElement("div");
      value.className = "record-value";
      const sub = document.createElement("div");
      sub.className = "record-sub";

      if (best) {
        value.textContent = String(best.moves);
        const small = document.createElement("small");
        small.textContent = "moves";
        value.appendChild(small);
        sub.textContent = `${formatTime(best.ms)} best time`;
      } else {
        value.textContent = "—";
        sub.textContent = "Not cleared yet";
      }

      rec.append(top, value, sub);
      recordGrid.appendChild(rec);
    });
  }

  function syncControls() {
    $$("#diff-tabs button").forEach((btn) => {
      const active = btn.dataset.diff === state.difficulty;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
    $$("#theme-tabs button").forEach((btn) => {
      const active = btn.dataset.theme === state.theme;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  /* ---------- game flow ---------- */

  function newGame(announceIt = true) {
    stopTimer();
    if (state.flipTimer) {
      window.clearTimeout(state.flipTimer);
      state.flipTimer = null;
    }
    if (state.winTimer) {
      window.clearTimeout(state.winTimer);
      state.winTimer = null;
    }
    hideWin();
    state.cards = buildDeck();
    state.first = null;
    state.lock = false;
    state.started = false;
    state.startTime = 0;
    state.elapsed = 0;
    state.moves = 0;
    state.matched = 0;
    syncControls();
    renderBoard();
    renderScores();
    renderBestPill();
    renderNote();
    renderRecords();
    if (announceIt) {
      announce(`New ${state.difficulty} ${THEME_NAMES[state.theme]} deck. ${DIFFICULTY[state.difficulty].pairs} pairs.`);
    }
  }

  function flipCard(index) {
    const card = state.cards[index];
    if (!card || state.lock || card.matched || card.flipped) return;

    if (!state.started) startTimer();

    card.flipped = true;
    const btn = board.querySelector(`[data-index="${index}"]`);
    if (btn) {
      btn.classList.add("flipped");
      btn.setAttribute("aria-pressed", "true");
    }
    updateCardAria(index);
    sound.flip();

    if (state.first === null) {
      state.first = index;
      announce(`${card.label}, face up.`);
      return;
    }

    const firstIndex = state.first;
    const firstCard = state.cards[firstIndex];
    const firstBtn = firstBtnFor(firstIndex);

    state.first = null;
    state.moves += 1;
    movesEl.textContent = String(state.moves);

    if (firstCard.pairId === card.pairId) {
      firstCard.matched = true;
      card.matched = true;
      state.matched += 1;
      [firstBtn, btn].forEach((el) => {
        if (!el) return;
        el.classList.add("matched");
        el.classList.remove("wrong");
      });
      updateCardAria(firstIndex);
      updateCardAria(index);
      renderScores();
      sound.match();
      announce(`Match — ${card.label}. ${state.matched} of ${DIFFICULTY[state.difficulty].pairs} pairs.`);

      if (state.matched === DIFFICULTY[state.difficulty].pairs) finishGame();
      return;
    }

    state.lock = true;
    [firstBtn, btn].forEach((el) => {
      if (el) el.classList.add("wrong");
    });
    sound.miss();
    announce(`${firstCard.label} and ${card.label} — no match.`);

    if (state.flipTimer) window.clearTimeout(state.flipTimer);
    const gen = state.moves;
    state.flipTimer = window.setTimeout(() => {
      if (gen !== state.moves) return;
      [[firstIndex, firstCard], [index, card]].forEach(([i, c]) => {
        c.flipped = false;
        const el = board.querySelector(`[data-index="${i}"]`);
        if (el) {
          el.classList.remove("flipped", "wrong");
          el.setAttribute("aria-pressed", "false");
        }
        updateCardAria(i);
      });
      state.lock = false;
      state.flipTimer = null;
    }, 820);
  }

  function firstBtnFor(index) {
    return board.querySelector(`[data-index="${index}"]`);
  }

  function finishGame() {
    stopTimer();
    state.elapsed = Date.now() - state.startTime;
    timeEl.textContent = formatTime(state.elapsed);
    state.lock = true;

    const total = DIFFICULTY[state.difficulty].pairs;
    const result = { moves: state.moves, ms: state.elapsed };
    const previous = currentBest();
    const newBest = isBetter(result, previous);

    if (newBest) {
      state.bests[pairKey()] = result;
      saveBests();
    }

    $("#win-moves").textContent = String(state.moves);
    $("#win-time").textContent = formatTime(state.elapsed);
    const best = currentBest();
    $("#win-best").textContent = best ? `${best.moves} moves` : "—";
    $("#win-badge").hidden = !newBest;

    const perfect = state.moves === total;
    $("#win-copy").textContent = perfect
      ? "A clean sweep — every attempt found its pair. That is a perfect run."
      : WIN_COPY[Math.floor(Math.random() * WIN_COPY.length)];

    renderBestPill();
    renderRecords();

    const summary = `Deck cleared in ${state.moves} moves and ${formatTime(state.elapsed)}.${newBest ? " New personal best." : ""}`;
    if (state.winTimer) window.clearTimeout(state.winTimer);
    state.winTimer = window.setTimeout(() => {
      state.winTimer = null;
      win.hidden = false;
      sound.win();
      burstConfetti();
      announce(summary);
      $("#win-again").focus();
    }, 460);
  }

  function hideWin() {
    if (!win.hidden && win.contains(document.activeElement)) $("#new-game").focus();
    win.hidden = true;
  }

  /* ---------- confetti ---------- */

  function burstConfetti() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layer = $("#confetti");
    layer.textContent = "";
    const colors = ["#4b3dff", "#ff6a3d", "#d9f36a", "#17362a", "#f2ede4"];
    const count = 70;
    for (let i = 0; i < count; i += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.setProperty("--x", `${Math.random() * 100}%`);
      piece.style.setProperty("--c", colors[Math.floor(Math.random() * colors.length)]);
      piece.style.setProperty("--dur", `${1.5 + Math.random() * 1.1}s`);
      piece.style.setProperty("--delay", `${Math.random() * 0.35}s`);
      piece.style.setProperty("--r0", `${Math.random() * 360}deg`);
      piece.style.setProperty("--rot", `${Math.random() * 900 - 450}deg`);
      piece.style.setProperty("--dx", `${Math.random() * 160 - 80}px`);
      layer.appendChild(piece);
    }
    window.setTimeout(() => { layer.textContent = ""; }, 3200);
  }

  /* ---------- sound toggle ---------- */

  function syncSoundBtn() {
    soundBtn.classList.toggle("is-muted", !state.soundOn);
    soundBtn.setAttribute("aria-pressed", String(state.soundOn));
    soundBtn.title = state.soundOn ? "Sound on" : "Sound off";
    $(".ico-on", soundBtn).hidden = !state.soundOn;
    $(".ico-off", soundBtn).hidden = state.soundOn;
  }

  function toggleSound() {
    state.soundOn = !state.soundOn;
    saveSound();
    syncSoundBtn();
    if (state.soundOn) tone(660, 0, 0.1, "sine", 0.035);
    announce(state.soundOn ? "Sound on." : "Sound off.");
  }

  /* ---------- events ---------- */

  board.addEventListener("click", (event) => {
    const btn = event.target.closest(".card");
    if (!btn || !board.contains(btn)) return;
    flipCard(Number(btn.dataset.index));
  });

  $("#diff-tabs").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-diff]");
    if (!btn || btn.dataset.diff === state.difficulty) return;
    state.difficulty = btn.dataset.diff;
    newGame();
  });

  $("#theme-tabs").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-theme]");
    if (!btn || btn.dataset.theme === state.theme) return;
    state.theme = btn.dataset.theme;
    newGame();
  });

  $("#new-game").addEventListener("click", () => newGame());
  $("#win-again").addEventListener("click", () => newGame());
  $("#win-close").addEventListener("click", () => {
    hideWin();
    announce("Board view. All pairs are matched.");
  });
  soundBtn.addEventListener("click", toggleSound);

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (!win.hidden && event.key === "Tab") {
      const items = $$("#win button").filter((b) => !b.hidden);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = win.contains(document.activeElement);
      if (event.shiftKey && (!inside || document.activeElement === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.key === "Escape" && !win.hidden) {
      event.preventDefault();
      hideWin();
      return;
    }
    if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      newGame();
    }
  });

  /* ---------- boot ---------- */

  state.bests = loadBests();
  state.soundOn = loadSound();
  state.cards = buildDeck();
  syncSoundBtn();
  newGame(false);
})();
