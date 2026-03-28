/**
 * 議事録タイピング練習 - メインアプリケーション
 */
(function () {
  "use strict";

  // ===== 状態管理 =====
  const state = {
    currentLevel: null,    // "easy" | "medium" | "hard"
    currentMode: "audio",  // "audio" | "text"
    questions: [],
    currentIndex: 0,
    playCount: 0,
    maxPlays: 3,
    timerInterval: null,
    startTime: null,
    elapsedSeconds: 0,
    isSpeaking: false,
    results: []
  };

  // ===== DOM要素 =====
  const $ = (sel) => document.querySelector(sel);
  const screens = {
    select: $("#screen-select"),
    game: $("#screen-game"),
    result: $("#screen-result"),
    summary: $("#screen-summary")
  };

  // 問題テキストのコピー防止（右クリック・キーボードショートカット）
  $("#question-text").addEventListener("contextmenu", (e) => e.preventDefault());
  $("#question-text").addEventListener("copy", (e) => e.preventDefault());
  $("#question-text").addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "a") e.preventDefault();
  });

  // ===== 画面切り替え =====
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  // ===== テーマ切り替え =====
  (function initTheme() {
    const saved = localStorage.getItem("theme");
    if (saved) document.documentElement.dataset.theme = saved;
    updateThemeIcon();
  })();

  function updateThemeIcon() {
    const theme = document.documentElement.dataset.theme;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = theme === "dark" || (!theme && systemDark);
    $("#btn-theme").textContent = isDark ? "☀️" : "🌙";
  }

  $("#btn-theme").addEventListener("click", () => {
    const current = document.documentElement.dataset.theme;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = current === "dark" || (!current && systemDark);
    const next = isDark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
    updateThemeIcon();
  });

  // 難易度カードの説明文（モード別）
  const CARD_DESCS = {
    audio: {
      easy:   "短い定型フレーズ<br>ゆっくり読み上げ・60秒",
      medium: "業務文・議題説明<br>普通の速度・90秒",
      hard:   "長文・専門用語<br>速い読み上げ・120秒"
    },
    text: {
      easy:   "短い定型フレーズ<br>制限時間：40秒",
      medium: "業務文・議題説明<br>制限時間：60秒",
      hard:   "長文・専門用語<br>制限時間：90秒"
    }
  };

  function updateCardDescs(mode) {
    document.querySelectorAll(".card[data-level]").forEach((card) => {
      const descEl = card.querySelector(".card-desc");
      if (descEl) descEl.innerHTML = CARD_DESCS[mode][card.dataset.level];
    });
  }

  // ===== モード選択タブ =====
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".mode-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.currentMode = tab.dataset.mode;
      $("#mode-desc").textContent = state.currentMode === "audio"
        ? "音声を聞いて、聞き取った内容を入力しよう"
        : "画面の文字を素早く正確に入力しよう";
      updateCardDescs(state.currentMode);
    });
  });

  // 初期カード説明文を適用
  updateCardDescs(state.currentMode);

  // ===== 難易度選択 =====
  document.querySelectorAll(".card[data-level]").forEach((card) => {
    card.addEventListener("click", () => {
      startGame(card.dataset.level, state.currentMode);
    });
  });

  function startGame(level, mode) {
    state.currentLevel = level;
    state.currentMode = mode;
    const shuffled = [...QUESTIONS[level]].sort(() => Math.random() - 0.5);
    state.questions = shuffled.slice(0, 5);
    state.currentIndex = 0;
    state.results = [];
    showScreen("game");
    loadQuestion();
  }

  // ===== 問題読み込み =====
  function loadQuestion() {
    const q = state.questions[state.currentIndex];
    state.playCount = 0;
    state.startTime = null;
    state.elapsedSeconds = 0;
    clearInterval(state.timerInterval);

    // ヘッダー更新
    const levelBadge = $("#level-badge");
    levelBadge.textContent = LEVEL_NAMES[state.currentLevel];
    levelBadge.className = "badge badge-" + state.currentLevel;
    $("#mode-badge").textContent = state.currentMode === "audio" ? "音声" : "文字";
    $("#question-counter").textContent = `問題 ${state.currentIndex + 1} / ${state.questions.length}`;
    $("#timer-display").textContent = "⏱ 00:00";
    $("#timer-display").classList.remove("warning");
    $("#user-input").value = "";
    $("#user-input").disabled = false;
    $("#btn-submit").disabled = true;

    if (state.currentMode === "audio") {
      // 音声モード: 再生エリア表示、テキスト表示非表示
      $("#text-display").style.display = "none";
      $(".play-area").style.display = "";
      $("#play-count").textContent = `残り再生回数: ${state.maxPlays}`;
      $("#btn-play").disabled = false;
    } else {
      // 文字モード: テキスト表示、再生エリア非表示、即タイマー開始
      $(".play-area").style.display = "none";
      $("#text-display").style.display = "";
      $("#question-text").textContent = q.text;
      $("#user-input").placeholder = "上の文章を入力してください...";
      startTimer();
    }
  }

  // ===== 音声再生 =====
  $("#btn-play").addEventListener("click", () => {
    if (state.isSpeaking) return;
    if (state.playCount >= state.maxPlays) return;

    const q = state.questions[state.currentIndex];
    const utterance = new SpeechSynthesisUtterance(q.text);
    utterance.lang = "ja-JP";
    utterance.rate = SPEECH_RATES[state.currentLevel];
    utterance.pitch = 1.0;

    state.isSpeaking = true;
    $("#btn-play").disabled = true;

    utterance.onend = () => {
      state.isSpeaking = false;
      state.playCount++;
      const remaining = state.maxPlays - state.playCount;
      $("#play-count").textContent = `残り再生回数: ${remaining}`;

      if (remaining <= 0) {
        $("#btn-play").disabled = true;
      } else {
        $("#btn-play").disabled = false;
      }

      // 初回再生終了時にタイマー開始
      if (state.playCount === 1) {
        startTimer();
      }
    };

    utterance.onerror = () => {
      state.isSpeaking = false;
      $("#btn-play").disabled = false;
    };

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  });

  // ===== タイマー =====
  function startTimer() {
    state.startTime = Date.now();
    state.timerInterval = setInterval(() => {
      state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
      updateTimerDisplay();
    }, 200);
  }

  function updateTimerDisplay() {
    const min = Math.floor(state.elapsedSeconds / 60);
    const sec = state.elapsedSeconds % 60;
    const display = `⏱ ${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    const timerEl = $("#timer-display");
    timerEl.textContent = display;

    const timeLimit = TIME_LIMITS[state.currentLevel];
    if (state.elapsedSeconds >= timeLimit) {
      timerEl.classList.add("warning");
    }
  }

  // ===== 入力監視 =====
  $("#user-input").addEventListener("input", () => {
    const value = $("#user-input").value.trim();
    $("#btn-submit").disabled = value.length === 0;
  });

  // ===== 採点 =====
  $("#btn-submit").addEventListener("click", () => {
    clearInterval(state.timerInterval);
    const q = state.questions[state.currentIndex];
    const userInput = $("#user-input").value.trim();
    const timeLimit = state.currentMode === "audio"
      ? TIME_LIMITS[state.currentLevel]
      : TEXT_TIME_LIMITS[state.currentLevel];

    const score = calculateScore(q.text, userInput, state.elapsedSeconds, timeLimit);
    const diff = generateDiff(q.text, userInput);

    state.results.push({
      ...score,
      correct: q.text,
      input: userInput,
      elapsed: state.elapsedSeconds
    });

    showResult(score, diff, q.text, userInput);
  });

  function showResult(score, diff, correct, input) {
    showScreen("result");

    const maxScore = 120;
    $("#score-value").textContent = score.total;
    $("#result-max-score").textContent = `${maxScore}点満点`;
    $("#accuracy-score").textContent = score.accuracy;
    $("#time-bonus").textContent = `+${score.timeBonus}`;

    // 差分表示
    renderDiff($("#correct-text"), diff.correctDiff);
    renderDiff($("#user-text"), diff.inputDiff);

    // 最後の問題かどうかで次のボタン表示を変更
    const isLast = state.currentIndex >= state.questions.length - 1;
    $("#btn-next").textContent = isLast ? "結果を見る 📊" : "次の問題へ ➡";
  }

  function renderDiff(container, diffChars) {
    container.innerHTML = "";
    diffChars.forEach((d) => {
      const span = document.createElement("span");
      span.textContent = d.char;
      span.className = `diff-char-${d.status}`;
      container.appendChild(span);
    });
  }

  // ===== 次の問題 / サマリー =====
  $("#btn-next").addEventListener("click", () => {
    state.currentIndex++;
    if (state.currentIndex >= state.questions.length) {
      showSummary();
    } else {
      showScreen("game");
      loadQuestion();
    }
  });

  function showSummary() {
    showScreen("summary");

    const totalScore = state.results.reduce((sum, r) => sum + r.total, 0);
    const maxPossible = state.results.length * 120;
    const avgAccuracy = Math.round(
      state.results.reduce((sum, r) => sum + r.accuracy, 0) / state.results.length
    );
    const bestScore = Math.max(...state.results.map((r) => r.total));

    $("#total-score").textContent = totalScore;
    $("#total-max").textContent = `${maxPossible} 点中`;
    $("#avg-accuracy").textContent = `${avgAccuracy}%`;
    $("#best-score").textContent = bestScore;
    $("#total-questions").textContent = `${state.results.length} 問`;

    // 詳細リスト
    const detailsEl = $("#summary-details");
    detailsEl.innerHTML = "";
    state.results.forEach((r, i) => {
      const item = document.createElement("div");
      item.className = "summary-item";
      item.innerHTML = `
        <span class="summary-item-num">第${i + 1}問</span>
        <span class="summary-item-text">${escapeHtml(r.correct)}</span>
        <span class="summary-item-score">${r.total}点</span>
      `;
      detailsEl.appendChild(item);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== 戻るボタン =====
  $("#btn-back").addEventListener("click", () => {
    clearInterval(state.timerInterval);
    speechSynthesis.cancel();
    $("#user-input").placeholder = "聞こえた内容をここに入力してください...";
    // 表示をデフォルトに戻す
    $(".play-area").style.display = "";
    $("#text-display").style.display = "none";
    showScreen("select");
  });

  // ===== リトライ =====
  $("#btn-retry").addEventListener("click", () => {
    showScreen("select");
  });
})();
