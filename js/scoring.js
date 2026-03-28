/**
 * 議事録タイピング練習 - 採点ロジック
 */

/**
 * Levenshtein距離を計算する
 */
function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // 削除
          dp[i][j - 1],     // 挿入
          dp[i - 1][j - 1]  // 置換
        );
      }
    }
  }
  return dp[m][n];
}

/**
 * 正確さスコアを計算する（0〜100）
 */
function calculateAccuracy(correct, input) {
  if (correct.length === 0 && input.length === 0) return 100;
  if (correct.length === 0) return 0;

  const distance = levenshteinDistance(correct, input);
  const maxLen = Math.max(correct.length, input.length);
  const accuracy = Math.max(0, (1 - distance / maxLen)) * 100;
  return Math.round(accuracy);
}

/**
 * 時間ボーナスを計算する（0〜20）
 * 制限時間の半分以内に完了: 20点
 * 制限時間の75%以内に完了: 10点
 * 制限時間内に完了: 5点
 * 制限時間超過: 0点
 */
function calculateTimeBonus(elapsedSeconds, timeLimitSeconds) {
  const ratio = elapsedSeconds / timeLimitSeconds;
  if (ratio <= 0.5) return 20;
  if (ratio <= 0.75) return 10;
  if (ratio <= 1.0) return 5;
  return 0;
}

/**
 * 総合スコアを計算する
 */
function calculateScore(correct, input, elapsedSeconds, timeLimitSeconds) {
  const accuracy = calculateAccuracy(correct, input);
  const timeBonus = calculateTimeBonus(elapsedSeconds, timeLimitSeconds);
  return {
    accuracy,
    timeBonus,
    total: accuracy + timeBonus
  };
}

/**
 * 差分情報を生成する（正解テキストと入力テキストの比較）
 * 各文字に対して 'correct', 'wrong', 'missing', 'extra' のステータスを付与
 */
function generateDiff(correct, input) {
  const m = correct.length;
  const n = input.length;

  // DP テーブル構築
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (correct[i - 1] === input[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  // バックトラックで差分を生成
  const correctDiff = [];
  const inputDiff = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && correct[i - 1] === input[j - 1]) {
      correctDiff.unshift({ char: correct[i - 1], status: "correct" });
      inputDiff.unshift({ char: input[j - 1], status: "correct" });
      i--; j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      correctDiff.unshift({ char: correct[i - 1], status: "wrong" });
      inputDiff.unshift({ char: input[j - 1], status: "wrong" });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j] === dp[i][j - 1] + 1)) {
      correctDiff.unshift({ char: " ", status: "missing" });
      inputDiff.unshift({ char: input[j - 1], status: "extra" });
      j--;
    } else {
      correctDiff.unshift({ char: correct[i - 1], status: "missing" });
      inputDiff.unshift({ char: " ", status: "missing" });
      i--;
    }
  }

  return { correctDiff, inputDiff };
}
