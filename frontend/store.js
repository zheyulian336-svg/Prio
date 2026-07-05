// 前端状态管理 + localStorage 持久化。任务数据的唯一真源。
// 其他前端模块只能通过这里导出的函数读写任务，不允许直接操作 localStorage。

const STORAGE_KEY = 'prio_tasks_v2';  // 升级 key，废弃旧版假数据

let tasks = [];
let listeners = [];
let idCounter = 0;

function nextId() {
  idCounter += 1;
  return `local_${Date.now()}_${idCounter}`;
}

function clamp(v) {
  return Math.max(-1, Math.min(1, v));
}

function computeScore(x, y) {
  return x + y;
}

function sortByScore(list) {
  // 按 score 降序；同分时 y（紧急性）大者优先
  return [...list].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.y - a.y;
  });
}

// ---- 小球防碰撞：确保矩阵上任意两个小球坐标不重合 ----

const MIN_DISTANCE = 0.06;  // 约等于小球直径在坐标空间的映射

function hasCollision(x, y, taskList, excludeId = null) {
  for (const t of taskList) {
    if (excludeId && t.id === excludeId) continue;
    const dx = x - t.x;
    const dy = y - t.y;
    if (Math.sqrt(dx * dx + dy * dy) < MIN_DISTANCE) return true;
  }
  return false;
}

// 在 (x, y) 附近寻找不与其他任务碰撞的位置，返回 { x, y }
function avoidCollision(x, y, taskList, excludeId = null) {
  if (!hasCollision(x, y, taskList, excludeId)) return { x, y };

  // 螺旋搜索：从近到远尝试偏移
  const offsets = [
    [0.05, 0], [-0.05, 0], [0, 0.05], [0, -0.05],
    [0.05, 0.05], [-0.05, 0.05], [0.05, -0.05], [-0.05, -0.05],
    [0.08, 0], [-0.08, 0], [0, 0.08], [0, -0.08],
    [0.03, 0.06], [-0.03, 0.06], [0.03, -0.06], [-0.03, -0.06],
    [0.06, 0.03], [-0.06, 0.03], [0.06, -0.03], [-0.06, -0.03],
  ];

  for (const [dx, dy] of offsets) {
    const nx = clamp(x + dx);
    const ny = clamp(y + dy);
    if (!hasCollision(nx, ny, taskList, excludeId)) {
      return { x: nx, y: ny };
    }
  }

  // 兜底：随机微偏移
  return {
    x: clamp(x + (Math.random() - 0.5) * 0.1),
    y: clamp(y + (Math.random() - 0.5) * 0.1),
  };
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.warn('localStorage 写入失败', e);
  }
}

function notify() {
  const snapshot = sortByScore(tasks);
  listeners.forEach((fn) => fn(snapshot));
}

function subscribe(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

function init() {
  let saved = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch (e) {
    console.warn('localStorage 读取失败', e);
  }

  if (Array.isArray(saved) && saved.length > 0) {
    tasks = saved;
  } else {
    tasks = [];
    persist();
  }
  notify();
}

function getTasks() {
  return sortByScore(tasks);
}

function getTaskById(id) {
  return tasks.find((t) => t.id === id) || null;
}

// 新增任务（来自 AI 解析结果），返回本地包装后的任务列表。
// 自动检测并修正坐标碰撞，确保每个小球位置唯一。
function addTasks(rawList) {
  const batch = [];
  for (const t of rawList) {
    const id = t.id || nextId();
    // 先避开已有任务，再避开同批次已加入的任务
    let { x, y } = avoidCollision(clamp(t.x), clamp(t.y), tasks);
    ({ x, y } = avoidCollision(x, y, batch));
    const task = { id, title: t.title, x, y, score: computeScore(x, y) };
    batch.push(task);
  }
  tasks = tasks.concat(batch);
  persist();
  notify();
  return batch;
}

// 更新任务坐标（拖拽小球后调用），自动避开其他小球的位置
function updateTaskPosition(id, x, y) {
  const t = tasks.find((tk) => tk.id === id);
  if (!t) return;
  const { x: safeX, y: safeY } = avoidCollision(clamp(x), clamp(y), tasks, id);
  t.x = safeX;
  t.y = safeY;
  t.score = computeScore(t.x, t.y);
  persist();
  notify();
}

function removeTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  persist();
  notify();
}

// 卡片手柄拖拽重排序：在目标位置相邻任务的 score 之间插值
function reorderTask(id, newIndex) {
  const ordered = sortByScore(tasks);
  const fromIndex = ordered.findIndex((t) => t.id === id);
  if (fromIndex === -1) return;

  const [moved] = ordered.splice(fromIndex, 1);
  const clampedIndex = Math.max(0, Math.min(ordered.length, newIndex));
  ordered.splice(clampedIndex, 0, moved);

  const prev = ordered[clampedIndex - 1];
  const next = ordered[clampedIndex + 1];

  let newScore;
  if (prev && next) {
    newScore = (prev.score + next.score) / 2;
  } else if (prev) {
    newScore = prev.score - 0.05;
  } else if (next) {
    newScore = next.score + 0.05;
  } else {
    newScore = moved.score;
  }

  // 保持 x 不变，反推 y = score - x，再夹紧
  const target = tasks.find((t) => t.id === id);
  if (!target) return;
  const newY = clamp(newScore - target.x);
  target.y = newY;
  target.score = computeScore(target.x, target.y);

  persist();
  notify();
}

export {
  init,
  getTasks,
  getTaskById,
  addTasks,
  updateTaskPosition,
  removeTask,
  reorderTask,
  subscribe,
};
