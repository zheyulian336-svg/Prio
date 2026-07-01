const path = require('path');
const express = require('express');
const config = require('./config');
const { getLlmProvider } = require('./factory/llmFactory');
const { createTask } = require('./core/Task');
const { sortByScore } = require('./core/scorer');

const app = express();
app.use(express.json());

// 托管前端静态资源：index.html 在项目根目录，frontend/ 是 JS/CSS
app.use(express.static(path.join(__dirname, '..')));

// 解析任务：文本 → 拆句子 → 随机坐标 → 计算 score → 包装成 Task
app.post('/api/tasks/parse', async (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text 不能为空' });
  }

  const provider = getLlmProvider();
  const rawItems = await provider.parseTasks(text);
  const tasks = sortByScore(rawItems.map((item) => createTask(item)));

  res.json({ tasks });
});

// AI 对话回复：这一版是无状态的占位回复，不做真实上下文记忆
app.post('/api/tasks/:id/chat', async (req, res) => {
  const { message } = req.body || {};
  const { taskTitle } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message 不能为空' });
  }

  const provider = getLlmProvider();
  const reply = await provider.chatReply(taskTitle || '这个任务', message);

  res.json({ reply });
});

app.listen(config.port, () => {
  console.log(`智序 Prio 已启动: http://localhost:${config.port}`);
});
