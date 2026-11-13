import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '天机AI选品',
    description: '天机AI选品：产品升级方向诊断，切细分市场、拆爆款元素、分析差评与差距，生成单变量升级方案并同步飞书知识库',
    permissions: ['storage', 'unlimitedStorage', 'activeTab'],
    host_permissions: ['https://mcp.sellersprite.com/*', 'https://api.openai.com/*', 'https://open.feishu.cn/*'],
    // 使用 OpenAI 兼容的中转地址时，在设置页保存时再单独申请该域名的权限
    optional_host_permissions: ['https://*/*'],
    action: { default_title: '天机AI选品 · 产品升级方向诊断' },
  },
});
