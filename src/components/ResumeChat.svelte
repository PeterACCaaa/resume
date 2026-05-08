<script lang="ts">
import Icon from "@iconify/svelte";
import { tick } from "svelte";

type ChatMessage = {
	role: "user" | "assistant";
	content: string;
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
					{message.content}
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
	}
</style>
