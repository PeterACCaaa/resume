---
title: "AI PR Review Assistant：把 Pull Request 变成风险地图"
published: 2026-06-04T08:00:00Z
draft: false
tags: [AI, Agent, React, TypeScript, Node.js, GitHub, Code Review]
description: "复盘七牛云 XEngineer AI PR Review 助手项目：真实 PR 解析、确定性风险地图、高风险文件上下文补全、OpenAI-compatible AI Review、追问线程和中文审查工作台。"
category: AI 技术
---

> **本文价值**：这篇文章记录的是一个 AI 代码评审工具的工程化实现。重点不是“让模型看 diff 后说几句建议”，而是怎样把 GitHub PR 拆成可追溯的风险地图，再把有限、明确、有证据的上下文交给大模型，最后产出 reviewer 可以复核、可以复制、可以继续追问的 Review 结论。

# 项目背景

这是七牛云 XEngineer 第二批次题目三项目：AI PR Review 助手。

代码评审本身不是一个新问题，但把 AI 放进代码评审里，很容易做成一个不可靠的 Demo：前端贴一个 PR 链接，后端把 diff 拼成 Prompt，模型返回一段看似专业的建议。问题是，这种做法很难回答三个关键问题：

```text
1. 模型到底看到了哪些代码？
2. 这条风险建议有没有证据？
3. reviewer 应该怎么复核它？
```

所以我没有把项目设计成“AI 直接审 PR”，而是拆成三步：

```text
GitHub PR
  -> 确定性规则扫描
  -> 高风险文件上下文补全
  -> AI Review 和追问
```

这样做的核心思路是：规则负责先把风险区域圈出来，AI 负责基于这些证据做总结、解释和复核建议。

# 1. 先拉真实 PR，而不是写死 mock 数据

输入是一个真实 GitHub PR 链接：

```text
https://github.com/owner/repo/pull/123
```

后端先做 URL 校验，解析出：

```text
owner
repo
pullNumber
```

然后调用 GitHub REST API 拉取 PR metadata 和 changed files，包括：

```text
PR 标题
作者
状态
base/head 分支
base/head sha
changed files 数量
additions / deletions
每个文件的 filename / status / additions / deletions / changes / patch
```

这一步看起来基础，但很重要。AI Review 如果不是基于真实 PR 数据，就很难证明工具能进入实际工作流。真实 PR 也会带来现实问题：GitHub rate limit、私有仓库 token、patch 可能缺失、文件可能新增或删除、raw 文件可能 404。这些边界必须在系统里显式处理。

# 2. 为什么不能直接把 diff 丢给 AI

最简单的实现是：

```text
changed files + patch
  -> Prompt
  -> AI Review
```

但这有几个问题。

第一，diff 里信息密度不均匀。某些文件只是格式化或依赖变更，某些文件可能涉及认证、权限、密钥或数据库迁移。如果全部交给模型，模型既浪费上下文，也容易把注意力放错地方。

第二，模型输出难以追溯。它可能说“这里有权限风险”，但 reviewer 不知道这个判断来自路径、patch 代码、文件上下文，还是模型自己的猜测。

第三，局部 patch 不一定足够判断问题。比如新增文件还好，修改文件只给几行 hunk，模型可能不知道函数原来的边界、导入关系和周围逻辑。

所以项目里先做确定性风险地图。

# 3. 确定性风险地图：让 AI 之前先有证据

规则扫描不是为了替代 AI，而是为了给 AI 一个可靠的起点。

当前规则覆盖这些方向：

```text
认证 / 权限 / token / RBAC 路径变更
security / crypto / secret / password 路径变更
数据库 / schema / migration 文件变更
CI / Docker / deploy 文件变更
依赖文件变更，例如 package.json、lockfile、go.mod
测试文件删除
单文件大规模变更
大 PR 变更
patch 中疑似硬编码密钥
patch 中引入 eval / new Function
patch 中引入空 catch
patch 中疑似 SQL 字符串拼接
```

每条 finding 不只是一个标签，而是一条完整的审查证据：

```text
severity      -> blocking / warning / suggestion
category      -> security / auth / data / dependency / delivery / test / reviewability
file          -> 文件路径
lineHint      -> path / file / patch hunk
title         -> 风险标题
evidence      -> 命中依据
impact        -> 可能影响
suggestion    -> 审查建议
howToVerify   -> 复核方式
confidence    -> high / medium / low
```

例如路径包含 `auth`、`token`、`rbac`，会被标为认证权限风险；patch 里新增了类似 `api_key = "..."` 的内容，会被标为疑似硬编码密钥；生产代码变更但没有测试文件变更，会被标为测试覆盖建议。

这一步的价值是让报告先变得可解释。即使不调用模型，reviewer 也能看到这次 PR 哪些地方最值得先看。

# 4. 高风险文件上下文补全

只看 patch 有时会误判，所以后端会为高风险文件补全 base/head 两侧内容。

选择策略是：

```text
findings
  -> 按文件聚合
  -> 优先 blocking
  -> 再按 riskCount 排序
  -> 最多取 6 个文件
```

对每个目标文件，分别读取：

```text
base sha 下的文件内容
head sha 下的文件内容
```

返回时标记：

```text
loaded      -> 已加载
missing     -> 文件不存在，例如新增文件的 base 版本
error       -> 加载失败
truncated   -> 内容过长被截断
size        -> 内容长度
```

这里还有一个细节：新增文件在 base 版本不存在，head 文件有时可以通过 raw URL 获取；如果获取失败，但 patch 里有完整新增行，可以从 patch 重建一个 head 内容作为 fallback。

这不是为了假装拿到了完整仓库，而是为了让模型至少在高风险点上不只看几行局部 diff。

# 5. AI Review：模型只处理被整理过的上下文

AI Review 接口不会允许前端传模型 Key，也不会让前端决定真实模型配置。前端只传：

```json
{
  "report": "...",
  "mode": "deep",
  "skills": ["security", "test", "maintainability"]
}
```

服务端从 `.env` 读取：

```text
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
OPENAI_REASONING_EFFORT
OPENAI_TEXT_VERBOSITY
```

再请求 OpenAI-compatible `/v1/responses`。

Prompt 里明确约束模型：

```text
只能基于提供的 PR metadata、changed files、patch、规则扫描结果和 file contexts 输出
不能编造未提供的代码上下文
无法确认的问题要降置信度，并写清楚需要人工复核
必须返回严格 JSON
```

输出结构固定为：

```json
{
  "summary": "3-5 句中文总结",
  "verdict": "approve | comment | request_changes",
  "confidence": "high | medium | low",
  "keyRisks": [],
  "reviewerChecklist": [],
  "commentMarkdown": "可复制到 GitHub PR 的 Review Comment"
}
```

这样前端不需要解析一段自由文本，也不会因为模型输出格式飘掉而无法展示。

# 6. Review Skills：让审查方向可控

项目里支持六类 Review Skills：

```text
Security
Tests
Maintainability
Performance
Frontend
Backend
```

每个 skill 都不是简单标签，而是带有 focus 和 instruction：

```text
Security       -> 密钥、注入、鉴权、权限边界
Tests          -> 测试缺失、边界用例、回归路径
Maintainability -> 复杂度、重复逻辑、模块边界
Performance    -> N+1、重复计算、渲染或数据处理性能
Frontend       -> React 状态、交互、可访问性、UI 回归
Backend        -> API 契约、错误处理、数据一致性
```

这样 reviewer 可以按 PR 类型选择重点。比如一个前端交互 PR 可以启用 Frontend、Tests、Maintainability；一个权限变更 PR 可以启用 Security、Backend、Tests。

这里的取舍是：技能选择只影响业务层审查策略，不暴露底层模型参数。模型、base URL、reasoning effort 仍然由服务端控制。

# 7. 服务端密钥边界

AI 工具最容易犯的错之一，是把模型配置从前端传进来。看起来灵活，实际上会带来两个问题：

```text
1. API Key 可能进入浏览器或请求日志
2. 前端可以绕过服务端预设模型和网关
```

所以 `/api/ai-review` 和 `/api/ai-followup` 都会拒绝这些字段：

```text
apiKey
api_key
openaiApiKey
OPENAI_API_KEY
baseUrl
base_url
OPENAI_BASE_URL
model
OPENAI_MODEL
```

只要客户端请求体里出现这些字段，服务端直接返回错误：

```text
AI 凭据和模型配置只能放在服务端 .env，不能由前端请求传入。
```

这个边界和简历问答系统里的密钥隔离是同一类问题：浏览器负责交互，模型密钥和模型路由必须留在服务端。

# 8. AI Review 追问：不是重新问一个无上下文问题

生成 AI Review 后，用户可能会继续问：

```text
这个结论的主要依据是什么？
哪些地方最需要人工复核？
把高风险项转成修复清单。
```

如果每次追问只把用户问题发给模型，模型就会丢失原 PR 上下文。所以服务端在生成 Review 后会保存一份上下文：

```text
resultId
report
review
mode
skills
createdAt
expiresAt
threads
```

追问时，前端传：

```json
{
  "resultId": "...",
  "threadId": "...",
  "question": "这个结论的依据是什么？"
}
```

服务端根据 `resultId` 找回原始 report 和 review，再附带当前线程历史，让模型基于同一份 PR 快照回答。

这里也做了资源边界：

```text
上下文 TTL：2 小时
最多保存 30 个 Review 上下文
每个上下文最多 12 个线程
每个线程最多 40 条消息
```

这不是持久化聊天系统，只是为一次 PR Review 会话提供可控的短期上下文。

# 9. 前端：不是长报告，而是审查工作台

前端使用 React 19 + TypeScript + Vite 实现，默认中文展示。

我没有把所有结果堆成一个长页面，而是拆成几个工作区：

```text
概览       -> PR 元信息、变更行数、风险数量、最高风险等级
优先级     -> 按风险等级展示 finding
文件       -> 变更文件列表和高风险文件上下文
AI Review  -> 模式、Review Skills、AI 结论、追问
Markdown   -> 可复制的中文审查报告
```

这种结构更接近 reviewer 的实际工作顺序：先看整体风险，再看阻塞项，再查文件，再生成 AI 总结，最后复制 Review Comment。

前端还做了几个细节：

```text
风险分布 donut
变更文件增删行比例条
base/head 上下文状态 badge
Review Skills 多选
AI 结论元信息
人工复核清单
Markdown 一键复制
追问弹窗和快捷问题
```

GSAP 只用于报告出现、风险图和界面过渡动画，不参与业务状态。业务状态仍然由 React state 和 API 返回驱动。

# 10. 返回格式兼容和测试

OpenAI-compatible 服务可能返回不同结构。项目里抽了 `extractModelContent`，按顺序兼容：

```text
choices[0].message.content
choices[0].message.content[].text
choices[0].text
output_text
output[].content[].text
message.reasoning_content
```

这类兼容逻辑必须有测试，否则很容易出现“模型返回成功，但页面拿不到文本”的问题。

当前定向测试覆盖：

```text
模型内容解析
Responses / Chat Completions 返回兼容
base URL 自动补 /v1
fast / standard / deep 模式映射
显式模式优先于 env 默认配置
Review Skills 去重和过滤 unknown
新增文件 patch fallback 上下文补全
```

对应命令是：

```bash
npm run test:ai-reviewer
npm run test:file-context
```

README 里也保留了：

```bash
npm run build
```

作为 TypeScript 和 Vite 构建验证。

# 11. 这个项目证明了什么

这个项目的核心不是“AI 会不会写 Review”。真正的工程点在于：

```text
真实 GitHub PR 数据接入
确定性规则先行
finding 证据结构
高风险文件 base/head 上下文补全
OpenAI-compatible 模型接入
服务端模型配置和密钥隔离
Prompt 和 JSON 输出协议
Review mode 和 Review Skills 策略
AI Review 追问上下文
中文审查工作台
可复制 Markdown Review Comment
定向测试覆盖关键解析和上下文 fallback
```

对我来说，它和简历问答系统、电商 AI 内容流水线是同一条主线：AI 应用不是一次模型调用，而是一个有边界的工程系统。

简历问答系统关注的是知识源、Prompt、SSE、前端结构化展示和部署闭环；AI PR Review Assistant 关注的是代码评审证据、规则扫描、上下文补全、模型输出协议和人工复核路径。

这说明我在做 AI Agent 项目时，不会只停在“调通 API”。我会先拆清楚：

```text
输入从哪里来
哪些部分必须确定性处理
哪些上下文可以交给模型
模型输出怎么约束
人如何复核
失败怎么暴露
前端怎么展示成工作流
```

# 后续可以怎么升级

当前版本已经能完成真实 PR 解析、风险地图、AI Review 和追问，但还有继续扩展的空间。

第一，规则可以配置化。现在规则写在代码里，后续可以迁移到规则配置文件或管理界面，让不同团队定义自己的风险项。

第二，AI 输出可以加 schema 校验。当前已经要求严格 JSON，后续可以加入 schema validate、自动重试和降级策略，让前端展示更稳定。

第三，可以接入 GitHub Review 闭环。现在支持复制 Markdown，后续可以支持模拟提交或真实提交 PR Review Comment。

第四，上下文策略可以继续增强。现在只补高风险文件本身，后续可以根据 import、调用链、测试文件关系扩展上下文。

第五，可以增加 demo/mock mode。比赛演示时，GitHub rate limit、网络波动或模型服务不稳定都会影响展示，mock mode 可以保证演示路径稳定。

这个项目的长期方向不是让 AI “替人拍板”，而是让 AI 帮 reviewer 更快看到风险、更清楚地复核证据、更稳定地输出审查意见。代码评审最终还是人的责任，AI 工具应该提供证据和路径，而不是制造新的黑盒。
