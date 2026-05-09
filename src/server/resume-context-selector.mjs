import fs from "node:fs";
import path from "node:path";

const RESUME_SOURCE = "src/content/spec/resume.md";
const POSTS_DIR = "src/content/posts";
const CONTEXT_SEPARATOR = "\n\n<<<RESUME_CONTEXT_CHUNK>>>\n\n";
const MAX_RELEVANT_POSTS = 5;
const LOW_CONFIDENCE_SCORE = 4;

const INTENT_TERMS = [
	"AI",
	"Agent",
	"LLM",
	"OpenAI",
	"Prompt",
	"SSE",
	"自动化",
	"前端",
	"后端",
	"全栈",
	"Vue",
	"React",
	"TypeScript",
	"Vite",
	"Go",
	"PHP",
	"Webman",
	"MySQL",
	"Redis",
	"权限",
	"项目",
	"经历",
	"岗位",
	"匹配",
	"优势",
	"工程化",
];

// 上下文选择的核心边界：调用方只关心“给这个问题准备哪些资料”。
// 当前策略不是完整 RAG，而是“完整简历 + 相关博客补充”：
// 1. resume.md 是求职事实主干，始终完整保留，避免岗位、学历、项目列表等基础信息被检索漏掉。
// 2. posts/*.md 只作为证明材料和技术深挖补充，按问题相关性挑选，减少无关长文稀释模型注意力。
// 3. 以后如果要换成 embedding、数据库索引或人工标注知识库，只替换这个函数内部即可。
export function selectResumeContext(question, root = process.cwd()) {
	const resumePath = path.join(root, RESUME_SOURCE);
	const resumeContent = readTextIfExists(resumePath);
	const posts = collectPostDocuments(root);
	const selectedPosts = selectRelevantPosts(question, posts);

	return formatContext([
		{
			source: RESUME_SOURCE,
			content: resumeContent,
		},
		...selectedPosts,
	]);
}

// 保留全量上下文能力有两个目的：
// 1. 方便和 selectResumeContext 做效果对比，判断轻量选择是否漏掉重要材料。
// 2. 兼容已有导入方，避免这次抽出 selector 时破坏原有脚本或临时调试代码。
export function collectMarkdownContext(root = process.cwd()) {
	const resumePath = path.join(root, RESUME_SOURCE);
	const posts = collectPostDocuments(root);

	return formatContext([
		{
			source: RESUME_SOURCE,
			content: readTextIfExists(resumePath),
		},
		...posts,
	]);
}

function collectPostDocuments(root) {
	const postsPath = path.join(root, POSTS_DIR);
	if (!fs.existsSync(postsPath)) return [];

	return fs
		.readdirSync(postsPath)
		.filter((name) => name.endsWith(".md"))
		.sort()
		.map((name) => {
			const source = `${POSTS_DIR}/${name}`;
			return {
				source,
				content: readTextIfExists(path.join(root, source)),
			};
		})
		.filter((item) => item.content.trim());
}

function selectRelevantPosts(question, posts) {
	const terms = extractQuestionTerms(question);
	// 无法抽出有效问题词时，说明当前规则没有判断依据，直接交给模型看全量博客更稳。
	if (!terms.length) return posts;

	const rankedPosts = posts
		.map((post) => ({
			...post,
			score: scoreDocument(post, terms),
		}))
		.sort((left, right) => right.score - left.score);

	const topScore = rankedPosts[0]?.score || 0;
	// 泛问题或命中不明确时不硬过滤。
	// 例如“他综合能力怎么样”可能需要前端、后端、AI、业务项目一起支撑；
	// 如果强行只取 TopN，反而会让 gpt-5.5 看到的材料变窄。
	if (topScore < LOW_CONFIDENCE_SCORE) return posts;

	return rankedPosts
		.filter((post) => post.score > 0)
		.slice(0, MAX_RELEVANT_POSTS)
		.map(({ score, ...post }) => post);
}

// 当前先用轻量规则打分，适合简历站这种小知识库：
// - 文件名命中表示文章主题相关，给中等权重；
// - frontmatter title 命中更能代表主题相关，给最高权重；
// - 正文命中用于补充判断，但设置上限，避免长文因重复词太多长期霸榜。
// 后续升级为向量检索时，保留 scoreDocument 的输入输出形状即可平滑替换。
function scoreDocument(document, terms) {
	const title = extractTitle(document.content) || document.source;
	const source = document.source.toLowerCase();
	const titleText = title.toLowerCase();
	const bodyText = document.content.toLowerCase();

	return terms.reduce((score, term) => {
		const normalizedTerm = term.toLowerCase();
		const sourceHit = source.includes(normalizedTerm) ? 3 : 0;
		const titleHit = titleText.includes(normalizedTerm) ? 5 : 0;
		const bodyHit = countOccurrences(bodyText, normalizedTerm) * 2;
		return score + sourceHit + titleHit + Math.min(bodyHit, 12);
	}, 0);
}

function extractQuestionTerms(question) {
	const normalizedQuestion = question.toLowerCase();
	// 先匹配人工维护的意图词，覆盖简历问答里最常见的岗位、技术栈和项目方向。
	const directTerms = INTENT_TERMS.filter((term) =>
		normalizedQuestion.includes(term.toLowerCase()),
	);
	// 再补充英文技术词和中文连续词，避免新技术名未加入 INTENT_TERMS 时完全无法命中。
	const asciiTerms = question.match(/[A-Za-z][A-Za-z0-9.+#-]{1,}/g) || [];
	const chineseTerms = question.match(/[\u4e00-\u9fa5]{2,}/g) || [];

	return Array.from(new Set([...directTerms, ...asciiTerms, ...chineseTerms]));
}

function extractTitle(content) {
	return content.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] || "";
}

function countOccurrences(text, term) {
	if (!term) return 0;
	return text.split(term).length - 1;
}

function formatContext(items) {
	// 每个资料块都显式带来源，方便 Prompt 要求模型说明证据来源，也方便调试选中了哪些文件。
	return items
		.filter((item) => item.content.trim())
		.map((item) => `【资料来源：${item.source}】\n${item.content.trim()}`)
		.join(CONTEXT_SEPARATOR);
}

function readTextIfExists(filePath) {
	if (!fs.existsSync(filePath)) return "";
	return fs.readFileSync(filePath, "utf8");
}
