const config = require('../config');
const mockProvider = require('../providers/llm/mockProvider');
const difyProvider = require('../providers/llm/difyProvider');

// 根据 config.llmProvider 选出当前使用的 provider。
// 'mock' → 假数据测试；'dify' → 真实 Dify Workflow API（默认）
function getLlmProvider() {
  switch (config.llmProvider) {
    case 'mock':
      return mockProvider;
    case 'dify':
    default:
      return difyProvider;
  }
}

module.exports = { getLlmProvider };
