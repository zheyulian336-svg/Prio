// 假的 LLM provider：用规则拆句子 + 随机坐标模拟"AI 拆解任务"。
// 接口形状保持和未来真实 DeepSeek provider 一致：parseTasks(text) / chatReply(taskTitle, message)
// 这样以后接入真实 API 时，只需要新增 deepseekProvider.js 实现同样的两个方法，替换 llmFactory 里的选择即可。

const SPLIT_REGEX = /[、，,;；\n]+/;

async function parseTasks(text) {
  const rawTitles = text
    .split(SPLIT_REGEX)
    .map((s) => s.trim())
    .filter(Boolean);

  return rawTitles.map((title) => ({
    title,
    x: randomCoord(),
    y: randomCoord(),
  }));
}

async function chatReply(taskTitle, message) {
  const templates = [
    `收到，我会帮你留意「${taskTitle}」这件事～`,
    `关于「${taskTitle}」，我建议你先拆解成更小的步骤。`,
    `好的，已经记下了你对「${taskTitle}」的补充："${message}"。`,
    `这个任务看起来不复杂，抽个 25 分钟专注处理应该就够了。`,
    `我理解了，会持续帮你跟踪「${taskTitle}」的进展。`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

function randomCoord() {
  return Math.round((Math.random() * 2 - 1) * 100) / 100;
}

module.exports = { parseTasks, chatReply };
