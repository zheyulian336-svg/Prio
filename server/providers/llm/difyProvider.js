// Dify LLM provider：接入 Dify 任务拆解 Workflow。
// parseTasks(text, userId) → 调 Workflow API 拆解任务并返回 [{title, x, y}]

const config = require('../../config');
const { getProfile } = require('../../db');

const WORKFLOW_URL = `${config.dify.baseUrl}/workflows/run`;
const API_KEY = config.dify.workflow.apiKey;

async function parseTasks(text, userId) {
  const uid = userId || config.defaultUserId;
  const userProfile = getProfile(uid);

  const body = {
    inputs: { text, audio: '', user_profile: userProfile },
    response_mode: 'blocking',
    user: uid,
  };

  console.log(`[difyProvider] Workflow API（文字），userId: ${uid}`);

  const res = await fetch(WORKFLOW_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Dify Workflow 调用失败 (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const rawTasks = json?.data?.outputs?.task;
  if (!Array.isArray(rawTasks)) {
    console.error('[difyProvider] 未预期的返回结构:', JSON.stringify(json));
    return [];
  }

  return rawTasks.map((t) => ({
    title: t.title,
    x: Number(t.x) || 0,
    y: Number(t.y) || 0,
  }));
}

// 占位回复（对话路由已直接调 Chatflow API）
async function chatReply(taskTitle, message) {
  const templates = [
    `收到，我会帮你留意「${taskTitle}」这件事～`,
    `关于「${taskTitle}」，我建议你先拆解成更小的步骤。`,
    `好的，已经记下了你对「${taskTitle}」的补充。`,
    `这个任务看起来不复杂，抽个 25 分钟专注处理应该就够了。`,
    `我理解了，会持续帮你跟踪「${taskTitle}」的进展。`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

module.exports = { parseTasks, chatReply };
