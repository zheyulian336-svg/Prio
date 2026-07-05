// Dify LLM provider：接入 Dify 任务拆解 Workflow。
// parseTasks(text, userId) → 调 Workflow API 拆解任务并返回 [{title, x, y}]

const config = require('../../config');
const { getProfile } = require('../../db');

const WORKFLOW_URL = `${config.dify.baseUrl}/workflows/run`;
const FILE_UPLOAD_URL = `${config.dify.baseUrl}/files/upload`;
const API_KEY = config.dify.workflow.apiKey;

// 将 base64 音频先上传到 Dify 文件接口，获取文件 ID
async function uploadAudioFile(base64Audio, userId, mimeType) {
  // base64 → Buffer
  const buffer = Buffer.from(base64Audio, 'base64');

  // 根据 MIME 类型取文件扩展名
  const ext = mimeType.includes('wav') ? 'wav' : (mimeType.includes('webm') ? 'webm' : 'ogg');

  // 用 FormData 上传（Node 22+ 内置 FormData）
  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: mimeType }), `recording.${ext}`);
  formData.append('user', userId);

  console.log('[difyProvider] 上传音频文件…');
  const res = await fetch(FILE_UPLOAD_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Dify 文件上传失败 (${res.status}): ${errText}`);
  }

  const json = await res.json();
  console.log(`[difyProvider] 文件上传成功:`, JSON.stringify(json));
  return json;
}

// 支持两种输入：纯文字（text）和音频（audio base64）
// Workflow 内部已配置好转写逻辑，后端只负责转发
async function parseTasks(text, userId, audioBase64, mimeType) {
  const uid = userId || config.defaultUserId;
  const userProfile = getProfile(uid);

  // 构建 inputs：文字模式只传 text，音频模式把文件对象注入 audio 变量
  const inputs = {
    text: text || '',
    user_profile: userProfile,
  };

  if (audioBase64) {
    // 先上传到 Dify 文件接口，获取 file id
    const uploadResult = await uploadAudioFile(audioBase64, uid, mimeType);
    // 将文件对象注入 audio 变量（这是 Dify 文件类型输入变量的正确传法）
    inputs.audio = {
      type: 'audio',
      transfer_method: 'local_file',
      upload_file_id: uploadResult.id,
    };
  }
  // 注意：没有音频时不传 audio 字段，避免条件分支误判

  const body = {
    inputs,
    response_mode: 'blocking',
    user: uid,
  };

  const mode = audioBase64 ? '音频' : '文字';
  console.log(`[difyProvider] Workflow API（${mode}），请求体:`, JSON.stringify(body).slice(0, 300));

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
  console.log('[difyProvider] Workflow 返回:', JSON.stringify(json).slice(0, 500));
  const rawTasks = json?.data?.outputs?.task;
  if (!Array.isArray(rawTasks)) {
    console.error('[difyProvider] 未预期的返回结构:', JSON.stringify(json));
    return [];
  }

  console.log(`[difyProvider] 解析到 ${rawTasks.length} 个任务`);
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
