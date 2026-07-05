// 与后端通信的唯一出口。其他前端文件不允许直接写 fetch。

import { getDeviceId } from './identity.js';

function userId() {
  return getDeviceId();
}

async function parseTasks(text) {
  const res = await fetch('/api/tasks/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, user_id: userId() }),
  });
  if (!res.ok) throw new Error('解析任务失败');
  const data = await res.json();
  return data.tasks;
}

async function parseAudio(audioBase64, mimeType) {
  const res = await fetch('/api/tasks/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: audioBase64, mimeType, user_id: userId() }),
  });
  if (!res.ok) throw new Error('解析音频失败');
  const data = await res.json();
  return data.tasks;
}

async function chatReply(taskId, taskTitle, message) {
  const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, taskTitle, user_id: userId() }),
  });
  if (!res.ok) throw new Error('获取 AI 回复失败');
  const data = await res.json();
  return data.reply;
}

async function reportDragEvent(eventData) {
  try {
    await fetch('/api/events/drag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...eventData, user_id: userId() }),
    });
  } catch (e) {
    // 静默忽略：上报失败不能影响拖拽本身的用户体验
    console.warn('拖拽记录上报失败（不影响使用）:', e.message);
  }
}

export { parseTasks, parseAudio, chatReply, reportDragEvent };
