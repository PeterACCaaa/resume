---
title: "电商 AI 口播生成系统：基于小龙虾 OpenClaw 的自动化闭环"
published: 2026-02-18T10:00:00Z
draft: false
tags: [置顶, AI, Agent, OpenClaw, 小龙虾, Skills, Redis, 异步]
description: "基于小龙虾 OpenClaw、OCR、Redis 异步队列、Agent 编排和 TTS 合成的电商口播自动生成系统，展示 AI 框架落地到业务流水线的能力。"
category: AI 技术
---

> **本文价值**：这篇文章保留的是小龙虾 OpenClaw 的落地经验：从私有化部署、Workflow 编排、Skills 二次开发，到商品信息 OCR、Agent 生成、TTS 合成和异步队列闭环。

# 业务背景

做电商直播的朋友都知道，每个商品都需要一段口播词。主播拿到商品后，要提炼卖点、组织话术、录制音频。一个品可能要花 30 分钟到 1 小时。

如果一天要上 50 个品呢？纯人工根本扛不住。

我们的目标是：把这个流程自动化。选品 → OCR 识别商品信息 → AI 生成口播词 → TTS 合成语音，全链路打通，人只需要做最终审核。

这套项目里，小龙虾 OpenClaw 不是一个单纯的聊天入口，而是承担了 AI 自动化中台的角色：负责接入模型、编排工作流、沉淀可复用 Skills，并把业务后台、浏览器插件、OCR、TTS 和审核环节串成一条稳定流水线。

## 系统架构

```
浏览器插件（选品）
    ↓
后台管理系统（商品管理）
    ↓
小龙虾 OpenClaw Gateway
    ↓
OpenClaw Workflow（商品口播生成流水线）
    ├── goods-ocr Skill（图片 → 文字）
    ├── script-generator Skill（文字 → 口播词）
    ├── tts-synthesizer Skill（口播词 → 音频）
    └── review-sync Skill（结果回写与人工审核）
    ↓
Redis 异步队列 / 业务数据库
```

整个系统分为四个核心环节，每个环节都被封装成 OpenClaw Skill。OpenClaw 负责工作流编排和上下文传递，Redis 负责耗时任务的削峰和异步消费，业务数据库负责保存商品状态和审核结果。

## 小龙虾 OpenClaw 落地方式

落地时我把系统拆成三层：

1. 业务层：Chrome 插件和后台管理系统只负责商品采集、人工审核、状态展示，不直接关心模型调用细节。
2. OpenClaw 层：部署 gateway 和 workspace，配置模型供应商、Workflow 和 Skills，统一承接 AI 节点编排。
3. 执行层：OCR、TTS、Redis 消费者和业务数据库负责真正的耗时任务、结果落库和失败记录。

在 OpenClaw workspace 里，核心能力被拆成几个可复用 Skill：

```text
skills/
  goods-ocr/
    SKILL.md              # 输入图片列表，输出按顺序合并后的 OCR 文本
  script-generator/
    SKILL.md              # 输入商品标题、OCR 文本、运营提示词，输出卖点和口播词
  tts-synthesizer/
    SKILL.md              # 输入口播词，输出音频地址和合成状态
  review-sync/
    SKILL.md              # 输入生成结果，回写业务后台并触发人工审核
```

这里的关键不是把所有逻辑都塞进大模型，而是把每个节点的输入、输出和边界写清楚。比如 `script-generator` 只接收 `goods_id`、`title`、`ocr_text`、`tips`、`agent_id` 这些明确字段，只输出 `point`、`script_text`、`model_origin`，避免模型凭空猜业务字段。

## 状态机设计

这是整个系统的骨架。一个商品从录入到完成，经历 7 个状态：

```
待处理(1) → OCR中(2) → 已识别(3) → 生成中(4) → 已生成(5) → TTS中(6) → 已完成(7)
                                                                          ↘ 失败(8)
```

```php
class GoodsEnum
{
    // 状态流转定义
    public static array $statusFlow = [
        1 => [2],      // 待处理 → OCR中
        2 => [3, 8],   // OCR中 → 已识别 / 失败
        3 => [4],      // 已识别 → 生成中
        4 => [5, 8],   // 生成中 → 已生成 / 失败
        5 => [6],      // 已生成 → TTS中
        6 => [7, 8],   // TTS中 → 已完成 / 失败
    ];

    /**
     * 校验状态流转是否合法
     */
    public static function canTransit(int $from, int $to): bool
    {
        return in_array($to, self::$statusFlow[$from] ?? []);
    }
}
```

为什么要用状态机而不是简单的标记？因为并发场景下，如果不校验状态流转，可能出现：

- 用户点了两次 OCR，同一个商品被识别两次
- OCR 还没完成，用户就点了生成，导致用空数据去生成
- 失败的商品被重新触发，但状态没有正确回退

状态机保证了每次操作都是合法的，避免了这些边界问题。

## 异步队列：为什么不能同步？

OCR、AI 生成、TTS 这三个操作有一个共同特点：慢。

- OCR 识别一张图片：2-5 秒
- AI 生成一段口播词：5-15 秒
- TTS 合成一段音频：3-8 秒

如果同步处理，用户点一下按钮要等 10-30 秒才能得到响应。而且这些操作都依赖外部 API，网络波动、服务降级都可能导致超时。

所以必须异步。用户点击后立即返回"任务已提交"，后台把任务交给 OpenClaw Workflow，由 Workflow 再按节点投递到 Redis 队列慢慢处理。

```php
class GoodsModule extends BaseModule
{
    public function ocr($request): array
    {
        $param = $this->validate($request, GoodsValidate::ocr());

        // 1. 校验状态：只有"待处理"和"已识别"可以触发 OCR
        $goods = $this->dep(GoodsDep::class)->getById($param['id']);
        if (!in_array($goods->status, [1, 3])) {
            return [null, 400, '当前状态不允许执行 OCR'];
        }

        // 2. 更新状态为"OCR中"
        $this->dep(GoodsDep::class)->transitStatus($param['id'], 2);

        // 3. 触发 OpenClaw Workflow，由 goods-ocr Skill 执行识别
        $this->openClawClient->runWorkflow('goods-script-flow', [
            'entry' => 'goods-ocr',
            'goods_id' => $param['id'],
            'image_list' => $param['image_list_success'],
            'callback' => '/api/goods/openclaw/callback',
        ]);

        return [null, 0, 'OCR 任务已提交'];
    }
}
```

注意这里的设计：先改业务状态，再触发 OpenClaw Workflow。这样即使 Workflow 触发失败，前端也能看到任务已经进入"OCR中"。如果 Skill 执行失败，OpenClaw 的 callback 会把状态改为"失败"，并记录失败节点和错误信息。

## OpenClaw Workflow 与队列消费者设计

消费者是整个系统最核心的部分，但它不再直接承载完整业务编排。OpenClaw Workflow 决定下一步应该执行哪个 Skill，Redis 消费者只负责把耗时任务稳定跑完，并把结果回传给 OpenClaw 或业务后台。

```php
class GoodsProcess implements Consumer
{
    public string $queue = 'goods-slow-queue';

    public function consume($data): void
    {
        try {
            match ($data['action']) {
                'goods-ocr' => $this->handleOcr($data),
                'script-generator' => $this->handleGenerate($data),
                'tts-synthesizer' => $this->handleTts($data),
            };
        } catch (\Throwable $e) {
            // 统一错误处理：更新状态为失败，记录错误信息
            $this->markFailed($data['goods_id'], $e->getMessage());
            Log::error("Goods queue failed", [
                'action' => $data['action'],
                'goods_id' => $data['goods_id'],
                'error' => $e->getMessage(),
            ]);
        }
    }
}
```

对应的 Workflow 设计很直接：

```text
goods-script-flow
  ├─ goods-ocr
  │   └─ 成功后进入 script-generator
  ├─ script-generator
  │   └─ 成功后进入 tts-synthesizer
  ├─ tts-synthesizer
  │   └─ 成功后进入 review-sync
  └─ review-sync
      └─ 回写业务后台，等待人工确认
```

我在这里保留 Redis，是因为 OCR 和 TTS 都是典型的慢任务。OpenClaw 更适合做编排、上下文传递和工具调用边界管理，Redis 更适合做削峰、重试和消费者扩容，两者职责分开后更容易排查问题。

### OCR 处理

OCR 的核心是把商品详情图片里的文字提取出来。电商商品图片通常包含大量信息：规格参数、卖点描述、促销信息等。

```php
private function handleOcr(array $data): void
{
    $goods = Goods::find($data['goods_id']);
    $images = $data['image_list'];

    // 逐张识别，合并结果
    $ocrResults = [];
    foreach ($images as $imageUrl) {
        $result = $this->ocrService->recognize($imageUrl);
        if ($result) {
            $ocrResults[] = $result;
        }
    }

    $ocrText = implode("\n\n", $ocrResults);

    // 更新商品数据
    $goods->update([
        'ocr' => $ocrText,
        'image_list_success' => json_encode($images),
        'status' => 3, // 已识别
    ]);
}
```

### AI 生成：OpenClaw Skill + 模型的组合

这是最有意思的部分。AI 生成不是简单地把 OCR 文本丢给大模型，而是通过 `script-generator` Skill 来编排。Skill 负责声明输入字段、系统提示词、输出结构和失败处理，业务后台只需要提交明确参数。

`script-generator/SKILL.md` 的核心约束大致如下：

```md
# script-generator

## 输入

- goods_id: 商品 ID
- title: 商品标题
- ocr_text: OCR 识别文本
- tips: 运营补充要求
- agent_id: 口播智能体 ID

## 输出

- point: 商品卖点
- script_text: 主播口播词
- model_origin: 实际使用模型

## 规则

- 不得编造商品规格、价格、功效
- 只基于 title、ocr_text、tips 生成内容
- 输出必须能被业务后台结构化解析
```

```php
private function handleGenerate(array $data): void
{
    $goods = Goods::find($data['goods_id']);

    // 获取指定的智能体（前端选择的）
    $agent = AiAgents::find($data['agent_id']);
    if (!$agent) {
        // 降级：使用默认的口播词生成智能体
        $agent = $this->dep(AiAgentsDep::class)
            ->getActiveByScene('goods_script');
    }

    $model = AiModels::find($agent->model_id);

    // 构建 OpenClaw Skill 输入，避免让模型直接猜业务上下文
    $skillInput = [
        'goods_id' => $goods->id,
        'title' => $goods->title,
        'ocr_text' => $goods->ocr,
        'tips' => $goods->tips,
        'agent_id' => $agent->id,
    ];

    // 记录 AI 运行日志
    $run = $this->createRun($agent, 'goods_script');
    $this->createStep($run, 'OPENCLAW_SKILL_INPUT', json_encode($skillInput));

    // 调用小龙虾 OpenClaw Skill
    $result = $this->openClawClient->runSkill(
        'script-generator',
        $skillInput,
        ['model' => $model->name]
    );

    $this->createStep($run, 'OPENCLAW_SKILL_OUTPUT', $result->content, [
        'tokens_in' => $result->usage->prompt_tokens,
        'tokens_out' => $result->usage->completion_tokens,
    ]);

    // 解析结果：提取卖点和口播词
    [$point, $scriptText] = $this->parseGenerateResult($result->content);

    $goods->update([
        'point' => $point,
        'script_text' => $scriptText,
        'model_origin' => $model->name,
        'status' => 5, // 已生成
    ]);

    $this->finalizeRun($run, 'success');
}
```

在 `script-generator` Skill 内部，仍然需要把商品标题、OCR 文本、用户自定义提示词组合成结构化 Prompt。区别是这段逻辑被封装在 Skill 里，业务后台只负责传入字段，不直接拼 Prompt：

```php
private function buildUserPrompt(Goods $goods): string
{
    $parts = ["商品标题：{$goods->title}"];

    if ($goods->ocr) {
        $parts[] = "商品详情（OCR 识别结果）：\n{$goods->ocr}";
    }

    if ($goods->tips) {
        $parts[] = "额外要求：{$goods->tips}";
    }

    $parts[] = "请根据以上信息，生成商品卖点和口播词。";

    return implode("\n\n", $parts);
}
```

这里有一个设计决策：为什么让用户选择智能体，而不是在 OpenClaw 里固定一个 Prompt？

因为不同品类的商品需要不同的话术风格。美妆产品需要精致优雅的表达，数码产品需要参数对比和性价比分析，食品需要突出口感和新鲜度。通过不同的智能体配置（不同的 System Prompt 和模型策略），OpenClaw 可以在同一个 `script-generator` Skill 下输出更贴合品类特点的口播词。

## OpenClaw 部署与运行配置

这类业务不能只在本地跑 demo，真正落地时要考虑部署、日志、密钥和回滚。我采用的是私有化部署方式，把 OpenClaw gateway 和业务后台部署在同一内网环境，外部只暴露后台 API 和必要的回调入口。

部署时重点处理了几件事：

1. 模型配置：在 OpenClaw 侧统一配置可用模型，业务后台只传 `agent_id` 和场景，不直接暴露模型密钥。
2. workspace 隔离：电商口播相关 Workflow 和 Skills 放在独立 workspace，避免和其他自动化任务混在一起。
3. callback 回写：每个 Skill 完成后通过 callback 回写 `goods_id`、`node`、`status`、`payload`、`error`，业务侧只接受结构化字段。
4. 日志追踪：业务后台记录 run、step、tokens、模型名称和失败节点；OpenClaw 侧记录 Skill 输入输出，方便复盘。
5. 失败回滚：Workflow 失败时不直接重跑全链路，而是根据失败节点回退到正确状态，例如 OCR 失败回到"待处理"，TTS 失败回到"已生成"。

整体配置思路是：OpenClaw 管 AI 能力和工作流，业务系统管商品状态和人工审核。这样后续换模型、调 Prompt、加新 Skill，都不需要大改后台主流程。

## 前端工作台设计

前端采用全屏工作台的设计，把商品编辑变成一个沉浸式的工作流程。

```
┌─────────────────────────────────────────────────────┐
│ 编辑商品  [已生成]                              [×] │
├─────────────────────────────────────────────────────┤
│ 详情图片（点击选择需要识别的图片）                    │
│ [☑ img1] [☑ img2] [☐ img3] [☑ img4] ...           │
│ [OCR识别（3张已选）]                                 │
├────────────┬───────────┬───────────┬────────────────┤
│ 商品信息   │ AI提示词  │ 卖点      │ 口播词         │
│            │           │           │                │
│ 标题: xxx  │ 智能体:   │ (textarea)│ (textarea)     │
│ 链接: xxx  │ [选择▾]   │           │                │
│ OCR结果:   │ 提示词:   │           │                │
│ (readonly) │ (textarea)│           │                │
│            │ [生成]    │           │                │
├────────────┴───────────┴───────────┴────────────────┤
│                              [取消]  [确认]          │
└─────────────────────────────────────────────────────┘
```

四列布局的设计思路：

1. 商品信息：基础数据和 OCR 结果，只读参考
2. AI 提示词工程：选择智能体、填写额外提示、触发生成
3. 卖点：AI 生成的卖点，可以手动编辑调整
4. 口播词：最终的口播词，可以手动润色

这个布局让用户能同时看到输入（左边）和输出（右边），方便对比和调整。操作完 OCR 或生成后，弹窗自动关闭并刷新列表，用户可以看到状态变化。

## 浏览器插件：选品入口

选品是整个流程的起点。我们开发了一个 Chrome 扩展，用户在电商平台浏览商品时，一键就能把商品信息抓取到系统里。

插件采用 Manifest V3，支持淘宝、京东、天猫、拼多多等主流平台。每个平台有独立的 scraper，因为不同平台的页面结构差异很大。

```javascript
// 平台识别 + 对应 scraper 调用
const scrapers = {
    'taobao.com': scrapeTaobao,
    'jd.com': scrapeJD,
    'tmall.com': scrapeTmall,
    'pinduoduo.com': scrapePDD,
};

function detectPlatform(url) {
    for (const [domain, scraper] of Object.entries(scrapers)) {
        if (url.includes(domain)) return { platform: domain, scraper };
    }
    return null;
}
```

抓取的数据包括：商品标题、主图、详情图列表、价格、链接。这些数据通过 API 提交到后台，自动创建一条商品记录，状态为"待处理"。

## 性能数据

系统上线后的实际数据：

| 指标 | 人工处理 | 系统处理 | 提升 |
|------|---------|---------|------|
| 单品处理时间 | 30-60 分钟 | 20-40 秒 | 60-90x |
| 日处理量 | 10-20 品 | 200+ 品 | 10-20x |
| 口播词质量 | 依赖个人水平 | 稳定中上 | 一致性更好 |

当然，AI 生成的口播词不是完美的，有时候需要人工润色。但它把 80% 的重复劳动自动化了，人只需要做最后 20% 的创意调整。

## 踩过的坑

1. OCR 图片顺序很重要：电商详情图是有逻辑顺序的，打乱顺序会导致 OCR 结果混乱，AI 生成的口播词也会逻辑不通
2. Skill 输入输出要强约束：直接把 OCR 文本丢给 AI 效果很差，需要在 OpenClaw Skill 里明确输入字段、输出结构和禁止编造规则
3. 异步队列要有超时机制：外部 API 可能无限等待，消费者必须设置超时，否则会阻塞整个队列
4. 状态机要有"重试"入口：失败的商品需要能重新触发，但要回退到正确的前置状态
5. OpenClaw 和业务状态不能混用：Workflow 状态解决编排问题，商品状态解决业务展示和审核问题，两套状态要通过 callback 明确同步
6. Skills 要版本化：Prompt、输出格式和模型配置都会变，生产环境不能直接覆盖旧 Skill，需要保留版本和灰度入口

## 写在最后

这个系统的核心价值不是"用了 AI"，也不是简单接入了小龙虾 OpenClaw，而是把一个复杂的业务流程拆解成了可自动化的步骤，然后用合适的技术（OpenClaw Workflow、Skills、异步队列、状态机、智能体编排）把它们串起来。

AI 是其中的一个环节，OpenClaw 提供的是更稳定的编排和扩展底座。真正让它产生业务价值的，是把部署、权限、日志、失败恢复、人工审核和业务状态一起设计进去。
