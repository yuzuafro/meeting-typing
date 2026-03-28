/**
 * 議事録タイピング練習 - メインアプリケーション
 */
(function () {
  "use strict";

  // ===== 状態管理 =====
  const state = {
    currentLevel: null,    // "easy" | "medium" | "hard"
    questions: [],         // 現在の難易度の問題リスト
    currentIndex: 0,       // 現在の問題インデックス
    playCount: 0,          // 再生した回数
    maxPlays: 3,           // 最大再生回数
    timerInterval: null,   // タイマーのinterval ID
    startTime: null,       // 入力開始時刻
    elapsedSeconds: 0,     // 経過時間
    isSpeaking: false,     // 音声再生中フラグ
    results: []            // 各問題の結果 [{ score, accuracy, timeBonus, correct, input }]
  };

  // ===== DOM要素 =====
  const $ = (sel) => document.querySelector(sel);
  const screens = {
    select: $("#screen-select"),
    game: $("#screen-game"),
    result: $("#screen-result"),
    summary: $("#screen-summary")
  };

  // ===== 画面切り替え =====
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  // ===== 難易度選択 =====
  document.querySelectorAll(".card[data-level]").forEach((card) => {
    card.addEventListener("click", () => {
      const level = card.dataset.level;
      startGame(level);
    });
  });

  function startGame(level) {
    state.currentLevel = level;
    // Fisher-Yates shuffle then pick 5
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

    // UI更新
    const levelBadge = $("#level-badge");
    levelBadge.textContent = LEVEL_NAMES[state.currentLevel];
    levelBadge.className = "badge badge-" + state.currentLevel;
    $("#question-counter").textContent = `問題 ${state.currentIndex + 1} / ${state.questions.length}`;
    $("#play-count").textContent = `残り再生回数: ${state.maxPlays}`;
    $("#timer-display").textContent = "⏱ 00:00";
    $("#timer-display").classList.remove("warning");
    $("#user-input").value = "";
    $("#user-input").disabled = false;
    $("#btn-play").disabled = false;
    $("#btn-submit").disabled = true;
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
    const timeLimit = TIME_LIMITS[state.currentLevel];

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

    $("#score-value").textContent = score.total;
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
    showScreen("select");
  });

  // ===== リトライ =====
  $("#btn-retry").addEventListener("click", () => {
    showScreen("select");
  });
})();
