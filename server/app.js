const path = require('path');
const express = require('express');
const config = require('./config');
const { getLlmProvider } = require('./factory/llmFactory');
const { createTask } = require('./core/Task');
const { sortByScore } = require('./core/scorer');
const { getProfile, insertDragEvent, getRecentDragEvents, upsertProfile } = require('./db');

const app = express();
app.use(express.json({ limit: '1mb' }));

// 托管前端静态资源：index.html 在项目根目录，frontend/ 是 JS/CSS
app.use(express.static(path.join(__dirname, '..')));

// 内存中维护每个任务的 conversation_id
const conversationMap = new Map();

const CHATFLOW_URL = `${config.dify.baseUrl}/chat-messages`;
const CHATFLOW_API_KEY = config.dify.chatflow.apiKey;

// 从请求体提取 user_id，未提供时 fallback 到默认值
function getUserId(req) {
  return (req.body && req.body.user_id) || config.defaultUserId;
}

// ---- 路由 ----

// 解析任务：文字 → Dify Workflow 拆解 → 包装成 Task
app.post('/api/tasks/parse', async (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text 不能为空' });
  }

  try {
    const userId = getUserId(req);
    const provider = getLlmProvider();
    const rawItems = await provider.parseTasks(text.trim(), userId);
    const tasks = sortByScore(rawItems.map((item) => createTask(item)));
    res.json({ tasks });
  } catch (err) {
    console.error('[parse] 解析任务失败:', err.message);
    res.status(500).json({ error: '解析任务失败: ' + err.message });
  }
});

// AI 对话回复：接入 Dify Chatflow API
app.post('/api/tasks/:id/chat', async (req, res) => {
  const { message, taskTitle } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message 不能为空' });
  }

  const userId = getUserId(req);
  const taskId = req.params.id;
  const taskContext = taskTitle || '未知任务';
  const conversationId = conversationMap.get(taskId) || '';
  const userProfile = getProfile(userId);

  console.log(`[chat] Chatflow API，userId: ${userId}，taskId: ${taskId}，conv_id: "${conversationId}"`);

  try {
    const apiRes = await fetch(CHATFLOW_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHATFLOW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: message,
        inputs: { task_context: taskContext, user_profile: userProfile },
        conversation_id: conversationId,
        response_mode: 'blocking',
        user: userId,
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error(`[chat] Chatflow 错误 (${apiRes.status}):`, errText);
      return res.json({ reply: '抱歉，AI 服务暂时不可用，请稍后再试。' });
    }

    const json = await apiRes.json();
    const reply = json.answer || '（AI 未返回内容）';
    if (json.conversation_id) conversationMap.set(taskId, json.conversation_id);
    res.json({ reply });
  } catch (err) {
    console.error('[chat] 异常:', err.message);
    res.json({ reply: '抱歉，网络似乎出了点问题，请稍后再试。' });
  }
});

// 拖拽记录上报
app.post('/api/events/drag', (req, res) => {
  const { taskTitle, fromX, fromY, toX, toY, fromQuadrant, toQuadrant } = req.body || {};
  if (!taskTitle) return res.status(400).json({ error: 'taskTitle 不能为空' });

  const userId = getUserId(req);
  try {
    insertDragEvent({
      userId, taskTitle,
      fromX: Number(fromX) || 0, fromY: Number(fromY) || 0,
      toX: Number(toX) || 0, toY: Number(toY) || 0,
      fromQuadrant: fromQuadrant || '', toQuadrant: toQuadrant || '',
    });
    console.log(`[drag] userId=${userId} "${taskTitle}" ${fromQuadrant} → ${toQuadrant}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[drag] 写入失败:', err.message);
    res.status(500).json({ error: '写入失败' });
  }
});

const DEEPSEEK_URL = `${config.llm.deepseek.baseUrl}/v1/chat/completions`;
const DEEPSEEK_API_KEY = config.llm.deepseek.apiKey;

// 个性化画像刷新
app.post('/api/profile/refresh', async (req, res) => {
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'DeepSeek API Key 未配置' });
  }

  const userId = getUserId(req);
  try {
    const events = getRecentDragEvents(userId, 50);
    if (events.length === 0) {
      upsertProfile(userId, '');
      return res.json({ ok: true, profile: '', eventCount: 0 });
    }

    const eventSummary = events.map((e, i) =>
      `${i + 1}. 任务"${e.task_title}"从${e.from_quadrant}拖到${e.to_quadrant}`
    ).join('\n');

    console.log(`[profile] DeepSeek API，userId: ${userId}，${events.length} 条记录`);

    const aiRes = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: `你是一个私人时间管理助手。以下是用户拖拽调整任务优先级的操作记录（按时间倒序）：\n${eventSummary}\n\n请根据这些行为，分析用户的偏好和习惯，生成一段不超过 200 字的个性化画像摘要。直接输出画像文字，不要加任何前缀或解释。` }],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('[profile] DeepSeek 错误:', errText);
      return res.status(500).json({ error: `DeepSeek API 调用失败 (${aiRes.status})` });
    }

    const aiJson = await aiRes.json();
    const profileText = (aiJson.choices?.[0]?.message?.content || '').trim().slice(0, 200);
    upsertProfile(userId, profileText);
    console.log(`[profile] 画像已更新，userId: ${userId}，长度: ${profileText.length}`);
    res.json({ ok: true, profile: profileText, eventCount: events.length });
  } catch (err) {
    console.error('[profile] 异常:', err.message);
    res.status(500).json({ error: '画像生成失败: ' + err.message });
  }
});

app.listen(config.port, () => {
  console.log(`智序 Prio 已启动: http://localhost:${config.port}`);
});
