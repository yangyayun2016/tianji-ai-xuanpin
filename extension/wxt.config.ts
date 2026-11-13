import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '天机AI选品',
    description: '天机AI选品：产品升级方向诊断，切细分市场、拆爆款元素、分析差评与差距，生成单变量升级方案并同步飞书知识库',
    permissions: ['storage', 'unlimitedStorage', 'activeTab'],
    host_permissions: ['https://mcp.sellersprite.com/*', 'https://api.openai.com/*', 'https://open.feishu.cn/*'],
    // 自定义 MCP / OpenAI 地址在设置保存时按域名申请；HTTP 仅允许本地回环适配服务。
    optional_host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*', 'http://[::1]/*'],
    action: { default_title: '天机AI选品 · 产品升级方向诊断' },
  },
});
