# 智序 Prio · MVP

## 如何运行

1. **第一次运行前**，在 VS Code 终端（`Terminal → New Terminal`）里，确保当前目录是 `prio`（终端提示符路径里应该看到 `.../prio`），然后执行：

   ```
   npm install
   ```

2. 启动服务：

   ```
   node server/app.js
   ```

   看到终端打印 `智序 Prio 已启动: http://localhost:3000` 说明启动成功。

3. 在浏览器打开：

   ```
   http://localhost:3000
   ```

4. **以后再打开项目**，只需要重复第 2、3 步（`node server/app.js` + 打开浏览器），不需要重新 `npm install`（除非删除了 `node_modules` 或修改了 `package.json`）。

停止服务：在终端里按 `Ctrl + C`。

## 目录说明

```
prio/
├── index.html              前端入口
├── frontend/
│   ├── style.css            全局样式
│   ├── matrix.js             矩阵渲染 + 坐标映射 + 小球绘制
│   ├── drag.js                拖拽三态判定（小球 + 卡片重排序）
│   ├── store.js               状态管理 + localStorage 持久化
│   ├── api-client.js          唯一的后端请求出口
│   └── main.js                页面胶水逻辑（DOM 事件、面板控制）
├── server/
│   ├── app.js                  服务入口 + 路由（只做转发，不含业务逻辑）
│   ├── config.js               配置 + API key 占位
│   ├── core/
│   │   ├── Task.js              任务数据结构
│   │   └── scorer.js            Score 计算与排序
│   ├── providers/
│   │   ├── asr/                 语音识别 provider 占位目录
│   │   └── llm/mockProvider.js  假的任务拆解 + 对话回复逻辑
│   └── factory/llmFactory.js    provider 选择器
└── package.json
```

## 相对于原始需求的简化 / 调整说明

1. **新增 `frontend/main.js`**：原目录规划里没有单列"页面胶水逻辑"文件，但需要一个地方把 `store` / `matrix` / `drag` / `api-client` 串起来、处理 DOM 事件（详情面板、确认弹窗、底部输入栏）。为了不把这些逻辑硬塞进 `matrix.js` 或 `drag.js`（会破坏它们的单一职责），新增了这个文件承载页面控制逻辑，其余四个前端文件严格保持"矩阵渲染 / 拖拽判定 / 状态 / 网络请求"各自的边界。

2. **对话接口的 `taskTitle` 参数**：需求里 `POST /api/tasks/:id/chat` 的 body 只写了 `message`，但后端明确不持久化任务数据（只做无状态 AI 请求）。为了让 mock 回复能提到任务标题（例如"关于「买菜」，我建议…"），前端在请求体里额外带上了 `taskTitle` 字段。这是一个小的、向后兼容的扩展，不影响接口的核心约定。

3. **详情面板弹出位置**：按需求做了简化版判断——根据触发小球的 `x` 坐标正负决定面板出现在矩阵左侧还是右侧，若超出视口则自动切换到另一侧；纵向位置按 `y` 坐标粗略决定偏上或偏下。这是一个启发式规则，不是真正的碰撞检测，绝大多数情况下能避免遮挡其他小球，但极端布局（比如所有小球都挤在同一侧）下可能仍有轻微遮挡，后续可以升级为基于实际小球像素位置的精确避让算法。

4. **待办卡片重排序后的坐标反推**：按需求"可以简化成按新位置在相邻任务 Score 之间插值"实现——重排序后保持任务的 `x`（重要性）不变，反推出新的 `y` 使 `score = x + y` 落在目标位置相邻两个任务的 score 之间。这样矩阵里的小球会跟着轻微上下移动到对应位置，逻辑简单且和矩阵视图保持一致。

5. **矩阵越界判定**：用小球中心像素坐标是否超出矩阵面板矩形（留了小球半径的缓冲）来判断"是否已脱离矩阵可视边界"，松手时超出则弹出删除确认框，这是需求里"唯一删除入口"的直接实现。

6. **颜色兜底规则**：严格按需求实现——按 Score 排序取前 7 名映射 红/橙/黄/绿/青/蓝/紫，超出部分统一用中性灰（`#9a9a9e`）兜底。

---

## Mac 桌面应用（Electron）

项目已集成 Electron，可打包为 Mac `.app` / `.dmg`，**双击即可运行，无需手动开终端和浏览器**。

### 开发模式运行

```bash
# 首次使用需安装依赖
npm install

# 以桌面窗口方式运行（自动启动后端 + 开窗）
npm run electron
```

> 与 `npm start`（纯后端，然后手动打开浏览器 `localhost:3000`）互不干扰，两种方式可同时存在。

### 打包为 Mac .app / .dmg

```bash
# 首次打包前，如果刚装过 electron 或改过原生依赖，先重建原生模块
npx @electron/rebuild

# 打包（产出 .dmg + .app 到 dist/ 目录）
npm run dist
```

产物在 `dist/` 目录：

| 文件 | 说明 |
|------|------|
| `dist/智序 Prio-x.x.x-arm64.dmg` | DMG 安装包（用于分发） |
| `dist/mac-arm64/智序 Prio.app` | 可直接双击运行的 App |

> ⚠️ 仅支持 **macOS Apple Silicon (M 系列芯片)**，不支持 Intel Mac 和 Windows。

---

## 分发给同学（GitHub Releases）

### 前置安全警告 ⚠️

`server/config.js` 包含真实的 Dify / DeepSeek API Key，**绝不能被推送公开仓库**：

```bash
# 1. 创建不含真实 key 的模板文件
cp server/config.js server/config.example.js
# 手动编辑 server/config.example.js，把 apiKey 值替换为 "your-api-key-here"

# 2. 从 git 追踪中移除真实 config.js（文件仍保留在本地）
git rm --cached server/config.js

# 3. 加入 .gitignore
echo "server/config.js" >> .gitignore

# 4. 提交
git add .gitignore server/config.example.js
git commit -m "chore: remove config.js from tracking, add example template"
```

> 如果你的仓库是**公开的（public）**且 config.js 已被推过，旧 key 已暴露在 git 历史中——须立刻去 Dify / DeepSeek 后台**轮换 key**。分发出去的 `.app` / `.dmg` 里仍打包着 key，懂技术的人可以提取出来、消耗你的 API 额度。小范围发给几个同学风险可控；公开发布前须改为服务端中转。

### 推送代码

```bash
git add .
git commit -m "feat: add Electron desktop app packaging"
git push origin master
```

### 创建 Release 并上传 .dmg

1. 浏览器打开 `https://github.com/<你的用户名>/Prio/releases`
2. 点击 **"Create a new release"**
3. 填写：
   - **Tag version**: `v0.1.0`
   - **Release title**: `智序 Prio v0.1.0 · Mac 桌面版`
4. **上传附件**：把 `dist/智序 Prio-x.x.x-arm64.dmg` 拖入 "Attach binaries" 区域
5. 点击 **"Publish release"**

> 💡 **直接上传 .dmg** 即可，不需要再压缩成 .zip。.dmg 是 Mac 标准安装格式，同学下载后双击挂载、拖入 Applications 就能用。打包产物约 120 MB，超过 GitHub 普通文件 100 MB 限制，**必须走 Release 附件**（支持最大 2 GB），不要当普通代码文件提交。

### 同学安装说明（复制这段发给同学）

> **智序 Prio Mac 桌面版安装说明**
>
> 1. 下载 `智序 Prio-x.x.x-arm64.dmg`
> 2. 双击打开 .dmg → 把「智序 Prio」拖进 Applications 文件夹
> 3. **首次打开时**：直接双击会提示「来自身份不明的开发者」，这是正常现象（App 未签名）。
>    - 在 Applications 文件夹里**右键点击**「智序 Prio」
>    - 选择 **"打开"**
>    - 弹出的对话框里点 **"打开"**
>    - 只需做一次，以后双击就能正常运行
> 4. **仅支持 macOS (Apple Silicon)**，Intel Mac 和 Windows 电脑无法使用。
