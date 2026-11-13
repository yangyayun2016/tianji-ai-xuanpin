# 天机AI选品

亚马逊产品开发与老品升级工具，使用 npm workspaces 管理两个入口：

- **Web Demo（根目录）**：保留原有 Vite + React 19 + Tailwind CSS v4 的 9 Tab 演示，使用弹力手表表带案例数据。
- **Chrome 插件（`extension/`）**：完整合入原「超级产品开发 / 产品升级方向诊断」的 WXT + React + TypeScript 源码，支持 ASIN 诊断、历史报告、Excel 导出、设置及飞书团队知识库。

## 目录

```text
src/                     Web Demo 的组件、9 Tab、计算与案例数据
public/                  Web Demo 静态资源
extension/
  assets/                插件公共样式
  core/                  市场、属性、差评、评分计算及原有单元测试
  demo/                  模拟卖家精灵、AI、知识库数据
  entrypoints/           popup、report、options、kb 页面及 background
  services/              卖家精灵、AI、飞书、诊断流程及原有单元测试
  utils/                 本地存储、页面导航、依赖组装、Excel 导出
  DESIGN.md              原始设计草案（包含后续规划）
package-lock.json        两个入口共用的依赖锁文件
```

仓库运行不依赖原机器上的 D 盘目录。客户调研文件 `Wynona`、压缩包、依赖目录、构建缓存和用户凭据均不属于产品源码。

## 安装依赖

使用 Node.js 22.12+ 和 npm 10+，在**仓库根目录**执行：

```bash
npm ci
```

这会同时安装 Web 和插件依赖，并自动执行插件的 `wxt prepare`，生成被忽略的 `extension/.wxt/` 类型文件。首次有意更新依赖或修改 `package.json` 后使用 `npm install`，并保留更新后的根目录锁文件。SheetJS 使用插件原有的官方 CDN 包，安装时需能访问 npm registry 和 `cdn.sheetjs.com`。

## 运行 Web Demo

```bash
npm run dev
```

打开终端显示的地址（默认 `http://localhost:5173`）。

```bash
npm run build:web
npm run preview
```

Web 生产产物在 `dist/`。现有 9 Tab 全部保留：概览、细分市场、对标与元素、属性矩阵、差评死法、差距矩阵、升级方案、成本与包装、假设卡。评分权重与资源匹配可调整，差评行可查看原话。

Web 使用示例数据，不连接真实 API；「同步到飞书 / 重新确认市场」仍为界面占位。计算逻辑见 [`src/lib/calc.ts`](src/lib/calc.ts)，数据见 [`src/data/demo-watch-band.ts`](src/data/demo-watch-band.ts)。

## 构建并加载 Chrome 插件

在仓库根目录执行：

```bash
npm run build:extension
```

该命令先生成 WXT 类型并进行 TypeScript 检查，再构建 Chrome Manifest V3 插件，产物在 `extension/.output/chrome-mv3/`。

1. 在 Chrome 打开 `chrome://extensions/`。
2. 打开「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择本仓库的 **`extension/.output/chrome-mv3`** 目录。
4. 固定「天机AI选品」图标，打开弹窗，点击「查看演示」即可用模拟宠物饮水机数据体验全流程，无需凭据，也不调用业务 API。
5. 修改代码并重新构建后，在扩展程序页点击插件的「重新加载」。

开发时可运行 `npm run dev:extension`；WXT 开发模式的 Chrome 产物目录为 `extension/.output/chrome-mv3-dev/`，以终端输出为准。

同时构建两个入口：

```bash
npm run build
```

## 插件配置与实际诊断

在插件「设置」页填写自己的卖家精灵 MCP 密钥、OpenAI API Key（或兼容服务的接口地址和模型）。凭据在运行时保存到本机浏览器的 `chrome.storage.local`；源码不预填团队 App ID、Secret、API Key 或多维表格标识，也不需要 `.env`。普通网页预览的存储回退为 `localStorage`。

飞书为可选配置：未填写时可以正常诊断，但不写知识库。需要同步时，填写自己的飞书应用 App ID、App Secret、多维表格链接与更新人，并按设置页说明授予表格权限，再点击「连接并建表」。插件会建立细分市场、爆款元素、标签体系、升级假设四张表。

输入美国站 ASIN → 切分并人工确认细分市场 → 对标与元素拆解 → 属性矩阵与差评诊断 → 差距矩阵 → 单变量升级方案与七维评分 → 假设卡。报告可导出 Excel；知识库支持查看元素和回写假设测试状态。更多流程与飞书配置见 [`extension/README.md`](extension/README.md)。

## 单元测试与检查

在仓库根目录执行：

```bash
npm test                    # 运行插件现有全部 Vitest 单元测试
npm run test:extension      # 同上，可单独调用
npm run typecheck:extension # WXT 类型生成 + 插件 TypeScript 检查
npm run lint               # Web Demo 静态检查
npm run build              # Web TypeScript/Vite + 插件 TypeScript/WXT 构建
```

插件原有 22 个测试位于 `extension/core/core.test.ts` 和 `extension/services/services.test.ts`，覆盖市场划分、差评、矩阵、成本与评分、演示诊断流程和模拟飞书调用，不需要真实凭据。`extension/tests/setup.ts` 明确使用 jsdom 的本地存储并在每例前清空，兼容 Node 26 的原生 `localStorage`。Web Demo 原仓库没有单元测试套件，其验证使用 TypeScript、lint 和生产构建。

也可以在根目录运行 `npm test --workspace extension`，或进入 `extension/` 后运行 `npm test`。

## 源码与数据边界

`.gitignore` 在所有工作区层级排除 `node_modules/`、`.output/`、`.wxt/`、`dist/`、`.env` / `.env.*`、常见密钥文件、日志、压缩包及 `Wynona/`。不要把浏览器导出的设置、真实 API 响应、飞书或卖家精灵凭据加入源码。

演示数据为示意。真实卖家精灵、AI 和飞书凭据的端到端调用尚未实测；FBA 内置费率是参考值，原插件设计草案中的市场历史、需求地图等规划不表示已经实现。
