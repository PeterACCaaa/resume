const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-5-mini";
const TONES = new Set(["premium-tech", "minimal", "vibrant"]);
const IMAGE_DATA_URL_PATTERN =
	/^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i;
const MAX_IMAGE_DATA_URL_LENGTH = 1_600_000;
const IMAGE_TREATMENTS = ["clean-cutout", "soft-shadow", "studio-card"];
const STYLE_COLOR_FALLBACKS = {
	primaryColor: "#1f7a6d",
	accentColor: "#e6a23c",
	backgroundColor: "#f4f7f4",
	surfaceColor: "#ffffff",
	textColor: "#13201c",
	mutedTextColor: "#60716b",
	heroBackground: "#e6ece7",
	productFrame: "#d7e3de",
};

const SYSTEM_PROMPT = `你是 DTC 独立站商品页策划专家，熟悉 Shopify 商品页、移动端转化路径、品牌语气和结构化内容设计。
你只根据用户提供的商品 Brief 生成页面草稿，不要编造认证、真实评分、销量、真实用户评价、实验数据或无法验证的事实。
输出以中文为主，必要的 CTA、SEO title 和短标签可以使用英文。
reviews 字段只能写成“待审核的评价草稿/洞察”，author 不能伪装成真实客户。
如果用户提供商品样品图，请根据可见的产品形态、材质、主色、光影和使用场景生成 style 字段，让页面视觉风格贴合商品；不要识别或复述水印、商标归属、人物身份或不可见信息。
内容要适合面试演示：能体现从商品信息到 Hero、卖点、场景、FAQ、SEO、视觉风格的结构化拆解能力。`;

const DTC_PAGE_CONTENT_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: [
		"brief",
		"hero",
		"benefits",
		"useCases",
		"specs",
		"reviews",
		"faqs",
		"seo",
		"style",
	],
	properties: {
		brief: objectSchema(
			[
				"productName",
				"category",
				"priceRange",
				"targetAudience",
				"sellingPoints",
				"brandTone",
				"pageGoal",
			],
			{
				productName: stringSchema(),
				category: stringSchema(),
				priceRange: stringSchema(),
				targetAudience: stringSchema(),
				sellingPoints: stringSchema(),
				brandTone: enumSchema([...TONES]),
				pageGoal: stringSchema(),
			},
		),
		hero: objectSchema(["eyebrow", "heading", "subheading", "cta"], {
			eyebrow: stringSchema(),
			heading: stringSchema(),
			subheading: stringSchema(),
			cta: stringSchema(),
		}),
		benefits: arraySchema(
			objectSchema(["title", "body"], {
				title: stringSchema(),
				body: stringSchema(),
			}),
		),
		useCases: arraySchema(
			objectSchema(["title", "body"], {
				title: stringSchema(),
				body: stringSchema(),
			}),
		),
		specs: arraySchema(
			objectSchema(["label", "value"], {
				label: stringSchema(),
				value: stringSchema(),
			}),
		),
		reviews: arraySchema(
			objectSchema(["quote", "author"], {
				quote: stringSchema(),
				author: stringSchema(),
			}),
		),
		faqs: arraySchema(
			objectSchema(["question", "answer"], {
				question: stringSchema(),
				answer: stringSchema(),
			}),
		),
		seo: objectSchema(["title", "description", "keywords"], {
			title: stringSchema(),
			description: stringSchema(),
			keywords: arraySchema(stringSchema()),
		}),
		style: objectSchema(
			[
				"themeName",
				"visualMood",
				"primaryColor",
				"accentColor",
				"backgroundColor",
				"surfaceColor",
				"textColor",
				"mutedTextColor",
				"heroBackground",
				"cardRadius",
				"buttonRadius",
				"imageTreatment",
				"productFrame",
			],
			{
				themeName: stringSchema(),
				visualMood: stringSchema(),
				primaryColor: stringSchema(),
				accentColor: stringSchema(),
				backgroundColor: stringSchema(),
				surfaceColor: stringSchema(),
				textColor: stringSchema(),
				mutedTextColor: stringSchema(),
				heroBackground: stringSchema(),
				cardRadius: stringSchema(),
				buttonRadius: stringSchema(),
				imageTreatment: enumSchema(IMAGE_TREATMENTS),
				productFrame: stringSchema(),
			},
		),
	},
};

function stringSchema() {
	return { type: "string" };
}

function enumSchema(values) {
	return { type: "string", enum: values };
}

function arraySchema(items) {
	return { type: "array", items };
}

function objectSchema(required, properties) {
	return {
		type: "object",
		additionalProperties: false,
		required,
		properties,
	};
}

export function getDtcCopilotConfig(env = process.env) {
	return {
		apiKey: env.OPENAI_API_KEY,
		model: env.OPENAI_MODEL || DEFAULT_MODEL,
		baseUrl: normalizeBaseUrl(
			env.OPENAI_BASE_URL ||
				env.OPENAI_API_BASE_URL ||
				env.OPENAI_API_BASE ||
				DEFAULT_BASE_URL,
		),
	};
}

export function normalizeBaseUrl(rawUrl) {
	const trimmed = rawUrl.trim().replace(/\/+$/, "");
	return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

export async function generateDtcPage(rawRequest, options = {}) {
	const config = getDtcCopilotConfig(options.env);
	if (!config.apiKey) {
		throw new Error("OPENAI_API_KEY is not set.");
	}

	const request = normalizeProductRequest(rawRequest);
	const response = await fetch(`${config.baseUrl}/responses`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${config.apiKey}`,
		},
		body: JSON.stringify(createDtcPagePayload(config, request)),
		signal: options.signal,
	});

	const data = await response.json();
	if (!response.ok) {
		const message =
			data?.error?.message || `OpenAI request failed: ${response.status}`;
		throw new Error(message);
	}

	const content = parseStructuredContent(data);
	const pageContent = normalizeGeneratedContent(content);

	return {
		page: {
			...pageContent,
			shopifySections: buildShopifySections(pageContent),
		},
		model: config.model,
	};
}

function createDtcPagePayload(config, request) {
	return {
		model: config.model,
		reasoning: { effort: "low" },
		instructions: SYSTEM_PROMPT,
		input: [
			{
				role: "user",
				content: createInputContent(request),
			},
		],
		text: {
			format: {
				type: "json_schema",
				name: "dtc_page_content",
				strict: true,
				schema: DTC_PAGE_CONTENT_SCHEMA,
			},
		},
	};
}

function createInputContent(request) {
	const content = [
		{
			type: "input_text",
			text: `【商品 Brief】\n${JSON.stringify(request.brief, null, 2)}\n\n如果 Brief 中某些字段是“请根据商品图片自动推断”，请先根据商品图和已有文字推断并补全 brief 字段，再生成页面内容。请生成 4-5 个 benefits、3 个 useCases、4 个 specs、2 个 reviews、4 个 faqs、4-8 个 SEO keywords，并生成一套可直接渲染的 style 配置。style 中颜色必须使用 6 位十六进制色值，圆角必须使用 rem 单位。`,
		},
	];

	if (request.productImage) {
		content.push({
			type: "input_image",
			image_url: request.productImage.dataUrl,
			detail: "low",
		});
	}

	return content;
}

function normalizeProductRequest(rawRequest) {
	const source = readObject(rawRequest, "request");
	const request = source.brief ? source : { brief: source };
	const productImage = request.productImage
		? normalizeProductImage(request.productImage)
		: null;

	return {
		brief: normalizeProductBrief(request.brief, Boolean(productImage)),
		productImage,
	};
}

function normalizeProductBrief(rawBrief, hasProductImage = false) {
	const source = readObject(rawBrief, "brief");
	const brandTone = readOptionalBriefField(
		source.brandTone,
		"brandTone",
		32,
		hasProductImage,
		"premium-tech",
	);

	if (!TONES.has(brandTone)) {
		throw inputError("brandTone is invalid.");
	}

	return {
		productName: readOptionalBriefField(
			source.productName,
			"productName",
			120,
			hasProductImage,
		),
		category: readOptionalBriefField(
			source.category,
			"category",
			80,
			hasProductImage,
		),
		priceRange: readOptionalBriefField(
			source.priceRange,
			"priceRange",
			80,
			hasProductImage,
			"请根据商品图片自动推断合理价格带。",
		),
		targetAudience: readOptionalBriefField(
			source.targetAudience,
			"targetAudience",
			280,
			hasProductImage,
		),
		sellingPoints: readOptionalSellingPoints(
			source.sellingPoints,
			hasProductImage,
		),
		brandTone,
		pageGoal: readOptionalBriefField(
			source.pageGoal,
			"pageGoal",
			240,
			hasProductImage,
			"请根据商品图片自动推断页面目标。",
		),
	};
}

function readOptionalBriefField(
	rawValue,
	path,
	maxLength,
	hasProductImage,
	inferText = `请根据商品图片自动推断 ${path}。`,
) {
	if (typeof rawValue !== "string") {
		throw inputError(`${path} must be a string.`);
	}

	const value = rawValue.trim();
	if (value) return value.slice(0, maxLength);

	if (hasProductImage) return inferText;

	throw inputError(`${path} is required unless productImage is provided.`);
}

function readOptionalSellingPoints(rawValue, hasProductImage) {
	if (typeof rawValue !== "string") {
		throw inputError("sellingPoints must be a string.");
	}

	const value = rawValue.trim();
	if (value) return value.slice(0, 800);

	if (hasProductImage) {
		return "请根据商品图片、商品类目、目标用户和页面目标自动提炼核心卖点。";
	}

	throw inputError("sellingPoints is required unless productImage is provided.");
}

function normalizeProductImage(rawImage) {
	const source = readObject(rawImage, "productImage");
	const dataUrl = readRequiredString(
		source.dataUrl,
		"productImage.dataUrl",
		MAX_IMAGE_DATA_URL_LENGTH,
	);

	if (!IMAGE_DATA_URL_PATTERN.test(dataUrl)) {
		throw inputError("productImage.dataUrl must be a PNG, JPEG, or WEBP data URL.");
	}

	return {
		dataUrl,
		name:
			typeof source.name === "string"
				? source.name.trim().slice(0, 120)
				: "",
	};
}

function parseStructuredContent(data) {
	const output = extractResponseText(data);
	if (!output) {
		throw new Error("OpenAI response did not contain JSON output.");
	}

	try {
		return JSON.parse(output);
	} catch {
		throw new Error("OpenAI response was not valid JSON.");
	}
}

function extractResponseText(data) {
	if (typeof data?.output_text === "string" && data.output_text.trim()) {
		return data.output_text.trim();
	}

	const outputText = data?.output
		?.flatMap((item) => item?.content || [])
		?.map((content) => content?.text || "")
		.filter(Boolean)
		.join("\n")
		.trim();

	return outputText || "";
}

function normalizeGeneratedContent(rawContent) {
	const source = readObject(rawContent, "page");
	const generatedBrief = readGeneratedBrief(source.brief);

	return {
		brief: generatedBrief,
		hero: readTextObject(source.hero, "hero", [
			"eyebrow",
			"heading",
			"subheading",
			"cta",
		]),
		benefits: readTextObjectArray(source.benefits, "benefits", ["title", "body"]),
		useCases: readTextObjectArray(source.useCases, "useCases", ["title", "body"]),
		specs: readTextObjectArray(source.specs, "specs", ["label", "value"]),
		reviews: readTextObjectArray(source.reviews, "reviews", ["quote", "author"]),
		faqs: readTextObjectArray(source.faqs, "faqs", ["question", "answer"]),
		seo: {
			...readTextObject(source.seo, "seo", ["title", "description"]),
			keywords: readStringArray(source.seo?.keywords, "seo.keywords"),
		},
		style: readStyleObject(source.style),
	};
}

function readGeneratedBrief(rawValue) {
	const brief = readTextObject(rawValue, "brief", [
		"productName",
		"category",
		"priceRange",
		"targetAudience",
		"sellingPoints",
		"brandTone",
		"pageGoal",
	]);

	if (!TONES.has(brief.brandTone)) {
		brief.brandTone = "premium-tech";
	}

	return brief;
}

function readStyleObject(rawValue) {
	const style = readTextObject(rawValue, "style", [
		"themeName",
		"visualMood",
		"primaryColor",
		"accentColor",
		"backgroundColor",
		"surfaceColor",
		"textColor",
		"mutedTextColor",
		"heroBackground",
		"cardRadius",
		"buttonRadius",
		"imageTreatment",
		"productFrame",
	]);

	for (const key of [
		"primaryColor",
		"accentColor",
		"backgroundColor",
		"surfaceColor",
		"textColor",
		"mutedTextColor",
		"heroBackground",
		"productFrame",
	]) {
		style[key] = normalizeHexColor(
			style[key],
			`style.${key}`,
			getStyleColorFallback(style, key),
		);
	}

	assertCssRem(style.cardRadius, "style.cardRadius");
	assertCssRem(style.buttonRadius, "style.buttonRadius");

	if (!IMAGE_TREATMENTS.includes(style.imageTreatment)) {
		throw new Error("style.imageTreatment is invalid.");
	}

	return style;
}

function getStyleColorFallback(style, key) {
	if (key === "productFrame") {
		return (
			parseHexColor(style.heroBackground) ||
			parseHexColor(style.surfaceColor) ||
			STYLE_COLOR_FALLBACKS.productFrame
		);
	}

	return STYLE_COLOR_FALLBACKS[key];
}

function normalizeHexColor(value, path, fallback) {
	const color = parseHexColor(value);
	if (color) return color;
	if (fallback) return fallback;

	if (typeof value !== "string") {
		throw new Error(`${path} must be a string color.`);
	}

	throw new Error(`${path} must be a 6-digit hex color.`);
}

function parseHexColor(value) {
	if (typeof value !== "string") return "";

	const rawValue = value.trim();
	const sixDigitHex = rawValue.match(/^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
	if (sixDigitHex) return `#${sixDigitHex[1].toLowerCase()}`;

	const threeDigitHex = rawValue.match(/^#?([0-9a-f]{3})$/i);
	if (threeDigitHex) {
		return `#${threeDigitHex[1]
			.toLowerCase()
			.split("")
			.map((part) => part + part)
			.join("")}`;
	}

	const rgbColor = rawValue.match(
		/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i,
	);
	if (rgbColor) {
		const channels = rgbColor.slice(1, 4).map(Number);
		if (channels.every((channel) => channel >= 0 && channel <= 255)) {
			return `#${channels
				.map((channel) => channel.toString(16).padStart(2, "0"))
				.join("")}`;
		}
	}

	return "";
}

function assertHexColor(value, path) {
	if (!parseHexColor(value)) {
		throw new Error(`${path} must be a 6-digit hex color.`);
	}
}

function assertCssRem(value, path) {
	if (!/^(0|[0-9]+(\.[0-9]+)?)rem$/.test(value)) {
		throw new Error(`${path} must use rem.`);
	}
}

function readTextObject(rawValue, path, keys) {
	const value = readObject(rawValue, path);
	return Object.fromEntries(
		keys.map((key) => [key, readRequiredString(value[key], `${path}.${key}`)]),
	);
}

function readTextObjectArray(rawValue, path, keys) {
	const values = readArray(rawValue, path);
	return values.map((item, index) =>
		readTextObject(item, `${path}[${index}]`, keys),
	);
}

function readStringArray(rawValue, path) {
	const values = readArray(rawValue, path);
	return values.map((item, index) =>
		readRequiredString(item, `${path}[${index}]`),
	);
}

function readObject(rawValue, path) {
	if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
		throw inputError(`${path} must be an object.`);
	}

	return rawValue;
}

function readArray(rawValue, path) {
	if (!Array.isArray(rawValue) || rawValue.length === 0) {
		throw new Error(`${path} must be a non-empty array.`);
	}

	return rawValue;
}

function readRequiredString(rawValue, path, maxLength = 600) {
	if (typeof rawValue !== "string") {
		throw inputError(`${path} must be a string.`);
	}

	const value = rawValue.trim();
	if (!value) {
		throw inputError(`${path} is required.`);
	}

	if (value.length > maxLength) {
		throw inputError(`${path} is too long.`);
	}

	return value;
}

function inputError(message) {
	const error = new Error(message);
	error.statusCode = 400;
	return error;
}

function buildShopifySections(page) {
	return [
		section("hero", "Product hero", [
			block("eyebrow", { text: page.hero.eyebrow }),
			block("heading", { text: page.hero.heading }),
			block("subheading", { text: page.hero.subheading }),
			block("button", { label: page.hero.cta }),
		]),
		section(
			"benefits",
			"Benefit cards",
			page.benefits.map((benefit) =>
				block("benefit", { title: benefit.title, body: benefit.body }),
			),
		),
		section(
			"use_cases",
			"Use cases",
			page.useCases.map((useCase) =>
				block("case", { title: useCase.title, body: useCase.body }),
			),
		),
		section(
			"faq",
			"FAQ",
			page.faqs.map((faq) =>
				block("question", { question: faq.question, answer: faq.answer }),
			),
		),
		section("seo", "SEO metadata", [
			block("metadata", {
				title: page.seo.title,
				description: page.seo.description,
				keywords: page.seo.keywords,
			}),
		]),
		section("style", "Style system", [
			block("theme", {
				themeName: page.style.themeName,
				visualMood: page.style.visualMood,
				primaryColor: page.style.primaryColor,
				accentColor: page.style.accentColor,
				backgroundColor: page.style.backgroundColor,
				surfaceColor: page.style.surfaceColor,
				textColor: page.style.textColor,
				mutedTextColor: page.style.mutedTextColor,
				heroBackground: page.style.heroBackground,
				cardRadius: page.style.cardRadius,
				buttonRadius: page.style.buttonRadius,
				imageTreatment: page.style.imageTreatment,
				productFrame: page.style.productFrame,
			}),
		]),
	];
}

function section(type, name, blocks) {
	return { type, name, blocks };
}

function block(type, settings) {
	return { type, settings };
}
