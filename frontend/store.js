// 前端状态管理 + localStorage 持久化。任务数据的唯一真源。
// 其他前端模块只能通过这里导出的函数读写任务，不允许直接操作 localStorage。

const STORAGE_KEY = 'prio_tasks_v1';

const PRESET_TASKS = [
  { title: '写季度周报', x: 0.6, y: 0.7 },
  { title: '回复重要客户邮件', x: 0.7, y: 0.2 },
  { title: '整理书架', x: -0.6, y: -0.7 },
  { title: '临时会议纪要', x: -0.3, y: 0.6 },
  { title: '健身 30 分钟', x: 0.4, y: -0.5 },
  { title: '刷手机', x: -0.8, y: -0.2 },
];

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
  return [...list].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.y - a.y;
  });
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
    tasks = PRESET_TASKS.map((t) => ({
      id: nextId(),
      title: t.title,
      x: clamp(t.x),
      y: clamp(t.y),
      score: computeScore(clamp(t.x), clamp(t.y)),
    }));
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

// 新增任务（来自 AI 解析结果），返回本地包装后的任务列表
function addTasks(rawList) {
  const wrapped = rawList.map((t) => {
    const x = clamp(t.x);
    const y = clamp(t.y);
    return {
      id: t.id || nextId(),
      title: t.title,
      x,
      y,
      score: computeScore(x, y),
    };
  });
  tasks = tasks.concat(wrapped);
  persist();
  notify();
  return wrapped;
}

// 更新任务坐标（拖拽小球后调用）
function updateTaskPosition(id, x, y) {
  const t = tasks.find((tk) => tk.id === id);
  if (!t) return;
  t.x = clamp(x);
  t.y = clamp(y);
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
