/* ==========================================================================
   Typing Speed Test — by fuzie
   Vanilla JS: rendering, timer, WPM/accuracy, results and restart.
   ========================================================================== */

const CONFIG = {
  duration: 60,
  texts: [
    "Тихое утро медленно заполняет комнату светом. На столе остывает чай, а за окном просыпается город. Мысли приходят по одной, спокойно и размеренно, пока страница не начинает заполняться словами. В этом нет спешки, только ритм, внимание и маленькие шаги вперед.",
    "Хорошая идея редко приходит по расписанию. Она прячется между незаконченными делами и недопитым кофе, ждет подходящего момента. Главное, оставаться любопытным достаточно долго, чтобы ее заметить, и смелым достаточно, чтобы записать, пока момент не прошел и комната снова не погрузилась в тишину.",
    "Дождь тихо стучит по стеклу, и день становится мягким и серым. В такую погоду никуда не хочется спешить: только слушать капли, смотреть на размытые огни и думать о разном. На кухне закипает чайник, и весь дом наполняется теплом.",
    "Каждый навык начинается с неуклюжей попытки. Первые строки даются медленно, пальцы сомневаются, а ошибки собираются, как осенние листья. Но повторение незаметно прокладывает путь, и однажды слова начинают течь свободно. Прогресс редко бывает громким, это сумма маленьких упрямых решений.",
  ],
};

/* --------------------------------------------------------------------------
   Keyboard layouts

   The test works with both RU and EN layouts. For every typed character we
   look at the expected one: if the scripts differ, the character is translated
   through the keyboard map, so "еру" on a Russian layout matches "the" and
   "tе" on an English layout matches "те".
   -------------------------------------------------------------------------- */

const RU_TO_EN = {
  й: "q", ц: "w", у: "e", к: "r", е: "t", н: "y", г: "u", ш: "i", щ: "o", з: "p",
  х: "[", ъ: "]", ф: "a", ы: "s", в: "d", а: "f", п: "g", р: "h", о: "j", л: "k",
  д: "l", ж: ";", э: "'", я: "z", ч: "x", с: "c", м: "v", и: "b", т: "n", ь: "m",
  б: ",", ю: ".", ё: "`",
  Й: "Q", Ц: "W", У: "E", К: "R", Е: "T", Н: "Y", Г: "U", Ш: "I", Щ: "O", З: "P",
  Х: "{", Ъ: "}", Ф: "A", Ы: "S", В: "D", А: "F", П: "G", Р: "H", О: "J", Л: "K",
  Д: "L", Ж: ":", Э: '"', Я: "Z", Ч: "X", С: "C", М: "V", И: "B", Т: "N", Ь: "M",
  Б: "<", Ю: ">", Ё: "~",
};

const EN_TO_RU = Object.fromEntries(
  Object.entries(RU_TO_EN).map(([ru, en]) => [en, ru])
);

const CYRILLIC = /[А-Яа-яЁё]/;

function normalizeChar(typedChar, targetChar) {
  if (typedChar === targetChar) return typedChar;

  const targetIsCyrillic = CYRILLIC.test(targetChar);
  const typedIsCyrillic = CYRILLIC.test(typedChar);

  if (targetIsCyrillic && !typedIsCyrillic) {
    return EN_TO_RU[typedChar] ?? typedChar;
  }

  if (!targetIsCyrillic && typedIsCyrillic) {
    return RU_TO_EN[typedChar] ?? typedChar;
  }

  return typedChar;
}

/* --------------------------------------------------------------------------
   DOM and state
   -------------------------------------------------------------------------- */

const dom = {
  card: document.getElementById("typing-card"),
  text: document.getElementById("text"),
  input: document.getElementById("input"),
  timerBox: document.getElementById("timer-box"),
  timer: document.getElementById("timer"),
  restart: document.getElementById("restart"),
  restartResult: document.getElementById("restart-result"),
  hint: document.getElementById("hint"),
  results: document.getElementById("results"),
  resultsTitle: document.getElementById("results-title"),
  resultsSubtitle: document.getElementById("results-subtitle"),
  resultWpm: document.getElementById("result-wpm"),
  resultAccuracy: document.getElementById("result-accuracy"),
  resultTime: document.getElementById("result-time"),
};

const state = {
  text: "",
  started: false,
  finished: false,
  startedAt: 0,
  remaining: CONFIG.duration,
  timerId: null,
};

/* --------------------------------------------------------------------------
   Rendering
   -------------------------------------------------------------------------- */

function pickText(exclude) {
  const available = CONFIG.texts.filter((text) => text !== exclude);
  const pool = available.length > 0 ? available : CONFIG.texts;

  return pool[Math.floor(Math.random() * pool.length)];
}

function renderText() {
  const fragment = document.createDocumentFragment();

  for (const character of state.text) {
    const span = document.createElement("span");
    span.className = "char";
    span.textContent = character;
    fragment.appendChild(span);
  }

  dom.text.replaceChildren(fragment);
}

function matchesAt(typed, index) {
  if (index >= typed.length || index >= state.text.length) return false;

  const targetChar = state.text[index];

  return normalizeChar(typed[index], targetChar) === targetChar;
}

function countCorrect(typed) {
  let correct = 0;
  const length = Math.min(typed.length, state.text.length);

  for (let i = 0; i < length; i += 1) {
    if (matchesAt(typed, i)) correct += 1;
  }

  return correct;
}

function updateCharacters() {
  const characters = dom.text.children;
  const typed = dom.input.value;

  for (let i = 0; i < characters.length; i += 1) {
    const element = characters[i];
    const isTyped = i < typed.length;
    const isCorrect = isTyped && matchesAt(typed, i);

    element.classList.toggle("correct", isCorrect);
    element.classList.toggle("incorrect", isTyped && !isCorrect);
    element.classList.toggle(
      "current",
      !state.finished && !isTyped && i === typed.length
    );
  }
}

function renderTimer() {
  const seconds = Math.max(0, Math.ceil(state.remaining));

  dom.timer.textContent = `${seconds} с`;
  dom.timerBox.classList.toggle(
    "is-low",
    state.started && !state.finished && seconds <= 10
  );
}

/* --------------------------------------------------------------------------
   Timer and results
   -------------------------------------------------------------------------- */

function startTimer() {
  if (state.started || state.finished) return;

  state.started = true;
  state.startedAt = Date.now();
  state.timerId = window.setInterval(tick, 200);
  renderTimer();
}

function tick() {
  if (!state.started || state.finished) return;

  const elapsed = (Date.now() - state.startedAt) / 1000;
  state.remaining = Math.max(0, CONFIG.duration - elapsed);
  renderTimer();

  if (state.remaining <= 0) finish("time");
}

function finish(reason) {
  if (state.finished) return;

  state.finished = true;
  state.started = false;
  window.clearInterval(state.timerId);
  state.timerId = null;

  const elapsed = Math.min(
    CONFIG.duration,
    Math.max(0, (Date.now() - state.startedAt) / 1000)
  );
  const typed = dom.input.value;
  const total = typed.length;
  const correct = countCorrect(typed);
  const minutes = Math.max(elapsed, 1) / 60;
  const wpm = total > 0 ? Math.round(correct / 5 / minutes) : 0;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  state.remaining = 0;
  renderTimer();

  dom.input.disabled = true;
  dom.input.blur();
  dom.card.classList.add("is-finished");
  dom.hint.hidden = true;
  updateCharacters();

  dom.resultsTitle.textContent = reason === "time" ? "Время вышло!" : "Готово!";
  dom.resultsSubtitle.textContent =
    reason === "time"
      ? "Ваш результат за 60 секунд."
      : "Вы набрали весь текст. Отличная работа!";
  dom.resultWpm.textContent = String(wpm);
  dom.resultAccuracy.textContent = `${accuracy}%`;
  dom.resultTime.textContent = `${Math.max(1, Math.round(elapsed))} с`;
  dom.results.hidden = false;

  dom.results.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* --------------------------------------------------------------------------
   Auto-scroll: keep the current line inside the visible text area
   -------------------------------------------------------------------------- */

function keepCurrentLineInView() {
  const current = dom.text.querySelector(".char.current");
  if (!current) return;

  const box = dom.text.getBoundingClientRect();
  const rect = current.getBoundingClientRect();
  const lineHeight = parseFloat(getComputedStyle(dom.text).lineHeight) || 1;
  const buffer = lineHeight * 0.75;

  if (rect.bottom > box.bottom - buffer) {
    dom.text.scrollTop += rect.bottom - box.bottom + buffer;
  } else if (rect.top < box.top + buffer) {
    dom.text.scrollTop -= box.top + buffer - rect.top;
  }
}

/* --------------------------------------------------------------------------
   Interaction
   -------------------------------------------------------------------------- */

function handleInput() {
  if (state.finished) return;

  if (!state.started) startTimer();

  updateCharacters();
  keepCurrentLineInView();

  if (dom.input.value.length >= state.text.length) finish("complete");
}

function restart() {
  window.clearInterval(state.timerId);
  state.timerId = null;
  state.started = false;
  state.finished = false;
  state.startedAt = 0;
  state.remaining = CONFIG.duration;
  state.text = pickText(state.text);

  dom.input.value = "";
  dom.input.disabled = false;
  dom.input.maxLength = state.text.length;

  dom.results.hidden = true;
  dom.hint.hidden = false;
  dom.card.classList.remove("is-finished");
  dom.timerBox.classList.remove("is-low");
  dom.resultWpm.textContent = "0";
  dom.resultAccuracy.textContent = "0%";
  dom.resultTime.textContent = `${CONFIG.duration} с`;

  renderTimer();
  renderText();
  dom.text.scrollTop = 0;
  updateCharacters();

  dom.input.focus({ preventScroll: true });
}

/* --------------------------------------------------------------------------
   Init
   -------------------------------------------------------------------------- */

function init() {
  state.text = pickText("");
  dom.input.maxLength = state.text.length;

  renderText();
  renderTimer();
  updateCharacters();

  dom.input.addEventListener("input", handleInput);

  dom.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
  });

  dom.input.addEventListener("paste", (event) => event.preventDefault());
  dom.input.addEventListener("drop", (event) => event.preventDefault());

  dom.card.addEventListener("click", () => {
    if (!state.finished) dom.input.focus({ preventScroll: true });
  });

  dom.restart.addEventListener("click", restart);
  dom.restartResult.addEventListener("click", restart);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      restart();
    }
  });

  window.addEventListener("resize", keepCurrentLineInView);
}

init();
