// 与后端通信的唯一出口。其他前端文件不允许直接写 fetch。

async function parseTasks(text) {
  const res = await fetch('/api/tasks/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('解析任务失败');
  const data = await res.json();
  return data.tasks;
}

async function chatReply(taskId, taskTitle, message) {
  const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, taskTitle }),
  });
  if (!res.ok) throw new Error('获取 AI 回复失败');
  const data = await res.json();
  return data.reply;
}

export { parseTasks, chatReply };
