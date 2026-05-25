<script lang="ts">
import Icon from "@iconify/svelte";

type Tone = "premium-tech" | "minimal" | "vibrant";
type PreviewMode = "desktop" | "mobile";

type ProductBrief = {
	productName: string;
	category: string;
	priceRange: string;
	targetAudience: string;
	sellingPoints: string;
	brandTone: Tone;
	pageGoal: string;
};

type Benefit = {
	title: string;
	body: string;
};

type UseCase = {
	title: string;
	body: string;
};

type Faq = {
	question: string;
	answer: string;
};

type Seo = {
	title: string;
	description: string;
	keywords: string[];
};

type PageStyle = {
	themeName: string;
	visualMood: string;
	primaryColor: string;
	accentColor: string;
	backgroundColor: string;
	surfaceColor: string;
	textColor: string;
	mutedTextColor: string;
	heroBackground: string;
	cardRadius: string;
	buttonRadius: string;
	imageTreatment: "clean-cutout" | "soft-shadow" | "studio-card";
	productFrame: string;
};

type ShopifySection = {
	type: string;
	name: string;
	blocks: Array<{
		type: string;
		settings: Record<string, string | string[]>;
	}>;
};

type DtcPage = {
	brief?: ProductBrief;
	hero: {
		eyebrow: string;
		heading: string;
		subheading: string;
		cta: string;
	};
	benefits: Benefit[];
	useCases: UseCase[];
	specs: Array<{ label: string; value: string }>;
	reviews: Array<{ quote: string; author: string }>;
	faqs: Faq[];
	seo: Seo;
	style: PageStyle;
	shopifySections: ShopifySection[];
};

type ProductImage = {
	name: string;
	dataUrl: string;
};

type DtcCopilotResponse = {
	page?: DtcPage;
	model?: string;
	error?: string;
};

const API_URL = import.meta.env.DEV
	? getDevApiUrl()
	: "/api/dtc-page-copilot";

const toneOptions: Array<{ value: Tone; label: string; description: string }> = [
	{
		value: "premium-tech",
		label: "高端科技",
		description: "适合智能硬件、出海科技品牌",
	},
	{
		value: "minimal",
		label: "极简高级",
		description: "适合生活方式、审美驱动产品",
	},
	{
		value: "vibrant",
		label: "年轻活力",
		description: "适合社媒传播、礼品和潮流产品",
	},
];

const sampleBrief: ProductBrief = {
	productName: "LinguaBud AI Translation Earbuds",
	category: "AI 翻译耳机",
	priceRange: "$129 - $199",
	targetAudience: "跨境商务人士、留学生、独立旅行者",
	sellingPoints: "实时双向翻译\n低延迟对话\n28 小时续航\n轻量佩戴\n离线常用语包",
	brandTone: "premium-tech",
	pageGoal: "提升移动端加购率，并让用户快速理解跨语言沟通价值",
};

const defaultStyle: PageStyle = {
	themeName: "清爽科技绿",
	visualMood: "可信、清晰、适合移动端购买决策",
	primaryColor: "#1f7a6d",
	accentColor: "#e6a23c",
	backgroundColor: "#f4f7f4",
	surfaceColor: "#ffffff",
	textColor: "#13201c",
	mutedTextColor: "#60716b",
	heroBackground: "#e6ece7",
	cardRadius: "0.55rem",
	buttonRadius: "0.5rem",
	imageTreatment: "soft-shadow",
	productFrame: "#d7e3de",
};

let brief: ProductBrief = { ...sampleBrief };
let page: DtcPage = createDtcPage(brief);
let activeTone: Tone = brief.brandTone;
let previewMode: PreviewMode = "desktop";
let exportNotice = "";
let error = "";
let loading = false;
let modelName = "本地模拟";
let imageNotice = "";
let productImage: ProductImage | null = null;

function useSampleBrief(): void {
	brief = { ...sampleBrief };
	activeTone = brief.brandTone;
	page = createDtcPage(brief);
	error = "";
	modelName = "本地模拟";
	imageNotice = "";
	productImage = null;
	exportNotice = "已载入面试演示样例";
}

function clearBrief(): void {
	brief = {
		productName: "",
		category: "",
		priceRange: "",
		targetAudience: "",
		sellingPoints: "",
		brandTone: activeTone || "premium-tech",
		pageGoal: "",
	};
	error = "";
	exportNotice = productImage
		? "已清空商品信息，可直接让 AI 根据图片补全"
		: "已清空商品信息，可上传图片后让 AI 补全";
}

function setTone(tone: Tone): void {
	activeTone = tone;
	brief.brandTone = tone;
}

async function generatePage(): Promise<void> {
	if (loading) return;

	error = "";
	const validationError = validateBriefBeforeGenerate();
	if (validationError) {
		error = validationError;
		exportNotice = "请先补充必要信息";
		return;
	}

	loading = true;

	try {
		const response = await fetch(API_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				brief: { ...brief, brandTone: activeTone || "premium-tech" },
				productImage,
			}),
		});
		const data = (await response.json().catch(() => null)) as
			| DtcCopilotResponse
			| null;

		if (!response.ok) {
			throw new Error(data?.error || "AI 生成失败");
		}

		if (!isDtcPage(data?.page)) {
			throw new Error("接口返回结构不符合 DTC 页面协议");
		}

		if (data.page.brief) {
			brief = data.page.brief;
			activeTone = data.page.brief.brandTone;
		}

		page = data.page;
		modelName = data?.model || "OpenAI";
		exportNotice = productImage
			? `已通过 ${modelName} 分析图片并补全商品页`
			: `已通过 ${modelName} 生成结构化商品页`;
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
		exportNotice = "真实 API 暂不可用，可使用本地模拟演示";
	} finally {
		loading = false;
	}
}

function validateBriefBeforeGenerate(): string {
	if (productImage) return "";

	if (!brief.productName.trim()) return "请填写商品名称";
	if (!brief.category.trim()) return "请填写商品类目";
	if (!brief.targetAudience.trim()) return "请填写目标用户";
	if (!brief.pageGoal.trim()) return "请填写页面目标";
	if (!brief.sellingPoints.trim() && !productImage) {
		return "请填写核心卖点，或上传商品图让 AI 辅助提炼";
	}

	return "";
}

function generateMockPage(): void {
	page = createDtcPage({ ...brief, brandTone: activeTone });
	error = "";
	modelName = "本地模拟";
	exportNotice = "已生成本地模拟结构化商品页";
}

async function handleImageUpload(event: Event): Promise<void> {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;

	error = "";
	imageNotice = "";

	try {
		productImage = {
			name: file.name,
			dataUrl: await createCompressedImageDataUrl(file),
		};
		imageNotice = "已读取商品图，AI 生成时会参考图片风格";
	} catch (err) {
		productImage = null;
		imageNotice = "";
		error = err instanceof Error ? err.message : String(err);
	} finally {
		input.value = "";
	}
}

function removeProductImage(): void {
	productImage = null;
	imageNotice = "已移除商品图";
}

async function copyExportJson(): Promise<void> {
	const json = exportJson();

	try {
		await navigator.clipboard.writeText(json);
		exportNotice = "页面配置 JSON 已复制";
	} catch {
		exportNotice = "当前浏览器不允许复制，可以手动选中 JSON";
	}
}

function downloadExportJson(): void {
	const blob = new Blob([exportJson()], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `${slugify(brief.productName || "dtc-page")}-sections.json`;
	link.click();
	URL.revokeObjectURL(url);
	exportNotice = "JSON 文件已导出";
}

function exportJson(): string {
	return JSON.stringify(
		{
			product: {
				name: page.brief?.productName || brief.productName,
				category: page.brief?.category || brief.category,
				priceRange: page.brief?.priceRange || brief.priceRange,
				targetAudience: page.brief?.targetAudience || brief.targetAudience,
				brandTone: page.brief?.brandTone || activeTone,
				pageGoal: page.brief?.pageGoal || brief.pageGoal,
			},
			inferredBrief: page.brief,
			seo: page.seo,
			style: page.style,
			sections: page.shopifySections,
		},
		null,
		2,
	);
}

function getDevApiUrl(): string {
	if (typeof window === "undefined") {
		return "http://localhost:8788/api/dtc-page-copilot";
	}

	return `${window.location.protocol}//${window.location.hostname}:8788/api/dtc-page-copilot`;
}

function isDtcPage(value: DtcPage | undefined): value is DtcPage {
	if (!value) return false;

	return (
		Boolean(value.hero?.heading) &&
		Array.isArray(value.benefits) &&
		Array.isArray(value.useCases) &&
		Array.isArray(value.specs) &&
		Array.isArray(value.reviews) &&
		Array.isArray(value.faqs) &&
		Array.isArray(value.seo?.keywords) &&
		Boolean(value.style?.primaryColor) &&
		Array.isArray(value.shopifySections)
	);
}

function previewStyleVars(style: PageStyle): string {
	return [
		`--store-primary:${style.primaryColor}`,
		`--store-accent:${style.accentColor}`,
		`--store-bg:${style.backgroundColor}`,
		`--store-surface:${style.surfaceColor}`,
		`--store-text:${style.textColor}`,
		`--store-muted:${style.mutedTextColor}`,
		`--store-hero-bg:${style.heroBackground}`,
		`--store-frame:${style.productFrame}`,
		`--store-card-radius:${style.cardRadius}`,
		`--store-button-radius:${style.buttonRadius}`,
	].join(";");
}

async function createCompressedImageDataUrl(file: File): Promise<string> {
	if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
		throw new Error("请上传 PNG、JPG 或 WEBP 商品图");
	}

	if (file.size > 8 * 1024 * 1024) {
		throw new Error("商品图不能超过 8MB");
	}

	const bitmap = await createImageBitmap(file);
	const maxSide = 960;
	const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
	const width = Math.max(1, Math.round(bitmap.width * scale));
	const height = Math.max(1, Math.round(bitmap.height * scale));
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");

	if (!context) {
		throw new Error("当前浏览器不支持图片压缩");
	}

	context.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();

	return canvas.toDataURL("image/jpeg", 0.82);
}

function createDtcPage(source: ProductBrief): DtcPage {
	const productName = source.productName.trim() || "AI 商品";
	const category = source.category.trim() || "DTC 商品";
	const audience = source.targetAudience.trim() || "海外独立站用户";
	const goal = source.pageGoal.trim() || "提升页面理解效率和加购转化";
	const tone = source.brandTone;
	const points = parseSellingPoints(source.sellingPoints);
	const voice = getToneVoice(tone);
	const hero = {
		eyebrow: `${voice.eyebrow} / ${category}`,
		heading: buildHeroHeading(productName, tone),
		subheading: `${productName} 为${audience}设计，把${points[0]}、${points[1]}和${points[2]}放进一条更顺畅的购买路径。`,
		cta: tone === "vibrant" ? "立即体验升级" : "查看商品体验",
	};
	const benefits = points.slice(0, 5).map((point, index) => ({
		title: point,
		body: buildBenefitBody(point, productName, audience, goal, index),
	}));
	const useCases = buildUseCases(audience, productName);
	const specs = [
		{ label: "价格", value: source.priceRange.trim() || "待定价" },
		{ label: "类目", value: category },
		{ label: "目标用户", value: audience },
		{ label: "页面目标", value: goal },
	];
	const faqs = buildFaqs(productName, points);
	const reviews = [
		{
			quote: `页面先解释 ${productName} 为什么值得关注，再引导我进入购买决策。`,
			author: "DTC 用户洞察草稿",
		},
		{
			quote: "卖点清楚、回答简短，移动端购买按钮始终容易触达。",
			author: "转化评审记录",
		},
	];
	const seo = {
		title: `${productName} | 面向${audience}的${category}`,
		description: `${productName} 面向${audience}，突出${points.slice(0, 3).join("、")}。页面围绕独立站购买路径组织内容，帮助用户更快理解价值并进入决策。`,
		keywords: [
			category,
			productName,
			...points.slice(0, 4),
			"DTC",
			"Shopify",
		],
	};
	const style = buildLocalStyle(tone);

	return {
		hero,
		benefits,
		useCases,
		specs,
		reviews,
		faqs,
		seo,
		style,
		shopifySections: buildShopifySections(
			hero,
			benefits,
			useCases,
			faqs,
			seo,
			style,
		),
	};
}

function parseSellingPoints(raw: string): string[] {
	const items = raw
		.split(/[\n,，;；]/)
		.map((item) => item.trim())
		.filter(Boolean);
	const fallback = ["核心价值清晰", "移动端路径顺畅", "信任信息完整"];

	return [...items, ...fallback].slice(0, 5);
}

function getToneVoice(tone: Tone): { eyebrow: string; adjective: string } {
	if (tone === "minimal") {
		return { eyebrow: "克制高级的独立站体验", adjective: "calm" };
	}

	if (tone === "vibrant") {
		return { eyebrow: "适合社媒传播的商品表达", adjective: "energetic" };
	}

	return { eyebrow: "面向品牌出海的 DTC 页面", adjective: "precise" };
}

function buildLocalStyle(tone: Tone): PageStyle {
	if (tone === "minimal") {
		return {
			...defaultStyle,
			themeName: "极简生活方式",
			visualMood: "克制、留白、适合审美驱动商品",
			primaryColor: "#4d625d",
			accentColor: "#b9a36b",
			backgroundColor: "#f7f5ee",
			heroBackground: "#ecebe3",
			productFrame: "#dedbd0",
			cardRadius: "0.35rem",
			buttonRadius: "0.35rem",
			imageTreatment: "clean-cutout",
		};
	}

	if (tone === "vibrant") {
		return {
			...defaultStyle,
			themeName: "年轻活力橙",
			visualMood: "明快、适合社媒传播和礼品场景",
			primaryColor: "#d95f36",
			accentColor: "#2d7dd2",
			backgroundColor: "#fff7ef",
			heroBackground: "#f3eadf",
			productFrame: "#f7dcc9",
			cardRadius: "0.75rem",
			buttonRadius: "0.65rem",
			imageTreatment: "studio-card",
		};
	}

	return { ...defaultStyle };
}

function buildHeroHeading(productName: string, tone: Tone): string {
	if (tone === "minimal") {
		return `${productName}，让日常选择更简单。`;
	}

	if (tone === "vibrant") {
		return `用 ${productName} 让每个场景更轻松。`;
	}

	return `${productName}，让跨语言沟通更快、更清晰。`;
}

function buildBenefitBody(
	point: string,
	productName: string,
	audience: string,
	goal: string,
	index: number,
): string {
	const verbs = ["降低决策成本", "缩短理解路径", "增强购买信任", "减少移动端阻力", "支撑复购记忆"];
	return `${productName} 将“${point}”转成用户能快速理解的页面证据，帮助${audience}${verbs[index] || "形成明确判断"}，服务于“${goal}”。`;
}

function buildUseCases(audience: string, productName: string): UseCase[] {
	return [
		{
			title: "首屏快速理解",
			body: `${audience}进入页面后，先看到产品价值、适用场景和明确 CTA，而不是被参数列表淹没。`,
		},
		{
			title: "购买前建立信任",
			body: `${productName} 的卖点、评价、保障和 FAQ 被放在同一条判断路径里，降低下单前的不确定感。`,
		},
		{
			title: "移动端购买路径",
			body: "移动端保留价格、规格和加购动作的可见性，让用户在阅读过程中随时能进入下一步。",
		},
	];
}

function buildFaqs(productName: string, points: string[]): Faq[] {
	return [
		{
			question: `${productName} 适合哪些用户？`,
			answer: "适合已经有明确使用场景、但需要更快理解产品价值的海外独立站访问者。",
		},
		{
			question: "为什么页面要先讲场景再讲参数？",
			answer: `因为用户先判断“和我有没有关系”，再判断细节。${points[0]} 等参数需要放进真实使用情境里。`,
		},
		{
			question: "这些内容可以接 Shopify 吗？",
			answer: "可以。当前导出的 sections/blocks JSON 可以继续映射到 Liquid section、metafields 或内部运营配置。",
		},
		{
			question: "AI 生成内容能直接上线吗？",
			answer: "不建议直接上线。更稳的流程是 AI 生成初稿，人工审核品牌语气、事实准确性和合规风险后再发布。",
		},
	];
}

function buildShopifySections(
	hero: DtcPage["hero"],
	benefits: Benefit[],
	useCases: UseCase[],
	faqs: Faq[],
	seo: Seo,
	style: PageStyle,
): ShopifySection[] {
	return [
		{
			type: "hero",
			name: "商品首屏",
			blocks: [
				{ type: "eyebrow", settings: { text: hero.eyebrow } },
				{ type: "heading", settings: { text: hero.heading } },
				{ type: "subheading", settings: { text: hero.subheading } },
				{ type: "button", settings: { label: hero.cta } },
			],
		},
		{
			type: "benefits",
			name: "卖点卡片",
			blocks: benefits.map((benefit) => ({
				type: "benefit",
				settings: {
					title: benefit.title,
					body: benefit.body,
				},
			})),
		},
		{
			type: "use_cases",
			name: "使用场景",
			blocks: useCases.map((useCase) => ({
				type: "case",
				settings: {
					title: useCase.title,
					body: useCase.body,
				},
			})),
		},
		{
			type: "faq",
			name: "FAQ",
			blocks: faqs.map((faq) => ({
				type: "question",
				settings: {
					question: faq.question,
					answer: faq.answer,
				},
			})),
		},
		{
			type: "seo",
			name: "SEO 元信息",
			blocks: [
				{
					type: "metadata",
					settings: {
						title: seo.title,
						description: seo.description,
						keywords: seo.keywords,
					},
				},
			],
		},
		{
			type: "style",
			name: "视觉样式",
			blocks: [
				{
					type: "theme",
					settings: {
						themeName: style.themeName,
						visualMood: style.visualMood,
						primaryColor: style.primaryColor,
						accentColor: style.accentColor,
						backgroundColor: style.backgroundColor,
						surfaceColor: style.surfaceColor,
						textColor: style.textColor,
						mutedTextColor: style.mutedTextColor,
						heroBackground: style.heroBackground,
						cardRadius: style.cardRadius,
						buttonRadius: style.buttonRadius,
						imageTreatment: style.imageTreatment,
						productFrame: style.productFrame,
					},
				},
			],
		},
	];
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}
</script>

<section class="copilot-shell" data-tone={activeTone}>
	<div class="toolbar">
		<div>
			<p class="eyebrow">AI DTC 体验演示</p>
			<h2>DTC 商品页助手</h2>
		</div>
		<div class="toolbar-actions">
			<button type="button" class="ghost-button" on:click={useSampleBrief}>
				<Icon icon="material-symbols:data-object-rounded" />
				示例商品
			</button>
			<button type="button" class="ghost-button" on:click={clearBrief}>
				<Icon icon="material-symbols:delete-sweep-outline-rounded" />
				清空信息
			</button>
			<button type="button" class="ghost-button" on:click={generateMockPage}>
				<Icon icon="material-symbols:offline-bolt-rounded" />
				本地模拟
			</button>
			<button
				type="button"
				class="primary-button"
				disabled={loading}
				on:click={generatePage}
			>
				<Icon icon="material-symbols:auto-awesome-rounded" />
				{loading ? "生成中" : "AI 生成"}
			</button>
		</div>
	</div>

	<div class="status-row">
		<span>
			<Icon icon="material-symbols:hub-rounded" />
			{modelName}
		</span>
		{#if error}
			<strong>{error}</strong>
		{/if}
	</div>

	<div class="workbench">
		<form class="brief-panel" on:submit|preventDefault={generatePage}>
			<div class="panel-heading">
				<span class="step">01</span>
				<div>
					<h3>商品 Brief</h3>
					<p>输入商品、用户和品牌调性，生成 DTC 商品页结构。</p>
				</div>
			</div>

			<label>
				<span>商品名称</span>
				<input
					bind:value={brief.productName}
					placeholder={productImage ? "可留空，AI 会根据商品图推断" : ""}
				/>
			</label>

			<div class="two-columns">
				<label>
					<span>商品类目</span>
					<input
						bind:value={brief.category}
						placeholder={productImage ? "可留空，AI 会自动识别" : ""}
					/>
				</label>
				<label>
					<span>价格区间</span>
					<input
						bind:value={brief.priceRange}
						placeholder={productImage ? "可留空，AI 会给出建议价格带" : ""}
					/>
				</label>
			</div>

			<label>
				<span>目标用户</span>
				<textarea
					bind:value={brief.targetAudience}
					rows="3"
					placeholder={productImage ? "可留空，AI 会根据商品图推断人群" : ""}
				></textarea>
			</label>

			<label>
				<span>核心卖点</span>
				<textarea
					bind:value={brief.sellingPoints}
					rows="5"
					placeholder={productImage ? "可留空，AI 会从图片和商品形态提炼卖点" : ""}
				></textarea>
			</label>

			<div class="image-upload-block">
				<div class="upload-copy">
					<span>商品样品图</span>
					<p>上传商品图后，AI 会参考外观、材质和主色生成页面视觉风格。</p>
				</div>
				<div class="upload-box">
					{#if productImage}
						<img src={productImage.dataUrl} alt="商品样品预览" />
						<div class="upload-actions">
							<span>点击图片区域可更换</span>
							<button type="button" on:click={removeProductImage}>
								移除图片
							</button>
						</div>
					{:else}
						<span class="upload-trigger">
							<Icon icon="material-symbols:add-photo-alternate-rounded" />
							<strong>上传商品图</strong>
							<small>点击选择 PNG / JPG / WEBP，自动压缩后用于 AI 分析</small>
						</span>
					{/if}
					<input
						class="native-file-input"
						type="file"
						accept="image/png,image/jpeg,image/webp"
						on:change={handleImageUpload}
					/>
				</div>
				{#if imageNotice}
					<p class="image-notice">{imageNotice}</p>
				{/if}
			</div>

			<div class="tone-group" aria-label="品牌调性">
				{#each toneOptions as option}
					<button
						type="button"
						class:active={activeTone === option.value}
						on:click={() => setTone(option.value)}
					>
						<strong>{option.label}</strong>
						<span>{option.description}</span>
					</button>
				{/each}
			</div>

			<label>
				<span>页面目标</span>
				<textarea
					bind:value={brief.pageGoal}
					rows="3"
					placeholder={productImage ? "可留空，AI 会自动补全" : ""}
				></textarea>
			</label>
		</form>

		<div class="strategy-panel">
			<div class="panel-heading">
				<span class="step">02</span>
				<div>
					<h3>结构化输出</h3>
					<p>按首屏、卖点、场景、FAQ 和 SEO 拆成可审核模块。</p>
				</div>
			</div>

			<div class="output-section">
				<div class="section-title">
					<Icon icon="material-symbols:ads-click-rounded" />
					<span>首屏文案</span>
				</div>
				<h4>{page.hero.heading}</h4>
				<p>{page.hero.subheading}</p>
			</div>

			<div class="output-section">
				<div class="section-title">
					<Icon icon="material-symbols:bolt-rounded" />
					<span>核心卖点</span>
				</div>
				<div class="mini-list">
					{#each page.benefits as benefit}
						<div>
							<strong>{benefit.title}</strong>
							<p>{benefit.body}</p>
						</div>
					{/each}
				</div>
			</div>

			<div class="output-section">
				<div class="section-title">
					<Icon icon="material-symbols:help-rounded" />
					<span>FAQ</span>
				</div>
				<div class="faq-list">
					{#each page.faqs as faq}
						<details>
							<summary>{faq.question}</summary>
							<p>{faq.answer}</p>
						</details>
					{/each}
				</div>
			</div>

			<div class="output-section">
				<div class="section-title">
					<Icon icon="material-symbols:search-rounded" />
					<span>SEO</span>
				</div>
				<strong>{page.seo.title}</strong>
				<p>{page.seo.description}</p>
				<div class="keyword-row">
					{#each page.seo.keywords.slice(0, 6) as keyword}
						<span>{keyword}</span>
					{/each}
				</div>
			</div>

			<div class="output-section">
				<div class="section-title">
					<Icon icon="material-symbols:palette-rounded" />
					<span>视觉样式</span>
				</div>
				<strong>{page.style.themeName}</strong>
				<p>{page.style.visualMood}</p>
				<div class="swatch-row">
					<span style={`background:${page.style.primaryColor}`}></span>
					<span style={`background:${page.style.accentColor}`}></span>
					<span style={`background:${page.style.backgroundColor}`}></span>
					<span style={`background:${page.style.productFrame}`}></span>
				</div>
			</div>
		</div>

		<div class="preview-panel">
			<div class="panel-heading preview-heading">
				<span class="step">03</span>
				<div>
					<h3>商品页预览</h3>
					<p>把结构化内容渲染成可展示的独立站页面。</p>
				</div>
				<div class="preview-switch" aria-label="预览模式">
					<button
						type="button"
						class:active={previewMode === "desktop"}
						on:click={() => (previewMode = "desktop")}
					>
						<Icon icon="material-symbols:desktop-windows-rounded" />
					</button>
					<button
						type="button"
						class:active={previewMode === "mobile"}
						on:click={() => (previewMode = "mobile")}
					>
						<Icon icon="material-symbols:phone-iphone-rounded" />
					</button>
				</div>
			</div>

			<div
				class:mobile={previewMode === "mobile"}
				class="storefront-preview"
				style={previewStyleVars(page.style)}
			>
				<section class="store-hero">
					<div>
						<p>{page.hero.eyebrow}</p>
						<h3>{page.hero.heading}</h3>
						<span>{page.hero.subheading}</span>
						<button type="button">{page.hero.cta}</button>
					</div>
					<div
						class="product-visual"
						class:has-image={Boolean(productImage)}
						data-treatment={page.style.imageTreatment}
						aria-label="产品视觉"
					>
						{#if productImage}
							<img src={productImage.dataUrl} alt="上传的商品样品" />
						{:else}
							<div class="earbud left"></div>
							<div class="earbud right"></div>
							<div class="signal">AI</div>
						{/if}
					</div>
				</section>

				<section class="store-benefits">
					{#each page.benefits.slice(0, 3) as benefit}
						<article>
							<Icon icon="material-symbols:check-circle-rounded" />
							<h4>{benefit.title}</h4>
							<p>{benefit.body}</p>
						</article>
					{/each}
				</section>

				<section class="store-use-cases">
					<h4>围绕购买路径组织内容</h4>
					{#each page.useCases as useCase}
						<div>
							<strong>{useCase.title}</strong>
							<p>{useCase.body}</p>
						</div>
					{/each}
				</section>

				<section class="store-proof">
					<div>
						<strong>4.8/5</strong>
						<span>待审核信任模块</span>
					</div>
					<p>“{page.reviews[0].quote}”</p>
				</section>

				<section class="store-faq">
					<h4>快速答疑</h4>
					{#each page.faqs.slice(0, 3) as faq}
						<details>
							<summary>{faq.question}</summary>
							<p>{faq.answer}</p>
						</details>
					{/each}
				</section>

				<div class="sticky-cta">
					<span>{brief.priceRange}</span>
					<button type="button">加入购物车</button>
				</div>
			</div>
		</div>
	</div>

	<div class="export-panel">
		<div class="panel-heading">
			<span class="step">04</span>
			<div>
				<h3>页面配置 JSON</h3>
				<p>演示如何把页面内容组织成 section/block，后续可映射到 Liquid 或 metafields。</p>
			</div>
		</div>
		<div class="export-actions">
			<button type="button" class="ghost-button" on:click={copyExportJson}>
				<Icon icon="material-symbols:content-copy-rounded" />
				复制 JSON
			</button>
			<button type="button" class="ghost-button" on:click={downloadExportJson}>
				<Icon icon="material-symbols:download-rounded" />
				下载
			</button>
			{#if exportNotice}
				<span>{exportNotice}</span>
			{/if}
		</div>
		<pre>{exportJson()}</pre>
	</div>
</section>

<style>
	.copilot-shell {
		--primary: #1f7a6d;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: rgb(17 24 39 / 0.86);
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			"Segoe UI",
			sans-serif;
	}

	:global(.dark) .copilot-shell {
		color: rgb(255 255 255 / 0.82);
	}

	.toolbar,
	.panel-heading,
	.toolbar-actions,
	.status-row,
	.export-actions,
	.preview-heading,
	.preview-switch,
	.section-title,
	.swatch-row,
	.keyword-row,
	.sticky-cta {
		display: flex;
		align-items: center;
	}

	.toolbar {
		justify-content: space-between;
		gap: 1rem;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		color: var(--primary);
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0;
	}

	h2,
	h3,
	h4,
	p {
		margin: 0;
	}

	h2 {
		font-size: clamp(1.4rem, 2.6vw, 2.2rem);
		font-weight: 900;
		letter-spacing: 0;
	}

	.toolbar-actions,
	.export-actions {
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	button {
		border: 0;
		cursor: pointer;
		font: inherit;
	}

	.primary-button,
	.ghost-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		min-height: 2.75rem;
		border-radius: 0.5rem;
		padding: 0 0.9rem;
		font-weight: 800;
		transition:
			transform 0.2s ease,
			background-color 0.2s ease,
			opacity 0.2s ease;
	}

	.primary-button:hover,
	.ghost-button:hover {
		transform: translateY(-1px);
	}

	.primary-button:disabled {
		cursor: wait;
		opacity: 0.68;
		transform: none;
	}

	.primary-button {
		background: var(--primary);
		color: white;
	}

	.ghost-button {
		background: rgb(0 0 0 / 0.055);
		color: inherit;
	}

	:global(.dark) .ghost-button {
		background: rgb(255 255 255 / 0.075);
	}

	.status-row {
		justify-content: space-between;
		gap: 0.75rem;
		border-radius: 0.55rem;
		background: rgb(0 0 0 / 0.04);
		padding: 0.65rem 0.8rem;
		font-size: 0.82rem;
	}

	:global(.dark) .status-row {
		background: rgb(255 255 255 / 0.06);
	}

	.status-row span {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: rgb(0 0 0 / 0.58);
		font-weight: 800;
	}

	:global(.dark) .status-row span {
		color: rgb(255 255 255 / 0.58);
	}

	.status-row strong {
		color: #b42318;
		font-size: 0.8rem;
		text-align: right;
	}

	.workbench {
		display: grid;
		grid-template-columns: minmax(16rem, 0.9fr) minmax(18rem, 1.1fr);
		gap: 1rem;
		align-items: start;
	}

	.preview-panel {
		grid-column: 1 / -1;
	}

	.brief-panel,
	.strategy-panel,
	.preview-panel,
	.export-panel {
		border: 1px solid rgb(0 0 0 / 0.08);
		border-radius: 0.65rem;
		background: rgb(255 255 255 / 0.62);
		padding: 1rem;
	}

	:global(.dark) .brief-panel,
	:global(.dark) .strategy-panel,
	:global(.dark) .preview-panel,
	:global(.dark) .export-panel {
		border-color: rgb(255 255 255 / 0.1);
		background: rgb(255 255 255 / 0.045);
	}

	.panel-heading {
		gap: 0.7rem;
		margin-bottom: 1rem;
	}

	.panel-heading h3 {
		font-size: 1rem;
		font-weight: 900;
	}

	.panel-heading p {
		margin-top: 0.15rem;
		color: rgb(0 0 0 / 0.5);
		font-size: 0.86rem;
		line-height: 1.5;
	}

	:global(.dark) .panel-heading p {
		color: rgb(255 255 255 / 0.52);
	}

	.step {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.15rem;
		height: 2.15rem;
		border-radius: 0.5rem;
		background: rgb(0 0 0 / 0.06);
		color: var(--primary);
		font-weight: 900;
	}

	:global(.dark) .step {
		background: rgb(255 255 255 / 0.08);
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-bottom: 0.8rem;
	}

	label span {
		color: rgb(0 0 0 / 0.58);
		font-size: 0.82rem;
		font-weight: 800;
	}

	:global(.dark) label span {
		color: rgb(255 255 255 / 0.58);
	}

	input,
	textarea {
		width: 100%;
		border: 0;
		border-radius: 0.5rem;
		background: rgb(0 0 0 / 0.045);
		color: inherit;
		outline: none;
		padding: 0.75rem 0.8rem;
		font: inherit;
		line-height: 1.55;
	}

	textarea {
		resize: vertical;
	}

	:global(.dark) input,
	:global(.dark) textarea {
		background: rgb(255 255 255 / 0.07);
	}

	input:focus,
	textarea:focus {
		box-shadow: 0 0 0 2px rgb(37 99 235 / 0.32);
	}

	.two-columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.7rem;
	}

	.image-upload-block {
		margin-bottom: 0.8rem;
	}

	.upload-copy span {
		color: rgb(0 0 0 / 0.58);
		font-size: 0.82rem;
		font-weight: 800;
	}

	.upload-copy p {
		margin-top: 0.22rem;
		color: rgb(0 0 0 / 0.48);
		font-size: 0.8rem;
		line-height: 1.5;
	}

	.upload-box {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		min-height: 10.5rem;
		border: 1px dashed color-mix(in srgb, var(--primary) 46%, transparent);
		border-radius: 0.65rem;
		background: color-mix(in srgb, var(--primary) 7%, transparent);
		margin: 0.55rem 0 0;
		padding: 1rem;
		cursor: pointer;
		text-align: center;
		transition:
			border-color 0.2s ease,
			background-color 0.2s ease,
			transform 0.2s ease;
	}

	.upload-box:hover {
		border-color: color-mix(in srgb, var(--primary) 72%, transparent);
		background: color-mix(in srgb, var(--primary) 11%, transparent);
		transform: translateY(-1px);
	}

	.native-file-input {
		position: absolute;
		inset: 0;
		z-index: 2;
		width: 100%;
		height: 100%;
		cursor: pointer;
		opacity: 0;
	}

	.upload-trigger {
		display: flex;
		align-items: center;
		flex-direction: column;
		justify-content: center;
		min-height: 8rem;
		width: 100%;
		border-radius: 0.55rem;
		background: transparent;
		color: inherit;
		padding: 1rem;
		pointer-events: none;
	}

	.upload-trigger :global(svg) {
		color: var(--primary);
		font-size: 2rem;
	}

	.upload-trigger strong,
	.upload-trigger small {
		display: block;
	}

	.upload-trigger strong {
		margin-top: 0.35rem;
		font-size: 0.92rem;
	}

	.upload-trigger small {
		margin-top: 0.2rem;
		color: rgb(0 0 0 / 0.48);
		font-size: 0.76rem;
		line-height: 1.45;
	}

	.upload-box img {
		max-width: 100%;
		max-height: 11rem;
		object-fit: contain;
	}

	.upload-actions {
		position: absolute;
		right: 0.65rem;
		bottom: 0.65rem;
		left: 0.65rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
		z-index: 3;
		pointer-events: none;
	}

	.upload-actions span {
		border-radius: 999px;
		background: rgb(255 255 255 / 0.82);
		color: rgb(19 32 28 / 0.68);
		padding: 0.35rem 0.55rem;
		font-size: 0.72rem;
		font-weight: 800;
	}

	.upload-actions button {
		pointer-events: auto;
		border-radius: 0.45rem;
		background: rgb(19 32 28 / 0.88);
		color: white;
		padding: 0.35rem 0.55rem;
		font-size: 0.76rem;
		font-weight: 800;
	}

	.image-notice {
		margin-top: 0.4rem;
		color: var(--primary);
		font-size: 0.78rem;
		font-weight: 800;
	}

	:global(.dark) .upload-copy span {
		color: rgb(255 255 255 / 0.58);
	}

	:global(.dark) .upload-copy p,
	:global(.dark) .upload-trigger small {
		color: rgb(255 255 255 / 0.48);
	}

	.tone-group {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.55rem;
		margin-bottom: 0.8rem;
	}

	.tone-group button {
		border-radius: 0.55rem;
		background: rgb(0 0 0 / 0.045);
		color: inherit;
		padding: 0.7rem 0.8rem;
		text-align: left;
	}

	:global(.dark) .tone-group button {
		background: rgb(255 255 255 / 0.065);
	}

	.tone-group button.active {
		background: color-mix(in srgb, var(--primary) 14%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 45%, transparent);
	}

	.tone-group strong,
	.tone-group span {
		display: block;
	}

	.tone-group span {
		margin-top: 0.2rem;
		color: rgb(0 0 0 / 0.48);
		font-size: 0.8rem;
	}

	:global(.dark) .tone-group span {
		color: rgb(255 255 255 / 0.48);
	}

	.strategy-panel {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.output-section {
		border-radius: 0.6rem;
		background: rgb(0 0 0 / 0.035);
		padding: 0.9rem;
	}

	:global(.dark) .output-section {
		background: rgb(255 255 255 / 0.055);
	}

	.section-title {
		gap: 0.4rem;
		margin-bottom: 0.55rem;
		color: var(--primary);
		font-size: 0.82rem;
		font-weight: 900;
	}

	.output-section h4 {
		font-size: 1rem;
		font-weight: 900;
		line-height: 1.4;
	}

	.output-section p,
	.mini-list p,
	.faq-list p {
		margin-top: 0.35rem;
		color: rgb(0 0 0 / 0.6);
		font-size: 0.86rem;
		line-height: 1.65;
	}

	:global(.dark) .output-section p,
	:global(.dark) .mini-list p,
	:global(.dark) .faq-list p {
		color: rgb(255 255 255 / 0.62);
	}

	.mini-list {
		display: grid;
		gap: 0.65rem;
	}

	.mini-list div {
		border-left: 3px solid color-mix(in srgb, var(--primary) 58%, transparent);
		padding-left: 0.65rem;
	}

	.faq-list {
		display: grid;
		gap: 0.45rem;
	}

	details {
		border-radius: 0.5rem;
		background: rgb(255 255 255 / 0.52);
		padding: 0.7rem;
	}

	:global(.dark) details {
		background: rgb(0 0 0 / 0.16);
	}

	summary {
		cursor: pointer;
		font-weight: 800;
	}

	.keyword-row {
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.65rem;
	}

	.keyword-row span {
		border-radius: 999px;
		background: rgb(0 0 0 / 0.06);
		padding: 0.25rem 0.55rem;
		font-size: 0.76rem;
		font-weight: 800;
	}

	.swatch-row {
		gap: 0.45rem;
		margin-top: 0.75rem;
	}

	.swatch-row span {
		width: 2.2rem;
		height: 1.5rem;
		border: 1px solid rgb(0 0 0 / 0.08);
		border-radius: 0.35rem;
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.4);
	}

	:global(.dark) .keyword-row span {
		background: rgb(255 255 255 / 0.08);
	}

	.preview-heading {
		justify-content: space-between;
	}

	.preview-heading > div:nth-child(2) {
		flex: 1;
	}

	.preview-switch {
		gap: 0.35rem;
		border-radius: 0.5rem;
		background: rgb(0 0 0 / 0.045);
		padding: 0.25rem;
	}

	:global(.dark) .preview-switch {
		background: rgb(255 255 255 / 0.065);
	}

	.preview-switch button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 0.42rem;
		background: transparent;
		color: inherit;
	}

	.preview-switch button.active {
		background: var(--primary);
		color: white;
	}

	.storefront-preview {
		position: relative;
		overflow: hidden;
		border-radius: 0.75rem;
		background: var(--store-bg);
		color: var(--store-text);
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.08);
	}

	.storefront-preview.mobile {
		max-width: 24rem;
		margin: 0 auto;
	}

	.store-hero {
		display: grid;
		grid-template-columns: minmax(0, 1.05fr) minmax(10rem, 0.95fr);
		gap: 1rem;
		align-items: center;
		min-height: 22rem;
		padding: 1.5rem;
		background:
			linear-gradient(135deg, color-mix(in srgb, var(--store-primary) 18%, transparent), transparent 42%),
			linear-gradient(160deg, var(--store-bg) 0%, var(--store-hero-bg) 100%);
	}

	.store-hero p {
		color: var(--store-primary);
		font-size: 0.76rem;
		font-weight: 900;
		text-transform: uppercase;
	}

	.store-hero h3 {
		margin-top: 0.65rem;
		max-width: 28rem;
		font-size: clamp(1.75rem, 4vw, 3.15rem);
		font-weight: 950;
		line-height: 0.98;
	}

	.store-hero span {
		display: block;
		margin-top: 0.85rem;
		max-width: 30rem;
		color: var(--store-muted);
		line-height: 1.65;
	}

	.store-hero button,
	.sticky-cta button {
		border-radius: var(--store-button-radius);
		background: var(--store-text);
		color: white;
		font-weight: 900;
	}

	.store-hero button {
		margin-top: 1rem;
		padding: 0.85rem 1.1rem;
	}

	.product-visual {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1 / 1;
		min-height: 12rem;
		border-radius: 50%;
		background:
			radial-gradient(circle at 35% 25%, white 0 8%, transparent 9%),
			radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--store-primary) 22%, transparent), transparent 56%),
			var(--store-frame);
	}

	.product-visual.has-image {
		border-radius: var(--store-card-radius);
		background: var(--store-frame);
		padding: 1rem;
	}

	.product-visual img {
		max-width: 92%;
		max-height: 92%;
		object-fit: contain;
	}

	.product-visual[data-treatment="soft-shadow"] img {
		filter: drop-shadow(0 2rem 2.5rem rgb(0 0 0 / 0.24));
	}

	.product-visual[data-treatment="studio-card"] {
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.45);
	}

	.product-visual[data-treatment="studio-card"] img {
		filter: saturate(1.05) drop-shadow(0 1.4rem 2.2rem rgb(0 0 0 / 0.2));
	}

	.earbud {
		position: absolute;
		width: 28%;
		height: 48%;
		border-radius: 999px;
		background: #101c19;
		box-shadow: 0 1.5rem 2.5rem rgb(0 0 0 / 0.18);
	}

	.earbud.left {
		top: 24%;
		left: 26%;
		transform: rotate(-16deg);
	}

	.earbud.right {
		right: 24%;
		bottom: 20%;
		transform: rotate(18deg);
	}

	.signal {
		position: absolute;
		right: 16%;
		top: 14%;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3.2rem;
		height: 3.2rem;
		border-radius: 50%;
		background: #ffffff;
		color: var(--store-primary);
		font-weight: 950;
		box-shadow: 0 1rem 2rem rgb(0 0 0 / 0.12);
	}

	.store-benefits,
	.store-use-cases,
	.store-proof,
	.store-faq {
		padding: 1rem 1.5rem;
	}

	.store-benefits {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.store-benefits article,
	.store-use-cases div,
	.store-proof,
	.store-faq details {
		border: 1px solid rgb(19 32 28 / 0.08);
		border-radius: var(--store-card-radius);
		background: color-mix(in srgb, var(--store-surface) 86%, transparent);
	}

	.store-benefits article {
		padding: 0.9rem;
	}

	.store-benefits :global(svg) {
		color: var(--store-primary);
		font-size: 1.35rem;
	}

	.store-benefits h4,
	.store-use-cases h4,
	.store-faq h4 {
		margin-top: 0.45rem;
		font-size: 0.98rem;
		font-weight: 900;
	}

	.store-benefits p,
	.store-use-cases p,
	.store-proof p,
	.store-faq p {
		margin-top: 0.35rem;
		color: var(--store-muted);
		font-size: 0.82rem;
		line-height: 1.55;
	}

	.store-use-cases {
		display: grid;
		gap: 0.65rem;
	}

	.store-use-cases div {
		padding: 0.85rem;
	}

	.store-proof {
		display: grid;
		grid-template-columns: 9rem 1fr;
		gap: 1rem;
		align-items: center;
		margin: 0 1.5rem 1rem;
	}

	.store-proof strong {
		display: block;
		font-size: 1.9rem;
		font-weight: 950;
	}

	.store-proof span {
		color: rgb(19 32 28 / 0.58);
		font-size: 0.8rem;
		font-weight: 800;
	}

	.store-faq {
		padding-bottom: 5rem;
	}

	.store-faq h4 {
		margin-bottom: 0.65rem;
	}

	.store-faq details {
		margin-bottom: 0.5rem;
	}

	.sticky-cta {
		position: absolute;
		right: 1rem;
		bottom: 1rem;
		left: 1rem;
		justify-content: space-between;
		border-radius: var(--store-card-radius);
		background: color-mix(in srgb, var(--store-surface) 92%, transparent);
		padding: 0.75rem;
		box-shadow: 0 1rem 2rem rgb(0 0 0 / 0.14);
	}

	.sticky-cta span {
		font-weight: 950;
	}

	.sticky-cta button {
		min-height: 2.35rem;
		padding: 0 0.9rem;
	}

	.storefront-preview.mobile .store-hero,
	.storefront-preview.mobile .store-benefits,
	.storefront-preview.mobile .store-proof {
		grid-template-columns: 1fr;
	}

	.storefront-preview.mobile .store-hero {
		min-height: auto;
	}

	.storefront-preview.mobile .product-visual {
		min-height: 10rem;
	}

	.export-panel pre {
		max-height: 22rem;
		overflow: auto;
		border-radius: 0.6rem;
		background: rgb(8 13 18 / 0.92);
		color: #d6f4e4;
		padding: 1rem;
		font-size: 0.82rem;
		line-height: 1.55;
		white-space: pre-wrap;
	}

	.export-actions {
		margin-bottom: 0.8rem;
	}

	.export-actions span {
		color: var(--primary);
		font-size: 0.85rem;
		font-weight: 800;
	}

	@media (max-width: 1180px) {
		.workbench {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (max-width: 760px) {
		.toolbar {
			align-items: flex-start;
			flex-direction: column;
		}

		.workbench,
		.two-columns,
		.store-hero,
		.store-benefits,
		.store-proof {
			grid-template-columns: 1fr;
		}

		.brief-panel,
		.strategy-panel,
		.preview-panel,
		.export-panel {
			padding: 0.85rem;
		}

		.store-hero {
			min-height: auto;
		}

		.product-visual {
			min-height: 10rem;
		}
	}
</style>
