// Score 计算与排序规则：Score = x + y，Score 越大优先级越高；同分时 y（紧急性）大者优先。

function computeScore(x, y) {
  return x + y;
}

function sortByScore(tasks) {
  return [...tasks].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.y - a.y;
  });
}

module.exports = { computeScore, sortByScore };
