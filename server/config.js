// 配置中心：以后接入真实 DeepSeek / Whisper API 时，把 key 填在这里对应的字段即可。
module.exports = {
  port: process.env.PORT || 3000,

  // 当前固定使用 mock，未来切换为 'deepseek' 后 llmFactory 会返回真实 provider
  llmProvider: 'mock',

  llm: {
    deepseek: {
      apiKey: '', // TODO: 接入 DeepSeek 时在此填写真实 API key
      baseUrl: 'https://api.deepseek.com',
    },
  },

  asr: {
    whisper: {
      apiKey: '', // TODO: 接入 Whisper 时在此填写真实 API key
    },
  },
};
