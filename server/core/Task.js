// 任务对象的数据结构定义。所有 provider 返回的任务都应该整形成这个形状。

let counter = 0;

function nextId() {
  counter += 1;
  return `t_${Date.now()}_${counter}`;
}

/**
 * @param {{ title: string, x: number, y: number }} raw
 * @returns {{ id: string, title: string, x: number, y: number, score: number, quadrant: string }}
 */
function createTask({ title, x, y }) {
  const clampedX = Math.max(-1, Math.min(1, x));
  const clampedY = Math.max(-1, Math.min(1, y));
  return {
    id: nextId(),
    title,
    x: clampedX,
    y: clampedY,
    score: clampedX + clampedY,
    quadrant: quadrantOf(clampedX, clampedY),
  };
}

function quadrantOf(x, y) {
  if (x >= 0 && y >= 0) return 'important-urgent';
  if (x < 0 && y >= 0) return 'urgent-only';
  if (x >= 0 && y < 0) return 'important-only';
  return 'neither';
}

module.exports = { createTask, quadrantOf };
