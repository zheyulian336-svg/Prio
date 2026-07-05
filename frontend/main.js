// 页面控制器：把 store / matrix / drag / api-client 粘合起来，处理 DOM 事件。
// （目录规划里未单列此文件，是承载"页面胶水逻辑"的必要补充，见交付说明。）

import * as store from './store.js';
import * as api from './api-client.js';
import { initMatrix, renderMatrix, rankColorMap, getBallEl, quadrantOf } from './matrix.js';
import { handleBallMouseDown, attachCardHandleDrag } from './drag.js';

const matrixPlane = document.getElementById('matrixPlane');
const listContainer = document.getElementById('taskList');
const hoverCard = document.getElementById('hoverCard');
const hoverTitle = document.getElementById('hoverTitle');
const hoverImportance = document.getElementById('hoverImportance');
const hoverUrgency = document.getElementById('hoverUrgency');
const hoverRank = document.getElementById('hoverRank');
const detailPanel = document.getElementById('detailPanel');
const detailTitle = document.getElementById('detailTitle');
const chatLog = document.getElementById('chatLog');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');
const detailClose = document.getElementById('detailClose');
const confirmModal = document.getElementById('confirmModal');
const confirmText = document.getElementById('confirmText');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');
const bottomInput = document.getElementById('bottomInput');
const bottomSend = document.getElementById('bottomSend');
const micBtn = document.getElementById('micBtn');

let currentDetailTaskId = null;
let pendingDeleteId = null;

initMatrix(matrixPlane);

store.subscribe((tasks) => {
  renderMatrix(tasks, {
    onHover: showTooltip,
    onHoverEnd: hideTooltip,
    onDragStart: onBallMouseDown,
  });
  renderList(tasks);
  // 空状态：矩阵里没有任务时加个引导样式
  if (tasks.length === 0) {
    matrixPlane.classList.add('matrix-empty');
  } else {
    matrixPlane.classList.remove('matrix-empty');
  }
});

store.init();

// ---------- 小球交互 ----------

function getQuadrantLabel(x, y) {
  if (x >= 0 && y >= 0) return '重要 · 紧急';
  if (x < 0 && y >= 0) return '紧急 · 不重要';
  if (x >= 0 && y < 0) return '重要 · 不紧急';
  return '不重要 · 不紧急';
}

function positionNearBall(el, ballEl, task, elWidth, elHeight) {
  const ballRect = ballEl.getBoundingClientRect();
  const ballCenterX = ballRect.left + ballRect.width / 2;
  const ballCenterY = ballRect.top + ballRect.height / 2;
  const gap = 20;
  const viewportPad = 12;

  // 小球在矩阵右侧 → 面板/卡片出现在右侧；左侧同理
  const onRight = task.x >= 0;

  let left, top;
  if (onRight) {
    left = ballRect.right + gap;
    if (left + elWidth > window.innerWidth - viewportPad) {
      left = ballRect.left - elWidth - gap;
    }
  } else {
    left = ballRect.left - elWidth - gap;
    if (left < viewportPad) {
      left = ballRect.right + gap;
    }
  }
  // 两侧都放不下时，贴靠视口边缘
  left = Math.max(viewportPad, Math.min(left, window.innerWidth - elWidth - viewportPad));

  top = ballCenterY - elHeight / 2;
  top = Math.max(viewportPad, Math.min(top, window.innerHeight - elHeight - viewportPad));

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function showTooltip(taskId, ballEl) {
  const task = store.getTaskById(taskId);
  if (!task) return;

  // 填充悬停预览卡片内容
  hoverTitle.textContent = task.title;
  const importancePct = Math.round(((task.x + 1) / 2) * 100);
  const urgencyPct = Math.round(((task.y + 1) / 2) * 100);
  hoverImportance.textContent = `重要性：${importancePct}%`;
  hoverUrgency.textContent = `紧急性：${urgencyPct}%`;
  hoverRank.textContent = `象限：${getQuadrantLabel(task.x, task.y)}`;

  // 用离线测量确定实际尺寸后再定位
  hoverCard.classList.add('visible');
  const hcRect = hoverCard.getBoundingClientRect();
  positionNearBall(hoverCard, ballEl, task, hcRect.width, hcRect.height);
}

function hideTooltip() {
  hoverCard.classList.remove('visible');
}

function onBallMouseDown(taskId, ballEl, event) {
  const task = store.getTaskById(taskId);
  if (!task) return;
  ballEl.classList.add('ball-pressed');
  handleBallMouseDown(taskId, ballEl, event, task, {
    onMove() {
      hideTooltip();
    },
    onClick(id) {
      ballEl.classList.remove('ball-pressed');
      openDetail(id, ballEl);
    },
    onDropSameQuadrant(id, x, y) {
      ballEl.classList.remove('ball-pressed');
      store.updateTaskPosition(id, x, y);
      api.reportDragEvent({
        taskTitle: task.title,
        fromX: task.x, fromY: task.y,
        toX: x, toY: y,
        fromQuadrant: quadrantOf(task.x, task.y),
        toQuadrant: quadrantOf(x, y),
      });
    },
    onDropOtherQuadrant(id, x, y) {
      ballEl.classList.remove('ball-pressed');
      store.updateTaskPosition(id, x, y);
      api.reportDragEvent({
        taskTitle: task.title,
        fromX: task.x, fromY: task.y,
        toX: x, toY: y,
        fromQuadrant: quadrantOf(task.x, task.y),
        toQuadrant: quadrantOf(x, y),
      });
    },
    onDropOutside(id) {
      ballEl.classList.remove('ball-pressed');
      pendingDeleteId = id;
      const t = store.getTaskById(id);
      confirmText.textContent = `确定要删除任务「${t ? t.title : ''}」吗？`;
      confirmModal.classList.add('visible');
      confirmModal.dataset.mode = 'delete-ball';
      // 取消时坐标未变，重新渲染即可弹回原位
      renderMatrix(store.getTasks(), {
        onHover: showTooltip,
        onHoverEnd: hideTooltip,
        onDragStart: onBallMouseDown,
      });
    },
  });
}

// ---------- 待办清单 ----------

function renderList(tasks) {
  const colorMap = rankColorMap(tasks);
  listContainer.innerHTML = '';

  if (tasks.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'list-empty';
    empty.textContent = '在下方输入你想做的事情，AI 会帮你拆解任务并智能排布到四象限中 ✨';
    listContainer.appendChild(empty);
    return;
  }

  tasks.forEach((task) => {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.id = task.id;

    const handle = document.createElement('span');
    handle.className = 'card-handle';
    handle.textContent = '⠿';

    const dot = document.createElement('span');
    dot.className = 'card-dot';
    dot.style.background = colorMap.get(task.id);

    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = task.title;

    const closeBtn = document.createElement('span');
    closeBtn.className = 'card-close';
    closeBtn.textContent = '×';

    card.appendChild(handle);
    card.appendChild(dot);
    card.appendChild(title);
    card.appendChild(closeBtn);
    listContainer.appendChild(card);

    attachCardHandleDrag(handle, card, listContainer, task.id, {
      onReorder(id, newIndex) {
        store.reorderTask(id, newIndex);
      },
    });

    card.addEventListener('click', (e) => {
      if (e.target === handle || e.target === closeBtn) return;
      openDetail(task.id, getBallEl(task.id));
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pendingDeleteId = task.id;
      confirmText.textContent = `确定要删除任务「${task.title}」吗？`;
      confirmModal.classList.add('visible');
      confirmModal.dataset.mode = 'delete-card';
    });
  });
}

// ---------- 确认弹窗 ----------

confirmOk.addEventListener('click', () => {
  if (pendingDeleteId) {
    store.removeTask(pendingDeleteId);
  }
  pendingDeleteId = null;
  confirmModal.classList.remove('visible');
});

confirmCancel.addEventListener('click', () => {
  pendingDeleteId = null;
  confirmModal.classList.remove('visible');
});

// ---------- 详情 + AI 对话面板 ----------

function openDetail(taskId, ballEl) {
  const task = store.getTaskById(taskId);
  if (!task) return;
  currentDetailTaskId = taskId;
  detailTitle.textContent = task.title;
  chatLog.innerHTML = '';
  appendChatBubble('ai', '我是您的秩序 AI，我可以帮您完成工作。');

  // 打开问答框时隐藏悬停卡片
  hideTooltip();

  positionDetailPanel(task, ballEl);
  detailPanel.classList.add('visible');
}

function positionDetailPanel(task, ballEl) {
  // 始终定位在矩阵右侧之外，确保矩阵完全露出
  const planeRect = matrixPlane.getBoundingClientRect();
  const panelWidth = 400;
  const gap = 12;

  let left = planeRect.right + gap;
  // 如果右侧空间不够，贴靠视口右边缘
  if (left + panelWidth > window.innerWidth - 12) {
    left = window.innerWidth - panelWidth - 12;
  }

  detailPanel.style.left = `${left}px`;
}

detailClose.addEventListener('click', () => {
  detailPanel.classList.remove('visible');
  currentDetailTaskId = null;
});

function appendChatBubble(role, text) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble chat-${role}`;
  bubble.textContent = text;
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function sendChat() {
  const msg = chatInput.value.trim();
  if (!msg || !currentDetailTaskId) return;
  const task = store.getTaskById(currentDetailTaskId);
  appendChatBubble('user', msg);
  chatInput.value = '';

  const thinking = document.createElement('div');
  thinking.className = 'chat-bubble chat-ai chat-thinking';
  thinking.textContent = 'AI 思考中…';
  chatLog.appendChild(thinking);
  chatLog.scrollTop = chatLog.scrollHeight;

  try {
    const reply = await api.chatReply(currentDetailTaskId, task ? task.title : '', msg);
    thinking.remove();
    appendChatBubble('ai', reply);
  } catch (e) {
    thinking.remove();
    appendChatBubble('ai', '抱歉，网络似乎出了点问题。');
  }
}

chatSend.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat();
});

// ---------- 底部输入栏 ----------

async function submitBottomInput() {
  const text = bottomInput.value.trim();
  if (!text) return;
  bottomInput.value = '';
  bottomInput.disabled = true;
  try {
    const tasks = await api.parseTasks(text);
    tasks.forEach((t, idx) => {
      setTimeout(() => {
        store.addTasks([t]);
      }, idx * 250);
    });
  } catch (e) {
    console.error(e);
    alert('解析任务失败，请稍后再试');
  } finally {
    bottomInput.disabled = false;
    bottomInput.focus();
  }
}

bottomSend.addEventListener('click', submitBottomInput);
bottomInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitBottomInput();
});

// ---------- 语音输入（AudioContext 录 PCM → 编码 WAV → 发 Dify Workflow 转写）----------

let audioContext = null;
let scriptProcessor = null;
let mediaStream = null;
let pcmChunks = [];
let isRecording = false;
let sampleRate = 44100;
const bottomPlaceholder = bottomInput.placeholder;

// 将 PCM 数据编码为 WAV 文件（16-bit mono PCM）
function encodeWAV(samples, rate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = rate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = samples.length * blockAlign;

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);                   // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // 写入 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function startRecording() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    sampleRate = audioContext.sampleRate;

    const source = audioContext.createMediaStreamSource(mediaStream);
    // ScriptProcessorNode: 每 4096 帧处理一次
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
    pcmChunks = [];

    scriptProcessor.onaudioprocess = (e) => {
      // 获取输入通道的 Float32 PCM 数据
      const inputData = e.inputBuffer.getChannelData(0);
      // 复制一份（因为 AudioContext 可能会复用 buffer）
      pcmChunks.push(new Float32Array(inputData));
    };

    source.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    isRecording = true;
    micBtn.classList.add('mic-active');
    bottomInput.placeholder = '🔴 正在录音…再次点击结束';
  } catch (e) {
    console.error('麦克风访问失败:', e);
    if (e.name === 'NotAllowedError') {
      alert('请允许麦克风权限后重试');
    } else {
      alert('无法访问麦克风，请检查设备');
    }
  }
}

async function stopRecording() {
  if (!isRecording) return;
  stopRecordingUI();

  // 断开音频处理链
  if (scriptProcessor) {
    scriptProcessor.disconnect();
    scriptProcessor = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }

  if (pcmChunks.length === 0) return;

  // 合并所有 PCM 片段 → 编码 WAV → base64
  const totalLength = pcmChunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of pcmChunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  pcmChunks = [];

  const wavBlob = encodeWAV(merged, sampleRate);
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(wavBlob);
  });

  try {
    bottomInput.value = '';
    bottomInput.disabled = true;
    const tasks = await api.parseAudio(base64, 'audio/wav');
    tasks.forEach((t, idx) => {
      setTimeout(() => {
        store.addTasks([t]);
      }, idx * 250);
    });
  } catch (e) {
    console.error('音频解析失败:', e);
    alert('语音解析失败，请稍后再试');
  } finally {
    bottomInput.disabled = false;
  }
}

function stopRecordingUI() {
  isRecording = false;
  micBtn.classList.remove('mic-active');
  bottomInput.placeholder = bottomPlaceholder;
}

micBtn.addEventListener('click', () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});
