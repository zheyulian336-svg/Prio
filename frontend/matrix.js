// 矩阵渲染、坐标↔像素映射、小球绘制。

const BALL_RADIUS = 8; // px
const RANK_COLORS = [
  '#ff3b30', // 红
  '#ff9500', // 橙
  '#ffcc00', // 黄
  '#34c759', // 绿
  '#32ade6', // 青
  '#007aff', // 蓝
  '#af52de', // 紫
];
const FALLBACK_COLOR = '#9a9a9e'; // 中性灰兜底

let planeEl = null;
let ballEls = new Map(); // id -> element

function initMatrix(plane) {
  planeEl = plane;
}

function getPlaneRect() {
  return planeEl.getBoundingClientRect();
}

// x,y ∈ [-1,1] → 像素坐标（相对 plane 左上角）
function coordToPixel(x, y) {
  const rect = getPlaneRect();
  const halfW = rect.width / 2 - BALL_RADIUS - 6;
  const halfH = rect.height / 2 - BALL_RADIUS - 6;
  const px = rect.width / 2 + x * halfW;
  const py = rect.height / 2 - y * halfH;
  return { px, py };
}

// 像素坐标 → x,y（不夹紧，可能超出 [-1,1] 用于判断是否越界）
function pixelToCoord(px, py) {
  const rect = getPlaneRect();
  const halfW = rect.width / 2 - BALL_RADIUS - 6;
  const halfH = rect.height / 2 - BALL_RADIUS - 6;
  const x = (px - rect.width / 2) / halfW;
  const y = (rect.height / 2 - py) / halfH;
  return { x, y };
}

// 判断像素坐标是否已经脱离 plane 可视范围（用于拖拽删除判定）
function isOutOfBounds(px, py) {
  const rect = getPlaneRect();
  return px < -BALL_RADIUS || px > rect.width + BALL_RADIUS || py < -BALL_RADIUS || py > rect.height + BALL_RADIUS;
}

// 按 score 排名分配颜色：前 7 名依次映射彩色，其余灰色兜底
function rankColorMap(sortedTasks) {
  const map = new Map();
  sortedTasks.forEach((t, idx) => {
    map.set(t.id, idx < RANK_COLORS.length ? RANK_COLORS[idx] : FALLBACK_COLOR);
  });
  return map;
}

function quadrantOf(x, y) {
  if (x >= 0 && y >= 0) return 'important-urgent';
  if (x < 0 && y >= 0) return 'urgent-only';
  if (x >= 0 && y < 0) return 'important-only';
  return 'neither';
}

/**
 * 渲染/更新矩阵里的小球。
 * @param {Array} sortedTasks 已按 score 排序的任务
 * @param {{ onHover, onHoverEnd, onClick, onDragStart }} handlers
 */
function renderMatrix(sortedTasks, handlers) {
  const colorMap = rankColorMap(sortedTasks);
  const seenIds = new Set();

  sortedTasks.forEach((task) => {
    seenIds.add(task.id);
    let el = ballEls.get(task.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'ball';
      el.dataset.id = task.id;
      planeEl.appendChild(el);
      ballEls.set(task.id, el);

      el.addEventListener('mouseenter', () => handlers.onHover(task.id, el));
      el.addEventListener('mouseleave', () => handlers.onHoverEnd(task.id));
      el.addEventListener('mousedown', (e) => handlers.onDragStart(task.id, el, e));

      // 入场动画
      el.classList.add('ball-enter');
      requestAnimationFrame(() => {
        el.classList.remove('ball-enter');
      });
    }

    const { px, py } = coordToPixel(task.x, task.y);
    el.style.left = `${px}px`;
    el.style.top = `${py}px`;
    el.style.background = colorMap.get(task.id);
    el.title = '';
  });

  // 移除已删除任务对应的球
  for (const [id, el] of ballEls.entries()) {
    if (!seenIds.has(id)) {
      el.remove();
      ballEls.delete(id);
    }
  }
}

function getBallEl(id) {
  return ballEls.get(id);
}

export {
  initMatrix,
  renderMatrix,
  coordToPixel,
  pixelToCoord,
  isOutOfBounds,
  getPlaneRect,
  rankColorMap,
  quadrantOf,
  getBallEl,
  BALL_RADIUS,
};
