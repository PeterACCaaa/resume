# 方中杰 - 前端 / 后端 / AI Agent / 全栈工程师

> 2026 届软件工程本科。求职方向聚焦 **前端开发、后端开发、AI Agent 工程化与全栈交付**。具备公司级 Web / Desktop / 移动端项目交付经验，也有 Go Admin 后端迁移、AI 问答系统、Python 内容自动化流水线等个人项目作为能力证明。

## 基本信息

- **姓名**：方中杰
- **学历**：本科 · 安徽信息工程学院 · 软件工程 · 2026 届
- **电话**：15555339309
- **邮箱**：2809726152@qq.com
- **地点**：武汉 / 全国 / 远程均可
- **期望薪资**：8K 起
- **技术社区**：Linux.do 三级用户

---

## 求职定位

我希望进入能接触真实业务系统、前后端工程、AI Agent 或全栈交付的团队。我的优势不是只会某一个框架，而是能把 **前端体验、接口契约、认证权限、状态流转、队列任务、实时通信、AI 工具链和部署链路** 串成可运行的系统。

- **求职方向**：前端开发 / 后端开发 / AI Agent 工程化 / 全栈开发
- **前端能力**：React / Vue 后台、uni-app 移动端、Vant H5、Electron 桌面端
- **后端能力**：Go / Gin / GORM、PHP / Webman、认证会话、RBAC、队列、上传、WebSocket
- **AI 能力**：OpenAI-compatible 接入、Prompt 约束、SSE 流式输出、工具链编排、Python 自动化任务
- **业务经验**：医药 SaaS、互联网问诊、商家端管理系统、AI 内容生产、电商商品工作流
- **工程习惯**：重视接口边界、显式状态、错误暴露、测试与 smoke 验证，不用空对象、静默 catch 或兜底字段掩盖协议问题

---

## 核心能力

### 前端 / 移动端 / 桌面端工程

- 熟悉 Vue 3、React、TypeScript、Vite、Element Plus、Ant Design、Vant、Pinia、Zustand、Vue Router、React Router、TanStack React Query、Tailwind CSS。
- 具备后台前端工程化能力：统一请求封装、ApiEnvelope 解包、401 刷新队列、动态路由、按钮权限、权限快照、CRUD Hook、表格列配置、搜索表单、Dialog 体系和 i18n 文案边界。
- 有跨端移动端经验：uni-app、H5、Android、iOS、微信小程序、鸿蒙配置、移动推送、腾讯 IM / TRTC、Vant 问诊 H5。
- 有桌面端经验：Electron / Tauri、preload / bridge、IPC、本地后端 ready、窗口能力、安装包构建、更新清单和 CSP 安全策略。

### 后端 / Admin Core / 系统重构

- 使用 Go / Gin / GORM / MySQL / Redis / go-redis / slog / context 构建 Admin modular monolith，按 `cmd -> bootstrap -> server -> module -> platform` 和 `route -> handler -> service -> repository -> model` 分层收口。
- 推进企业级 Admin Go 后端核心迁移，覆盖 `auth`、`session`、`captcha`、`user`、`permission`、`role`、`operationlog`、`queuemonitor`、`systemsetting`、`uploadconfig`、`uploadtoken`、`realtime` 等模块。
- 熟悉认证会话链路：Access / Refresh Token、Token Hash + Pepper、Redis token cache、MySQL session fallback、设备/IP 绑定、单端登录、refresh rotation、logout revoke。
- 熟悉 RBAC Admin 权限体系：`DIR / PAGE / BUTTON` 权限类型、动态菜单、动态路由、按钮权限码、角色授权、缓存失效、fail-closed 接口权限检查。
- 熟悉 PHP 8.1+、Webman / Workerman、Laravel、Eloquent、MySQL、Redis、Redis Queue、GatewayWorker、Crontab、PHPUnit，做过认证权限、AI Agent、SSE、WebSocket、支付钱包、订单履约、上传存储、系统通知、导出任务、日志审计和线上部署。
- 能处理后端运行边界：readiness、graceful shutdown、统一 response / app error、显式 route metadata、table-driven tests、smoke scripts、队列 worker、WebSocket connection manager。

### AI Agent / LLM 工程化 / Python 自动化

- 能把 LLM 调用落成工程系统：模型接入、Agent 配置、Prompt 管理、工具调用、流式输出、运行审计、超时取消和错误暴露。
- 熟悉 OpenAI-compatible 接口、SSE / WebSocket 实时输出、历史消息拼装、工具执行记录、结果截断、失败恢复和取消机制。
- 关注 Tool Calling 安全边界：HTTPS 白名单、SSRF 防护、只读 SQL、写操作拦截、自动 LIMIT、敏感结果控制。
- 能用 Python 承接 AI 应用中的采集、清洗、批处理、接口回放、文件处理、素材处理、模型调用验证、评估脚本和自动化任务。
- 有商品数据采集、图片/OCR、AI 卖点与口播生成、TTS 合成、SRT 字幕下载等内容生产流水线经验。
- 理解 AI 应用不是单次模型调用，而是一条可排队、可追踪、可重试、可审核的任务链；能把 Python 自动化与 Web 后台、队列、人工审核结合起来。

### 部署 / 工程纪律

- 能独立完成域名、HTTPS、Nginx 反代、Webman 多端口服务、Go API、MySQL、Redis、COS 静态资源和桌面端更新清单配置。
- 能区分 API、SSE、WebSocket、队列 worker、桌面端本地能力、移动端跨端运行和外部渠道回调的运行形态，并按协议特性隔离实现。
- 关注契约测试、接口边界和工程约束，优先让协议错误暴露出来，再按真实契约修正。

---

## 工作经历

### 小药药医药科技有限公司 · 前端开发

**时间**：2025.09.16 - 至今

- 从 0 搭建公司 SaaS 商家端前端工程，覆盖浏览器 Web 独立运行与 Electron Desktop 打包运行两条链路。
- 负责登录、租户/门店选择、总部/门店工作区切换、权限菜单、会话恢复、统一请求、状态管理和 CRUD 基础设施等核心工程能力。
- 参与荷叶问诊后台、移动端 APP、问诊内核 H5 三端迭代，覆盖远程审方、视频问诊、合理用药审查、长处方/慢病规则、移动推送与跨端跳转等医疗问诊链路。
- 在 Figma Make 生成代码质量不稳定、UI 基础组件边界不清的约束下，持续收口页面结构、组件边界和交互规范，避免设计稿代码直接污染业务层。

### 武汉晶音科技有限公司 · 全栈开发

**时间**：2025.06.11 - 2025.09.01

- 参与半导体行业交流平台微信小程序开发，基于 Java 与 Vue 2 完成页面迭代、业务逻辑优化和接口开发。
- 参与版本测试、问题修复与上线发布，基于 Git 进行协同开发与版本管理，并完成站点部署流程及测试脚本编写。

---

## 项目经历

### 个人简历智能问答系统

- **角色**：个人项目 / AI Agent 问答系统 / 全栈集成与部署
- **技术栈**：Astro、Svelte、TypeScript、Node.js、SSE、Nginx、宝塔面板、OpenAI-compatible API、Responses API、Markdown
- **相关复盘**：[个人简历智能问答系统：从静态网站到 AI 问答服务](/posts/resume-ai-chat-system/)

#### 项目概述

在个人博客与简历网站上新增 AI 问答能力。系统把 `resume.md` 和技术博客 Markdown 作为知识来源，由服务端 Node API 读取资料、约束 Prompt、调用 OpenAI-compatible 中转服务，再通过 Svelte 聊天页面以流式输出方式回答招聘场景中的项目经历、技术栈、岗位匹配度和简历亮点问题。

#### 核心工作

- 新增 `/resume-chat/` 智能问答页面，基于 Svelte 实现聊天 UI、常用问题入口、Loading、错误提示、移动端适配和消息自动滚动。
- 设计 Node.js 问答 API，读取 `src/content/spec/resume.md` 与 `src/content/posts/*.md`，将简历和博客内容组织成受控上下文，再通过 Responses API 生成回答。
- 抽出 `resume-chat-core` 共享模块，让本地开发服务、Vercel Serverless API 和宝塔线上 Node 服务复用同一套模型调用、上下文读取、响应解析和错误处理逻辑。
- 将一次性 JSON 响应升级为 SSE 流式输出：服务端请求 Responses API 时启用 `stream: true`，解析 `response.output_text.delta` 后转发为前端统一消费的 `delta / done / error` 事件。
- 前端使用 `fetch + ReadableStream + TextDecoder` 读取事件流，边接收边追加 assistant 气泡内容，并通过 `tick()` 与 `requestAnimationFrame` 在提问和回答增量更新后自动滚动到底部。
- 通过 `OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_BASE_URL` 环境变量管理模型配置，支持 OpenAI-compatible 中转服务，避免 API Key 暴露在浏览器端。
- 兼容 Responses API 与中转服务返回格式差异，统一处理 `output_text`、`output[].content[].text` 和 `choices[].message.content`，避免“请求成功但页面无答案”的问题。
- 处理本地开发 CORS 与地址差异：开发环境 API 地址跟随当前页面 hostname，本地 Node 服务按请求 Origin 允许 `localhost / 127.0.0.1 / 局域网 IP` 的 Astro 开发来源。
- 在线上宝塔部署中，将 Astro 静态站与 Node API 服务拆分部署，并通过 Nginx 将 `/api/resume-chat` 反向代理到 `127.0.0.1:8787`，形成同域访问和服务端密钥隔离。

#### 求职价值

该项目体现 AI Agent 和全栈落地能力：从 Markdown 知识源、Prompt 约束、OpenAI-compatible 接入、模型返回解析、SSE 流式输出，到前端交互、服务端密钥隔离和宝塔/Nginx 部署闭环。

### SaaS 商家端 Web / Desktop 一体化前端

- **角色**：公司项目 / 前端架构与核心开发 / 从 0 搭建
- **技术栈**：React 19、TypeScript、Vite、Electron、Ant Design、TanStack React Query、Zustand、React Router、Axios、Zod、Tailwind CSS、Electron Builder

#### 项目概述

面向药店/商家的 SaaS 管理端，同时支持浏览器 Web 运行和 Electron 桌面端本地运行。我负责从工程初始化到核心链路落地：运行时识别、接口基址配置、登录恢复、门店/总部工作区、权限菜单、统一请求、状态管理和通用 CRUD 页面能力。

#### 核心工作

- 搭建 Web / Desktop 双运行链路：Web 端使用 Vite 独立构建，桌面端通过 Electron 承载本地运行、后端 ready bridge、窗口能力和安装包构建。
- 设计运行时初始化与接口客户端配置，区分 Web、Desktop、本地后端、业务 API 等不同基础地址，避免页面代码到处判断运行环境。
- 落地登录、Token 恢复、门店选择/申请、总部/门店工作区切换、权限菜单和动态路由入口，让用户会话和业务工作区状态可恢复、可切换。
- 封装 Zustand session/users 状态、Axios 请求客户端、统一错误处理、权限快照和 i18n 文案边界，沉淀 Dialog、Search、Table、Column Settings、CRUD Hook 等可复用能力。
- 坚持强契约开发：前端不靠猜字段、空兜底和静默 catch 掩盖接口问题，优先让协议错误暴露出来，再按真实契约修正。

### Admin Go 主后端 Core Foundation 迁移

- **角色**：个人项目 / 后端架构与核心实现 / 既有 PHP Admin 系统并行重构
- **项目路径**：`E:\admin_go\admin_back_go`
- **技术栈**：Go、Gin、GORM、MySQL、Redis / go-redis、Asynq、gocron、gorilla/websocket、slog、context、RESTful API、RBAC、Token Session、COS STS、Table-driven Tests
- **相关复盘**：[Go Admin Core Foundation：从 PHP 迁移到 Gin Modular Monolith](/posts/go-admin-architecture-design/)

#### 项目概述

围绕既有企业级 Admin 系统推进 Go 主后端重构。在不破坏现有前端、登录、菜单、按钮权限和业务使用路径的前提下，将旧 PHP 系统中的认证、会话、RBAC、用户管理、日志、队列、上传和实时通信边界逐步迁移到 Go。

#### 核心工作

- 采用 Gin modular monolith，固定 `cmd -> bootstrap -> server -> module -> platform` 和 `route -> handler -> service -> repository -> model` 分层，避免 handler 查库、无意义 interface 和 service 依赖 `gin.Context`。
- 实现认证会话核心链路：登录配置、滑块验证码、密码/验证码登录、Access / Refresh Token、Token Hash + Pepper、Redis token cache、MySQL session fallback、refresh、logout、平台策略、设备/IP 绑定、单端登录和登录日志 task。
- 迁移 RBAC 核心：`Users/init` legacy adapter、动态 router、permissions、buttonCodes、`DIR / PAGE / BUTTON` 权限类型、角色授权、权限树、按钮缓存和权限变更后的用户授权缓存失效。
- 建立显式中间件边界：`AuthToken` 只做认证，`PermissionCheck` 只按 route metadata 做 fail-closed 权限检查，`OperationLog` 只记录显式配置的操作审计。
- 迁移基础管理模块：用户管理 page-init/list/edit/status/delete/batch update、个人资料、账号安全、系统设置、系统日志、操作日志、认证平台管理、权限管理和角色管理。
- 建立后台任务边界：`cmd/admin-api` 只处理 HTTP，`cmd/admin-worker` 负责队列消费和 scheduler；使用 Asynq 封装 critical/default/low lane。
- 实现上传配置与运行时 token：upload drivers/rules/settings REST 管理、VAULT_KEY secretbox、COS-first STS 临时凭证签发、服务端生成 object key、folder/ext/size 校验。
- 实现 Realtime / WebSocket baseline：认证后的 `/api/admin/v1/realtime/ws`、path-scoped browser cookie auth、local connection manager、bounded send queue、read/write pump、ping/pong 和 topic subscribe 白名单骨架。
- 建立验证门禁：当前仓库约 `229` 个 Go 文件、`70` 个测试文件、`365` 个测试函数；`go test ./...`、`go vet -p=1 ./...`、`git diff --check` 已验证通过；basic/full smoke 覆盖登录、验证码、RBAC、用户管理、队列、上传、日志和 WebSocket 基础链路。

#### 求职价值

该项目证明我能把复杂后台系统拆出真实边界，再用 Go 重建认证、会话、权限、审计、队列、上传、WebSocket 和测试体系；也说明我理解渐进式迁移节奏，能让旧系统、前端路径和新后端能力并行推进。

### Python + AI 电商内容自动化流水线

- **角色**：个人项目 / AI Agent 工作流 / Python 自动化 / 商品 AI 工作台能力
- **技术栈**：Python 自动化脚本、Chrome Extension、OCR、AI Agent、TTS、Redis Queue、PHP / Webman、MySQL、COS、SRT

#### 项目概述

围绕电商商品构建 **商品采集 -> 图片/OCR -> AI 卖点与口播生成 -> TTS 合成 -> SRT 下载** 的内容生产流水线，将运营中的重复劳动拆成可采集、可清洗、可排队、可追踪、可重试、可审核的任务链。

#### 核心工作

- 使用浏览器插件采集商品标题、价格、销量、品牌、店铺、规格、描述、评论、详情图等结构化信息。
- 使用 Python / 脚本层辅助批量数据清洗、图片/文件处理、接口调试、AI 工具链验证和重复任务自动化。
- 后端承接商品入库、图片选择、OCR 识别、Agent 生成卖点/口播词、TTS 合成和字幕文件下载。
- 使用队列承载 OCR、AI、TTS 等耗时任务，为每个阶段设计状态流转，避免任务失败后只留下模糊的“生成失败”。
- 形成 Python 负责 AI 工作流和自动化、Web 后台负责状态/权限/人工审核的业务闭环。

### 荷叶问诊医药 SaaS 三端协同系统

- **角色**：公司项目 / 核心前端开发
- **技术栈**：Vue 3、TypeScript、Vite、Element Plus、Vant、uni-app、Pinia、Axios / luch-request、腾讯云 IM / TRTC、阿里云移动推送、Aegis

#### 项目概述

项目覆盖 PC 管理后台、跨端移动 APP 和问诊内核 H5，围绕互联网医院与药店问诊场景，将患者、医生、药师、商家、处方、审方、视频通话、移动推送和合规规则串成可用链路。

#### 核心亮点

- 后台端承接远程审方、药师工作台、处方记录、问诊数据、GSP 商品资料和合理用药规则配置，处理动态路由、租户 `tenant-id`、Token 刷新队列和全局错误提示。
- 移动端基于 uni-app 支持 H5、Android、iOS、微信小程序和鸿蒙配置，接入阿里云推送、腾讯 IM / TRTC，处理处方待审、视频来电、订单通知、权限申请和跨端页面跳转。
- 问诊内核 H5 使用 Vue 3 + Vant 承载患者问诊、医生接诊、药师审方、第三方问诊流转、商品提交、套餐购买和消息中心等移动端业务。
- 在第三方问诊链路中梳理详情拉取、合理用药审查、药品/诊断归一化、审查弹窗拦截和后续流转，避免把医疗规则判断散落在页面事件里。
- 排查过长处方/慢病仍提示超量的问题，定位到“慢病病情选择”和“后台慢病目录药品配置”是两层不同规则，问题根因不在前端状态，而在规则目录匹配。

### AI Make 本地 UIUX Patch Compiler

- **角色**：个人项目 / 产品设计与独立开发 / Codex Skill + npm CLI
- **技术栈**：Node.js、JavaScript ESM、Codex Skill、Prompt Engineering、React、TypeScript、Tailwind CSS、Multi-Agent Workflow

#### 项目概述

围绕 Figma Make 工作流沉淀的本地开发者 UI 生成 Skill。它把一句 UI 需求编译成 **visual brief、page composition blueprint、ui-spec、prompt-pack、agent handoff、任务拆分和 review gates**，再交给 Codex / Claude Code / Cursor 等本地编码 Agent 在现有项目中生成可审查、可验证、可合并的前端 patch。

#### 核心工作

- 设计从自然语言 UI 需求到本地代码 patch 的编译链路：先确定视觉方向和首屏结构，再生成规格、提示词包、Agent 交接文档和验证要求。
- 实现 `ai-make` CLI 与 Codex Skill 入口，支持读取目标项目上下文、生成运行目录、拆分任务、输出单任务 Agent prompt，并记录本轮 patch 的 review gate。
- 通过 `visual-brief` 和 `page composition blueprint` 约束首屏框架、hero、指标节奏、证据区、行动区和细节层，避免生成“能跑但像模板”的页面。
- 强约束生成边界：不猜后端字段、不添加 fallback 字段、不绕过项目架构、不擅自引入新 UI 库、不生成巨大单文件页面。

---

## 技术文章 / 证明材料

- [个人简历智能问答系统：从静态网站到 AI 问答服务](/posts/resume-ai-chat-system/)
- [Go Admin Core Foundation：从 PHP 迁移到 Gin Modular Monolith](/posts/go-admin-architecture-design/)
- [Go 语言基本学习路线：从变量到项目入门](/posts/go-beginner-learning-route/)
- [从调 API 到 Agent 工程化：把 AI 能力做成可治理系统](/posts/ai-agent-engineering-practice/)
- [Agent 工程学习路线：从 LLM 到可上线智能体系统](/posts/understanding-ai-ecosystem/)
- [电商 AI 口播生成系统：OCR、Agent、TTS 与队列闭环](/posts/ecommerce-ai-script-generation/)
- [Webman 分层架构：Controller 到 Model 的边界治理](/posts/webman-layered-architecture/)
- [SSE 流式对话系统：AI 实时输出的生产级实现](/posts/sse-streaming-chat/)
- [医疗问诊 SaaS 三端协同：后台、移动端与问诊内核怎么串起来](/posts/medical-inquiry-saas-three-clients/)

---

## 教育经历

### 安徽信息工程学院 · 软件工程 · 本科

**毕业时间**：2026.06

---

## 简历亮点

- **前端能承接复杂业务**：做过 React / Vue 后台工程、uni-app 移动端、Vant H5、Electron 桌面端、权限菜单、状态管理和跨端运行。
- **后端能力有项目证据**：Go Admin 迁移覆盖认证会话、RBAC、用户管理、队列、上传、WebSocket、日志和测试门禁。
- **AI Agent 不是只调接口**：做过简历问答系统和电商内容自动化流水线，覆盖知识源、Prompt、模型接入、流式输出、任务队列、人工审核和部署闭环。
- **全栈能形成闭环**：能把前端交互、后端接口、AI 工具链、部署链路和线上问题排查串起来交付。
