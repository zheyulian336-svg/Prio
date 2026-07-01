const config = require('../config');
const mockProvider = require('../providers/llm/mockProvider');

// 根据 config.llmProvider 选出当前使用的 provider。
// 目前只有 mock 一个实现，未来接入 DeepSeek 后在这里加一个 case 分支即可。
function getLlmProvider() {
  switch (config.llmProvider) {
    case 'mock':
    default:
      return mockProvider;
  }
}

module.exports = { getLlmProvider };
