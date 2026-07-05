// 配置中心：集中管理所有第三方 API key 和全局设置。
module.exports = {
  port: process.env.PORT || 3000,

  // 当前使用 Dify provider；切换回 'mock' 即可恢复假数据测试
  llmProvider: 'dify',

  dify: {
    baseUrl: 'https://api.dify.ai/v1',
    workflow: {
      // 任务拆解 Workflow：语音/文字 → 理解拆任务 → 估坐标
      apiKey: 'app-XtUV2giBOufxShhc2t5Aw7F6',
    },
    chatflow: {
      // 任务对话 Chatflow：任务详情页 AI 对话，有多轮记忆 + 个性化画像
      apiKey: 'app-4n1bV4DnerVux21s5FOEi9Ha',
    },
  },

  llm: {
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '', // 个性化画像生成用；也支持环境变量
      baseUrl: 'https://api.deepseek.com',
    },
  },

  asr: {
    whisper: {
      apiKey: '', // TODO: 接入 Whisper 时在此填写真实 API key
    },
  },

  // 默认用户 ID（暂无真实用户系统）
  defaultUserId: 'default_user',
};
