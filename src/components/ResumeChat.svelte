<script lang="ts">
import Icon from "@iconify/svelte";
import { tick } from "svelte";

type ChatMessage = {
	role: "user" | "assistant";
	content: string;
};

type FormattedMessageBlock = {
	kind: "paragraph" | "item";
	text: string;
	label?: string;
};

const API_URL = import.meta.env.DEV ? getDevApiUrl() : "/api/resume-chat";
const suggestions = [
	"他有哪些 Go 后端项目经验？",
	"他做过哪些 AI Agent 或自动化项目？",
	"他的前端能力体现在哪里？",
	"他适合什么类型的岗位？",
];

let question = "";
let loading = false;
let error = "";
let messageListElement: HTMLDivElement;
let scrollFrame = 0;
let messages: ChatMessage[] = [
	{
		role: "assistant",
		content:
			"你可以直接问我关于方中杰的技术栈、项目经历、工作经历、岗位匹配度或简历亮点。",
	},
];

function updateMessage(index: number, content: string): void {
	messages = messages.map((message, currentIndex) =>
		currentIndex === index ? { ...message, content } : message,
	);
	scrollToBottom();
}

async function scrollToBottom(): Promise<void> {
	await tick();

	if (!messageListElement) return;

	if (scrollFrame) {
		cancelAnimationFrame(scrollFrame);
	}

	scrollFrame = requestAnimationFrame(() => {
		messageListElement.scrollTo({
			top: messageListElement.scrollHeight,
			behavior: "smooth",
		});
		scrollFrame = 0;
	});
}

function getDevApiUrl(): string {
	if (typeof window === "undefined") {
		return "http://localhost:8787/api/resume-chat";
	}

	return `${window.location.protocol}//${window.location.hostname}:8787/api/resume-chat`;
}

async function ask(text = question): Promise<void> {
	const trimmed = text.trim();
	if (!trimmed || loading) return;

	error = "";
	question = "";
	loading = true;
	const assistantIndex = messages.length + 1;
	messages = [
		...messages,
		{ role: "user", content: trimmed },
		{ role: "assistant", content: "" },
	];
	scrollToBottom();

	try {
		const response = await fetch(API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ question: trimmed }),
		});

		if (!response.ok || !response.body) {
			const data = await response.json().catch(() => null);
			throw new Error(data?.error || "请求失败");
		}

		const answer = await readAnswerStream(response.body, (delta) => {
			const current = messages[assistantIndex]?.content || "";
			updateMessage(assistantIndex, current + delta);
		});

		if (!answer.trim()) {
			updateMessage(assistantIndex, "没有获得有效回答。");
		}
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
		updateMessage(
			assistantIndex,
			"问答服务暂时不可用。开发环境请确认 `resume-chat` 服务已启动；线上环境请检查部署环境变量。",
		);
	} finally {
		loading = false;
	}
}

async function readAnswerStream(
	stream: ReadableStream<Uint8Array>,
	onDelta: (delta: string) => void,
): Promise<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let answer = "";

	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const blocks = buffer.split(/\r?\n\r?\n/);
			buffer = blocks.pop() || "";

			for (const block of blocks) {
				const event = parseSseBlock(block);
				answer += handleAnswerStreamEvent(event, onDelta);
			}
		}

		buffer += decoder.decode();
		if (buffer.trim()) {
			const event = parseSseBlock(buffer);
			answer += handleAnswerStreamEvent(event, onDelta);
		}

		return answer;
	} finally {
		reader.releaseLock();
	}
}

function handleAnswerStreamEvent(
	event: { type: string; payload: Record<string, unknown> } | null,
	onDelta: (delta: string) => void,
): string {
	if (!event) return "";

	if (event.type === "delta") {
		const delta = String(event.payload?.text || "");
		onDelta(delta);
		return delta;
	}

	if (event.type === "error") {
		throw new Error(getErrorMessage(event.payload));
	}

	return "";
}

function getErrorMessage(payload: Record<string, unknown>): string {
	return typeof payload.message === "string"
		? payload.message
		: "问答服务暂时不可用";
}

function parseSseBlock(
	block: string,
): { type: string; payload: Record<string, unknown> } | null {
	let type = "message";
	const dataLines: string[] = [];

	for (const line of block.split(/\r?\n/)) {
		if (!line || line.startsWith(":")) continue;

		const separatorIndex = line.indexOf(":");
		const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
		let value = separatorIndex === -1 ? "" : line.slice(separatorIndex + 1);
		if (value.startsWith(" ")) value = value.slice(1);

		if (field === "event") type = value;
		if (field === "data") dataLines.push(value);
	}

	if (!dataLines.length) return null;

	return {
		type,
		payload: JSON.parse(dataLines.join("\n")),
	};
}

function handleKeydown(event: KeyboardEvent): void {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		ask();
	}
}

// AI 回复仍按文本接收，再在前端解析为受控结构。
// 这样可以兼容模型偶尔输出 Markdown 的情况，同时避免用 {@html} 直接渲染不可信内容。
// 返回结构只有 paragraph 和 item 两类，样式完全由当前组件控制，后续改版不会依赖模型输出 HTML。
function formatAssistantMessage(content: string): FormattedMessageBlock[] {
	const blocks: FormattedMessageBlock[] = [];
	let paragraphLines: string[] = [];

	const flushParagraph = () => {
		const text = cleanInlineText(paragraphLines.join(" "));
		if (text) blocks.push({ kind: "paragraph", text });
		paragraphLines = [];
	};

	for (const rawLine of content.replace(/\r\n/g, "\n").split("\n")) {
		const line = rawLine.trim();
		if (!line || /^[-*_]{3,}$/.test(line)) {
			flushParagraph();
			continue;
		}

		const normalizedLine = line.replace(/^#{1,6}\s+/, "").replace(/^>\s*/, "");
		// 兼容模型仍然输出列表符号的情况：去掉项目符号，只保留正文参与结构化展示。
		const itemMatch = normalizedLine.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
		if (itemMatch) {
			flushParagraph();
			blocks.push(createMessageItem(itemMatch[1]));
			continue;
		}

		// Prompt 会尽量要求“字段：内容”，这里把这种行渲染成带标签的答案项。
		if (isLabeledLine(normalizedLine)) {
			flushParagraph();
			blocks.push(createMessageItem(normalizedLine));
			continue;
		}

		paragraphLines.push(normalizedLine);
	}

	flushParagraph();
	return blocks.length
		? blocks
		: [{ kind: "paragraph", text: cleanInlineText(content) }];
}

// 支持“字段：内容”格式，让招聘信息按清晰标签展示。
// 标签长度限制在 2 到 14 个字符，避免普通长句里出现冒号时被误判成标签。
function createMessageItem(text: string): FormattedMessageBlock {
	const cleaned = cleanInlineText(text);
	const labelMatch = cleaned.match(/^([^：:]{2,14})[：:]\s*(.+)$/);

	if (!labelMatch) {
		return { kind: "item", text: cleaned };
	}

	return {
		kind: "item",
		label: labelMatch[1].trim(),
		text: labelMatch[2].trim(),
	};
}

function isLabeledLine(text: string): boolean {
	return /^([^：:]{2,14})[：:]\s*\S+/.test(cleanInlineText(text));
}

// 清理模型偶尔带出的 Markdown 标记，保留可读文本本身。
// 这里只做保守文本替换，不解析任意 HTML，也不执行链接或脚本，保证聊天气泡展示可控。
function cleanInlineText(text: string): string {
	return text
		.replace(/\*\*(.*?)\*\*/g, "$1")
		.replace(/__(.*?)__/g, "$1")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/\[(.*?)\]\([^)]+\)/g, "$1")
		.replace(/[ \t]+/g, " ")
		.trim();
}
</script>

<section class="resume-chat-shell">
	<div class="quick-actions" aria-label="常用问题">
		{#each suggestions as item}
			<button type="button" on:click={() => ask(item)} disabled={loading}>
				{item}
			</button>
		{/each}
	</div>

	<div class="message-list" aria-live="polite" bind:this={messageListElement}>
		{#each messages as message}
			<div class:from-user={message.role === "user"} class="message-row">
				<div class="message-bubble">
					{#if message.role === "assistant"}
						<div class="assistant-answer">
							{#each formatAssistantMessage(message.content) as block}
								{#if block.kind === "item"}
									<div class:has-label={Boolean(block.label)} class="answer-item">
										{#if block.label}
											<span class="answer-label">{block.label}</span>
										{/if}
										<span class="answer-text">{block.text}</span>
									</div>
								{:else}
									<p class="answer-paragraph">{block.text}</p>
								{/if}
							{/each}
						</div>
					{:else}
						{message.content}
					{/if}
				</div>
			</div>
		{/each}
		{#if loading}
			<div class="message-row">
				<div class="message-bubble loading">
					<Icon icon="material-symbols:progress-activity" />
					正在生成回答
				</div>
			</div>
		{/if}
	</div>

	{#if error}
		<div class="error-box">{error}</div>
	{/if}

	<form class="input-row" on:submit|preventDefault={() => ask()}>
		<textarea
			bind:value={question}
			on:keydown={handleKeydown}
			placeholder="例如：他有哪些 AI 工程化经验？"
			rows="2"
		></textarea>
		<button type="submit" disabled={loading || !question.trim()} aria-label="发送">
			<Icon icon="material-symbols:send-rounded" />
		</button>
	</form>
</section>

<style>
	.resume-chat-shell {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 34rem;
	}

	.quick-actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.quick-actions button,
	.input-row button {
		transition:
			background-color 0.2s ease,
			transform 0.2s ease,
			opacity 0.2s ease;
	}

	.quick-actions button {
		border-radius: 0.5rem;
		padding: 0.75rem 0.9rem;
		background: rgb(0 0 0 / 0.04);
		color: rgb(0 0 0 / 0.72);
		font-size: 0.92rem;
		font-weight: 700;
		text-align: left;
	}

	:global(.dark) .quick-actions button {
		background: rgb(255 255 255 / 0.06);
		color: rgb(255 255 255 / 0.72);
	}

	.quick-actions button:hover:not(:disabled) {
		background: rgb(37 99 235 / 0.12);
		color: var(--primary);
	}

	.message-list {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.8rem;
		min-height: 22rem;
		max-height: 46rem;
		overflow-y: auto;
		padding: 0.25rem;
	}

	.message-row {
		display: flex;
		justify-content: flex-start;
	}

	.message-row.from-user {
		justify-content: flex-end;
	}

	.message-bubble {
		max-width: min(42rem, 88%);
		border-radius: 0.65rem;
		padding: 0.85rem 1rem;
		background: rgb(0 0 0 / 0.045);
		color: rgb(0 0 0 / 0.78);
		line-height: 1.7;
		white-space: pre-wrap;
	}

	:global(.dark) .message-bubble {
		background: rgb(255 255 255 / 0.07);
		color: rgb(255 255 255 / 0.78);
	}

	.from-user .message-bubble {
		background: var(--primary);
		color: white;
	}

	.assistant-answer {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.answer-paragraph {
		margin: 0;
	}

	.answer-item {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.2rem;
	}

	.answer-item.has-label {
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 0.55rem;
	}

	.answer-label {
		color: var(--primary);
		font-weight: 800;
		white-space: nowrap;
	}

	.answer-text {
		min-width: 0;
	}

	.loading {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--primary);
		font-weight: 700;
	}

	.loading :global(svg) {
		animation: spin 1s linear infinite;
	}

	.error-box {
		border-radius: 0.5rem;
		padding: 0.75rem 0.9rem;
		background: rgb(220 38 38 / 0.1);
		color: rgb(185 28 28);
		font-size: 0.9rem;
	}

	.input-row {
		display: grid;
		grid-template-columns: 1fr 3rem;
		gap: 0.75rem;
		align-items: end;
	}

	textarea {
		width: 100%;
		min-height: 3rem;
		max-height: 9rem;
		resize: vertical;
		border-radius: 0.6rem;
		padding: 0.85rem 1rem;
		background: rgb(0 0 0 / 0.045);
		color: rgb(0 0 0 / 0.82);
		outline: none;
	}

	:global(.dark) textarea {
		background: rgb(255 255 255 / 0.07);
		color: rgb(255 255 255 / 0.82);
	}

	textarea:focus {
		box-shadow: 0 0 0 2px rgb(37 99 235 / 0.35);
	}

	.input-row button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		border-radius: 0.6rem;
		background: var(--primary);
		color: white;
		font-size: 1.25rem;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 640px) {
		.quick-actions {
			grid-template-columns: 1fr;
		}

		.message-bubble {
			max-width: 94%;
		}

		.answer-item.has-label {
			grid-template-columns: 1fr;
			gap: 0.15rem;
		}
	}
</style>
