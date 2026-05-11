<script lang="ts">
import Icon from "@iconify/svelte";
import { onMount, tick } from "svelte";

type RefImage = {
	id: string;
	fileName: string;
	dataUrl: string;
};

type GalleryRecord = {
	id: number;
	dataUrl: string;
	prompt: string;
	mode: "text" | "image";
	model: string;
	refs: RefImage[];
	time: string;
};

type EventLine = {
	id: number;
	time: string;
	type: "event" | "data" | "text" | "done" | "error";
	message: string;
};

type StreamEvent = {
	type: string;
	payload: Record<string, unknown>;
};

const SAVED_KEY = "img_gen_byok_settings";
const DB_NAME = "img-gen-byok-gallery";
const DB_VERSION = 1;
const IMAGE_SIZE_LIMIT = 50 * 1024 * 1024;

let baseUrl = "https://api.openai.com";
let apiKey = "";
let model = "gpt-5.5";
let prompt = "";
let refImages: RefImage[] = [];
let gallery: GalleryRecord[] = [];
let modelIds: string[] = [];
let modelPanelOpen = false;
let loadingModels = false;
let modelLoadError = "";

let loading = false;
let statusKind: "idle" | "info" | "done" | "error" = "idle";
let statusText = "";
let resultDataUrl = "";
let resultBlob: Blob | null = null;
let generatedSize = "";
let generatedSeconds = "";
let eventLines: EventLine[] = [];
let streamedText = "";
let startedAt = 0;
let elapsedSeconds = "0";
let timer: number | undefined;
let fileInput: HTMLInputElement;
let eventLogElement: HTMLDivElement;
let previewOpen = false;
let previewImage = "";
let previewScale = 1;
let rememberApiKey = false;

$: filteredModelIds = modelIds
	.filter((id) => id.toLowerCase().includes(model.trim().toLowerCase()))
	.slice(0, 40);
$: visibleModelIds =
	modelIds.length && !filteredModelIds.length
		? modelIds.slice(0, 40)
		: filteredModelIds;
$: isModelFilterEmpty = modelIds.length > 0 && !filteredModelIds.length;

onMount(() => {
	loadSettings();
	loadGallery().then(renderGalleryState);

	const onKeydown = (event: KeyboardEvent) => {
		if (event.key === "Escape") closePreview();
	};
	window.addEventListener("keydown", onKeydown);

	return () => {
		window.removeEventListener("keydown", onKeydown);
		stopTimer();
	};
});

function loadSettings(): void {
	try {
		const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || "{}");
		if (typeof saved.baseUrl === "string") baseUrl = saved.baseUrl;
		if (typeof saved.model === "string") model = saved.model;
		if (typeof saved.apiKey === "string") {
			apiKey = saved.apiKey;
			rememberApiKey = true;
		}
	} catch {
		// 忽略损坏的本地设置。
	}
}

function saveSettings(): void {
	const settings: Record<string, string> = {
		baseUrl: baseUrl.trim(),
		model: model.trim(),
	};
	if (rememberApiKey) settings.apiKey = apiKey.trim();
	localStorage.setItem(SAVED_KEY, JSON.stringify(settings));
}

function normalizeBaseUrl(value: string): string {
	let normalized = value.trim();
	if (!normalized) throw new Error("Base URL 不能为空");
	if (!/^https?:\/\//i.test(normalized)) {
		throw new Error("Base URL 必须以 http:// 或 https:// 开头");
	}
	normalized = normalized.replace(/\/+$/, "");
	return normalized.endsWith("/v1") ? normalized.slice(0, -3) : normalized;
}

function startTimer(): void {
	startedAt = Date.now();
	elapsedSeconds = "0";
	timer = window.setInterval(() => {
		elapsedSeconds = String(Math.floor((Date.now() - startedAt) / 1000));
	}, 500);
}

function stopTimer(): void {
	if (timer) window.clearInterval(timer);
	timer = undefined;
	if (startedAt) {
		generatedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
		elapsedSeconds = generatedSeconds;
	}
}

async function appendEvent(
	type: EventLine["type"],
	message: string,
): Promise<void> {
	eventLines = [
		...eventLines,
		{
			id: Date.now() + eventLines.length,
			time: new Date().toTimeString().slice(0, 8),
			type,
			message,
		},
	];
	await tick();
	eventLogElement?.scrollTo({ top: eventLogElement.scrollHeight });
}

function resetRunState(): void {
	statusKind = "idle";
	statusText = "";
	resultDataUrl = "";
	resultBlob = null;
	generatedSize = "";
	generatedSeconds = "";
	eventLines = [];
	streamedText = "";
	stopTimer();
}

async function addRefFiles(files: FileList | null): Promise<void> {
	if (!files?.length) return;
	const refs = await Promise.all(Array.from(files).map(readRefFile));
	refImages = [...refImages, ...refs.filter((ref): ref is RefImage => !!ref)];
	fileInput.value = "";
}

async function readRefFile(file: File): Promise<RefImage | null> {
	if (file.size > IMAGE_SIZE_LIMIT) {
		window.alert(`${file.name} 超过 50MB，已跳过`);
		return null;
	}
	return {
		id: `${file.name}-${file.lastModified}-${file.size}`,
		fileName: file.name,
		dataUrl: await fileToDataUrl(file),
	};
}

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

function removeRefImage(id: string): void {
	refImages = refImages.filter((ref) => ref.id !== id);
}

function validateForm(): {
	apiBase: string;
	apiKeyValue: string;
	modelValue: string;
	promptValue: string;
} {
	const apiBase = normalizeBaseUrl(baseUrl);
	const apiKeyValue = apiKey.trim();
	const modelValue = model.trim();
	const promptValue = prompt.trim();
	if (!apiKeyValue) throw new Error("请填写你的 API Key");
	if (!modelValue) throw new Error("请填写或选择 Model");
	if (!promptValue) throw new Error("请填写提示词");
	return { apiBase, apiKeyValue, modelValue, promptValue };
}

function buildPayload(
	modelValue: string,
	promptValue: string,
): Record<string, unknown> {
	const tool: Record<string, unknown> = {
		type: "image_generation",
		output_format: "png",
		partial_images: 1,
		action: refImages.length ? "edit" : "generate",
	};
	if (!refImages.length) {
		return {
			model: modelValue,
			instructions:
				"你是图片生成助手。用户要求生成图片时，必须调用 image_generation 工具。",
			input: `请直接生成图片，不要只返回文字。图片描述：${promptValue}`,
			stream: true,
			tools: [tool],
		};
	}
	return {
		model: modelValue,
		input: [
			{
				role: "user",
				content: [
					...refImages.map((ref) => ({
						type: "input_image",
						image_url: ref.dataUrl,
					})),
					{
						type: "input_text",
						text: `请基于参考图片生成新图：${promptValue}`,
					},
				],
			},
		],
		stream: true,
		tools: [tool],
	};
}

async function generate(): Promise<void> {
	if (loading) return;

	try {
		const form = validateForm();
		saveSettings();
		resetRunState();
		loading = true;
		statusKind = "info";
		statusText = "正在连接上游接口...";
		startTimer();
		await appendEvent(
			"event",
			refImages.length ? "POST /v1/responses" : "POST /v1/images/generations",
		);
		await requestImage(form);
	} catch (error) {
		handleGenerationError(error);
	} finally {
		loading = false;
	}
}

async function requestImage(
	form: ReturnType<typeof validateForm>,
): Promise<void> {
	if (!refImages.length) {
		await requestTextToImage(form);
		return;
	}

	const response = await fetch(`${form.apiBase}/v1/responses`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${form.apiKeyValue}`,
			Accept: "text/event-stream",
			"Content-Type": "application/json",
		},
		body: JSON.stringify(buildPayload(form.modelValue, form.promptValue)),
	});

	if (!response.ok) throw new Error(await readHttpError(response));
	await appendEvent("event", `HTTP ${response.status}，开始接收流`);

	if (!response.body) {
		const data = await response.json();
		const image = extractFinalImageDataUrl(data);
		if (!image) throw new Error("响应中没有找到图片数据");
		await completeImage(image, form.promptValue, form.modelValue);
		return;
	}

	await readResponseStream(response.body, form.promptValue, form.modelValue);
}

async function requestTextToImage(
	form: ReturnType<typeof validateForm>,
): Promise<void> {
	const response = await fetch(`${form.apiBase}/v1/images/generations`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${form.apiKeyValue}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: form.modelValue,
			prompt: form.promptValue,
			size: "1024x1024",
			n: 1,
		}),
	});

	if (!response.ok) throw new Error(await readHttpError(response));
	await appendEvent("event", `HTTP ${response.status}，开始解析图片响应`);

	const data = await response.json();
	const image = extractImageApiDataUrl(data);
	if (!image) {
		throw new Error("图片接口返回成功，但没有找到 b64_json 或 url 图片数据");
	}

	await completeImage(image, form.promptValue, form.modelValue);
}

async function readHttpError(response: Response): Promise<string> {
	const text = await response.text().catch(() => "");
	return `请求失败：HTTP ${response.status}${text ? `\n${text.slice(0, 500)}` : ""}`;
}

async function readResponseStream(
	stream: ReadableStream<Uint8Array>,
	promptValue: string,
	modelValue: string,
): Promise<void> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const blocks = buffer.split(/\r?\n\r?\n/);
			buffer = blocks.pop() || "";
			for (const block of blocks) {
				if (
					await handleStreamEvent(parseSseBlock(block), promptValue, modelValue)
				)
					return;
			}
		}
		if (
			buffer.trim() &&
			(await handleStreamEvent(parseSseBlock(buffer), promptValue, modelValue))
		)
			return;
		throw new Error(
			streamedText
				? "流式返回结束，但没有找到图片"
				: "流式返回结束，未收到图片",
		);
	} finally {
		reader.releaseLock();
	}
}

function parseSseBlock(block: string): StreamEvent | null {
	let type = "message";
	const dataLines: string[] = [];
	for (const line of block.split(/\r?\n/)) {
		if (!line || line.startsWith(":")) continue;
		const separator = line.indexOf(":");
		const field = separator === -1 ? line : line.slice(0, separator);
		let value = separator === -1 ? "" : line.slice(separator + 1);
		if (value.startsWith(" ")) value = value.slice(1);
		if (field === "event") type = value;
		if (field === "data") dataLines.push(value);
	}
	if (!dataLines.length || dataLines.join("") === "[DONE]") return null;
	return { type, payload: JSON.parse(dataLines.join("\n")) };
}

async function handleStreamEvent(
	event: StreamEvent | null,
	promptValue: string,
	modelValue: string,
): Promise<boolean> {
	if (!event) return false;
	if (event.type !== "response.output_text.delta")
		await appendEvent("event", event.type);

	const partial = extractPartialImageDataUrl(event.payload);
	if (partial) updatePartialImage(partial);

	const delta =
		typeof event.payload.delta === "string" ? event.payload.delta : "";
	if (delta) updateStreamedText(delta);

	const image = extractFinalImageDataUrl(event.payload);
	if (!image) return false;
	await completeImage(image, promptValue, modelValue);
	return true;
}

function updatePartialImage(dataUrl: string): void {
	resultDataUrl = dataUrl;
	resultBlob = dataUrlToBlob(dataUrl);
	statusKind = "info";
	statusText = "已收到预览图，继续等待最终图片...";
}

function updateStreamedText(delta: string): void {
	streamedText += delta;
	if (streamedText.length % 40 < delta.length) {
		appendEvent("text", `文本累计 ${streamedText.length} 字`);
	}
}

async function completeImage(
	dataUrl: string,
	promptValue: string,
	modelValue: string,
): Promise<void> {
	resultDataUrl = dataUrl;
	resultBlob = dataUrl.startsWith("data:") ? dataUrlToBlob(dataUrl) : null;
	generatedSize = resultBlob ? formatBytes(resultBlob.size) : "URL";
	stopTimer();
	statusKind = "done";
	statusText = "图片生成完成";
	await appendEvent("done", `图片已生成，大小 ${generatedSize}`);
	await addToGallery(dataUrl, promptValue, modelValue);
}

function extractPartialImageDataUrl(value: unknown): string {
	if (!value || typeof value !== "object") return "";
	const payload = value as Record<string, unknown>;
	const b64 = payload.partial_image_b64;
	return typeof b64 === "string" && b64 ? `data:image/png;base64,${b64}` : "";
}

function extractFinalImageDataUrl(value: unknown): string {
	if (value == null) return "";
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = extractFinalImageDataUrl(item);
			if (found) return found;
		}
		return "";
	}
	if (typeof value !== "object") return "";
	const obj = value as Record<string, unknown>;
	if (obj.type === "image_generation_call" && typeof obj.result === "string") {
		return `data:image/png;base64,${obj.result}`;
	}
	for (const [key, child] of Object.entries(obj)) {
		if ((key === "result" || key === "b64_json") && typeof child === "string") {
			return `data:image/png;base64,${child}`;
		}
		const found = extractFinalImageDataUrl(child);
		if (found) return found;
	}
	return "";
}

function extractImageApiDataUrl(value: unknown): string {
	if (!value || typeof value !== "object") return "";
	const data = (value as { data?: unknown }).data;
	if (!Array.isArray(data)) return "";
	const firstImage = data.find(
		(item): item is Record<string, unknown> =>
			!!item && typeof item === "object",
	);
	if (!firstImage) return "";
	if (typeof firstImage.b64_json === "string" && firstImage.b64_json) {
		return `data:image/png;base64,${firstImage.b64_json}`;
	}
	if (typeof firstImage.url === "string" && firstImage.url) {
		return firstImage.url;
	}
	return "";
}

function dataUrlToBlob(dataUrl: string): Blob {
	const [meta, b64] = dataUrl.split(",");
	const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
	const bytes = Uint8Array.from(atob(b64), (char) => char.charCodeAt(0));
	return new Blob([bytes], { type: mime });
}

function formatBytes(bytes: number): string {
	const kb = bytes / 1024;
	return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`;
}

function handleGenerationError(error: unknown): void {
	stopTimer();
	statusKind = "error";
	statusText = formatFetchError(error, "图片生成请求失败");
	appendEvent("error", statusText);
}

function formatFetchError(error: unknown, prefix: string): string {
	const message = error instanceof Error ? error.message : String(error);
	if (message === "Failed to fetch" || message.includes("NetworkError")) {
		return `${prefix}：浏览器没有拿到上游响应。常见原因是上游不允许浏览器跨域请求 CORS，或网络/证书被拦截。请换一个支持浏览器直连的 Base URL，或改用服务端 BYOK 代理。`;
	}
	return message;
}

async function loadModels(): Promise<void> {
	if (loadingModels || !apiKey.trim()) return;
	modelPanelOpen = true;
	loadingModels = true;
	modelLoadError = "";
	try {
		const apiBase = normalizeBaseUrl(baseUrl);
		const response = await fetch(`${apiBase}/v1/models`, {
			headers: { Authorization: `Bearer ${apiKey.trim()}` },
		});
		if (!response.ok)
			throw new Error(`模型列表请求失败：HTTP ${response.status}`);
		const data = await response.json();
		modelIds = Array.isArray(data?.data)
			? data.data
					.map((item: { id?: unknown }) => String(item.id || ""))
					.filter(Boolean)
			: [];
		modelPanelOpen = true;
	} catch (error) {
		modelLoadError = formatFetchError(error, "模型列表请求失败");
	} finally {
		loadingModels = false;
	}
}

function openModelPanel(): void {
	modelPanelOpen = true;
}

function pickModel(id: string): void {
	model = id;
	modelPanelOpen = false;
	saveSettings();
}

function openPreview(dataUrl = resultDataUrl): void {
	if (!dataUrl) return;
	previewImage = dataUrl;
	previewScale = 1;
	previewOpen = true;
	document.body.style.overflow = "hidden";
}

function closePreview(): void {
	previewOpen = false;
	document.body.style.overflow = "";
}

function zoomPreview(delta: number): void {
	previewScale = Math.max(0.5, Math.min(4, previewScale + delta));
}

function downloadImage(): void {
	if (!resultBlob) return;
	const url = URL.createObjectURL(resultBlob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `img-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
	link.click();
	URL.revokeObjectURL(url);
}

async function copyImage(): Promise<void> {
	if (!resultBlob) return;
	try {
		await navigator.clipboard.write([
			new ClipboardItem({ [resultBlob.type]: resultBlob }),
		]);
		statusKind = "done";
		statusText = "图片已复制到剪贴板";
	} catch {
		window.alert("复制失败，当前浏览器可能不支持图片写入剪贴板。");
	}
}

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains("records")) {
				request.result.createObjectStore("records", { keyPath: "id" });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function loadGallery(): Promise<void> {
	const db = await openDB();
	const tx = db.transaction("records", "readonly");
	const records = await requestToPromise<GalleryRecord[]>(
		tx.objectStore("records").getAll(),
	);
	gallery = records.sort((a, b) => b.id - a.id);
	db.close();
}

async function addToGallery(
	dataUrl: string,
	promptValue: string,
	modelValue: string,
): Promise<void> {
	const record: GalleryRecord = {
		id: Date.now(),
		dataUrl,
		prompt: promptValue,
		mode: refImages.length ? "image" : "text",
		model: modelValue,
		refs: refImages,
		time: new Date().toLocaleString("zh-CN"),
	};
	gallery = [record, ...gallery];
	await saveRecord(record);
}

async function saveRecord(record: GalleryRecord): Promise<void> {
	const db = await openDB();
	const tx = db.transaction("records", "readwrite");
	tx.objectStore("records").put(record);
	await transactionDone(tx);
	db.close();
}

async function deleteGalleryRecord(id: number): Promise<void> {
	if (!window.confirm("删除这条生成记录？")) return;
	gallery = gallery.filter((record) => record.id !== id);
	const db = await openDB();
	const tx = db.transaction("records", "readwrite");
	tx.objectStore("records").delete(id);
	await transactionDone(tx);
	db.close();
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function transactionDone(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

function renderGalleryState(): void {
	gallery = [...gallery];
}

async function copyPrompt(text: string): Promise<void> {
	await navigator.clipboard.writeText(text);
}
</script>

<div class="space-y-5">
	<div class="grid gap-4">
		<section class="rounded-xl border border-black/10 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03] md:p-5">
			<div class="grid gap-4 md:grid-cols-2">
				<label class="block">
					<span class="mb-1 block text-sm font-medium text-75">Base URL</span>
					<input
						class="h-11 w-full rounded-lg border border-black/10 bg-white/80 px-3 text-sm outline-none transition focus:border-[var(--primary)] dark:border-white/10 dark:bg-black/20"
						bind:value={baseUrl}
						on:change={saveSettings}
						placeholder="https://api.openai.com"
						autocomplete="off"
					/>
				</label>

				<label class="block">
					<span class="mb-1 flex items-center justify-between text-sm font-medium text-75">
						API Key
						<span class="text-xs text-30">用户自己的 Key</span>
					</span>
					<input
						class="h-11 w-full rounded-lg border border-black/10 bg-white/80 px-3 text-sm outline-none transition focus:border-[var(--primary)] dark:border-white/10 dark:bg-black/20"
						bind:value={apiKey}
						on:change={saveSettings}
						type="password"
						placeholder="sk-..."
						autocomplete="off"
					/>
				</label>

				<label class="block md:col-span-2">
					<span class="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-75">
						<span>Model</span>
						<button
							type="button"
							class="rounded-md px-2 py-1 text-xs text-[var(--primary)] hover:bg-[var(--btn-plain-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
							disabled={loadingModels || !apiKey.trim()}
							on:click|preventDefault={loadModels}
						>
							{loadingModels ? "加载中..." : "获取模型列表"}
						</button>
					</span>
					<input
						class="h-11 w-full rounded-lg border border-black/10 bg-white/80 px-3 text-sm outline-none transition focus:border-[var(--primary)] dark:border-white/10 dark:bg-black/20"
						bind:value={model}
						on:focus={openModelPanel}
						on:input={() => (modelPanelOpen = true)}
						on:change={saveSettings}
						placeholder="gpt-5.5"
						autocomplete="off"
					/>
					{#if modelPanelOpen}
						<div class="mt-2 max-h-60 overflow-auto rounded-lg border border-black/10 bg-white p-1 text-sm shadow-xl dark:border-white/10 dark:bg-[var(--float-panel-bg)]">
							{#if loadingModels}
								<div class="px-3 py-2 text-50">正在加载模型...</div>
							{:else if modelLoadError}
								<div class="px-3 py-2 text-red-500">{modelLoadError}</div>
							{:else if visibleModelIds.length}
								{#if isModelFilterEmpty}
									<div class="px-3 py-2 text-xs text-50">
										当前输入没有匹配项，下面显示前 {visibleModelIds.length} 个模型
									</div>
								{/if}
								{#each visibleModelIds as id}
									<button
										type="button"
										class="block w-full rounded-md px-3 py-2 text-left font-mono text-xs text-75 hover:bg-[var(--btn-plain-bg-hover)]"
										on:mousedown|preventDefault={() => pickModel(id)}
									>
										{id}
									</button>
								{/each}
							{:else}
								<div class="px-3 py-2 text-50">可手动输入模型名；需要列表时点击“获取模型列表”</div>
							{/if}
						</div>
					{/if}
				</label>
			</div>

			<label class="mt-3 inline-flex items-center gap-2 text-sm text-50">
				<input class="h-4 w-4 accent-[var(--primary)]" type="checkbox" bind:checked={rememberApiKey} on:change={saveSettings} />
				记住 API Key 到当前浏览器
			</label>

			<div class="mt-4">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm font-medium text-75">参考图片</span>
					<span class="text-xs text-30">可选，多图会进入图生图模式</span>
				</div>
				<input
					bind:this={fileInput}
					class="hidden"
					type="file"
					accept="image/*"
					multiple
					on:change={() => addRefFiles(fileInput.files)}
				/>
				<div class="flex flex-wrap gap-2">
					{#each refImages as ref}
						<div class="group relative h-20 w-20 overflow-hidden rounded-lg border border-black/10 bg-black/5 dark:border-white/10 dark:bg-black/20">
							<button type="button" class="h-full w-full" on:click={() => openPreview(ref.dataUrl)} title={ref.fileName}>
								<img class="h-full w-full object-cover" src={ref.dataUrl} alt={ref.fileName} />
							</button>
							<button
								type="button"
								class="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white group-hover:flex"
								on:click={() => removeRefImage(ref.id)}
								aria-label="移除参考图片"
							>
								<Icon icon="material-symbols:close-rounded" />
							</button>
						</div>
					{/each}
					<button
						type="button"
						class="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-black/15 text-2xl text-30 transition hover:border-[var(--primary)] hover:text-[var(--primary)] dark:border-white/15"
						on:click={() => fileInput.click()}
						aria-label="添加参考图片"
					>
						<Icon icon="material-symbols:add-photo-alternate-outline-rounded" />
					</button>
				</div>
			</div>

			<label class="mt-4 block">
				<span class="mb-1 block text-sm font-medium text-75">图片描述</span>
				<textarea
					class="min-h-28 w-full resize-y rounded-lg border border-black/10 bg-white/80 px-3 py-2 text-sm leading-6 outline-none transition focus:border-[var(--primary)] dark:border-white/10 dark:bg-black/20"
					bind:value={prompt}
					placeholder="例如：一张赛博朋克风格的城市夜景，霓虹灯、雨夜、电影感构图"
					on:keydown={(event) => {
						if ((event.ctrlKey || event.metaKey) && event.key === "Enter") generate();
					}}
				></textarea>
			</label>

			<button
				type="button"
				class="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
				disabled={loading}
				on:click={generate}
			>
				<Icon icon={loading ? "material-symbols:progress-activity" : "material-symbols:imagesmode-outline-rounded"} />
				{loading ? "生成中..." : refImages.length ? "基于参考图生成" : "生成图片"}
			</button>

			{#if statusKind !== "idle"}
				<div
					class="mt-3 rounded-lg border px-3 py-2 text-sm whitespace-pre-wrap"
					class:border-blue-400={statusKind === "info"}
					class:text-blue-500={statusKind === "info"}
					class:border-green-400={statusKind === "done"}
					class:text-green-500={statusKind === "done"}
					class:border-red-400={statusKind === "error"}
					class:text-red-500={statusKind === "error"}
				>
					{statusText}
				</div>
			{/if}

			{#if resultDataUrl}
				<div class="mt-4 text-center">
					<button type="button" on:click={() => openPreview(resultDataUrl)} class="inline-block">
						<img class="max-h-[32rem] rounded-xl border border-black/10 object-contain dark:border-white/10" src={resultDataUrl} alt="生成的图片" />
					</button>
					<div class="mt-2 flex flex-wrap justify-center gap-3 text-xs text-50">
						<span>{generatedSize || "预览图"}</span>
						<span>{eventLines.length} 个事件</span>
						<span>{elapsedSeconds}s</span>
					</div>
					<div class="mt-3 flex flex-wrap justify-center gap-2">
						<button type="button" class="btn-regular h-10 gap-2 rounded-lg px-4" on:click={downloadImage} disabled={!resultBlob}>
							<Icon icon="material-symbols:download-rounded" /> 下载
						</button>
						<button type="button" class="btn-regular h-10 gap-2 rounded-lg px-4" on:click={copyImage} disabled={!resultBlob}>
							<Icon icon="material-symbols:content-copy-outline-rounded" /> 复制
						</button>
					</div>
				</div>
			{/if}
		</section>

		<aside class="rounded-xl border border-black/10 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
			<div class="mb-3 flex items-center justify-between text-sm font-medium text-75">
				<span>实时事件流</span>
				<span class="text-xs text-30">{elapsedSeconds}s</span>
			</div>
			<div class="mb-3 grid grid-cols-2 gap-2 text-xs text-50">
				<div class="rounded-lg bg-black/5 px-3 py-2 dark:bg-black/20">事件 {eventLines.length}</div>
				<div class="rounded-lg bg-black/5 px-3 py-2 dark:bg-black/20">文本 {streamedText.length} 字</div>
			</div>
			<div bind:this={eventLogElement} class="h-72 overflow-auto rounded-lg border border-black/10 bg-black/[0.03] p-2 font-mono text-xs dark:border-white/10 dark:bg-black/20">
				{#if eventLines.length}
					{#each eventLines as line}
						<div class="grid grid-cols-[3.3rem_3rem_minmax(0,1fr)] gap-2 border-b border-black/5 py-1 last:border-0 dark:border-white/5">
							<span class="text-30">{line.time}</span>
							<span
								class:text-blue-500={line.type === "data"}
								class:text-neutral-500={line.type === "text"}
								class:text-green-500={line.type === "done"}
								class:text-red-500={line.type === "error"}
								class:text-amber-500={line.type === "event"}
							>
								{line.type.toUpperCase()}
							</span>
							<span class="break-all text-50">{line.message}</span>
						</div>
					{/each}
				{:else}
					<div class="flex h-full items-center justify-center text-30">生成时会显示上游流式事件</div>
				{/if}
			</div>

			{#if streamedText}
				<div class="mt-3 max-h-40 overflow-auto rounded-lg border border-black/10 bg-black/[0.03] p-3 font-mono text-xs whitespace-pre-wrap text-50 dark:border-white/10 dark:bg-black/20">
					{streamedText}
				</div>
			{/if}
		</aside>
	</div>

	<section class="rounded-xl border border-black/10 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03] md:p-5">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-lg font-bold text-90">图片展馆</h2>
			<span class="text-sm text-50">{gallery.length ? `${gallery.length} 张` : "暂无记录"}</span>
		</div>

		{#if gallery.length}
			<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{#each gallery as record}
					<article class="overflow-hidden rounded-xl border border-black/10 bg-white/80 dark:border-white/10 dark:bg-black/20">
						<button type="button" class="relative block w-full" on:click={() => openPreview(record.dataUrl)}>
							<img class="aspect-square w-full object-cover" src={record.dataUrl} alt="生成记录" loading="lazy" />
							<span class="absolute right-2 top-2 rounded-full bg-black/65 px-2 py-1 text-xs text-white">
								{record.mode === "text" ? "文生图" : "图生图"}
							</span>
						</button>
						{#if record.refs.length}
							<div class="flex gap-1 px-3 pt-3">
								{#each record.refs as ref}
									<button type="button" class="h-11 w-11 overflow-hidden rounded-md border border-black/10 dark:border-white/10" on:click={() => openPreview(ref.dataUrl)}>
										<img class="h-full w-full object-cover" src={ref.dataUrl} alt={ref.fileName} />
									</button>
								{/each}
							</div>
						{/if}
						<div class="space-y-2 p-3">
							<p class="line-clamp-3 text-sm leading-6 text-75" title={record.prompt}>{record.prompt}</p>
							<div class="flex items-center justify-between gap-2 text-xs text-30">
								<span>{record.time}</span>
								<div class="flex gap-1">
									<button type="button" class="btn-plain h-8 w-8 rounded-md" on:click={() => copyPrompt(record.prompt)} title="复制提示词">
										<Icon icon="material-symbols:content-copy-outline-rounded" />
									</button>
									<button type="button" class="btn-plain h-8 w-8 rounded-md hover:text-red-500" on:click={() => deleteGalleryRecord(record.id)} title="删除记录">
										<Icon icon="material-symbols:delete-outline-rounded" />
									</button>
								</div>
							</div>
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<div class="rounded-xl border border-dashed border-black/10 py-10 text-center text-sm text-30 dark:border-white/10">
				暂无生成记录
			</div>
		{/if}
	</section>
</div>

{#if previewOpen}
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<button
			type="button"
			class="absolute inset-0 cursor-zoom-out"
			on:click={closePreview}
			aria-label="关闭预览"
		></button>
		<button
			type="button"
			class="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white"
			on:click={closePreview}
			aria-label="关闭预览"
		>
			<Icon icon="material-symbols:close-rounded" />
		</button>
		<div class="absolute bottom-5 z-10 flex gap-2">
			<button type="button" class="rounded-lg bg-white/10 px-3 py-2 text-sm text-white" on:click|stopPropagation={() => zoomPreview(-0.25)}>缩小</button>
			<button type="button" class="rounded-lg bg-white/10 px-3 py-2 text-sm text-white" on:click|stopPropagation={() => zoomPreview(0.25)}>放大</button>
		</div>
		<img
			class="relative z-0 max-h-[86vh] max-w-[92vw] rounded-lg object-contain transition"
			style={`transform: scale(${previewScale})`}
			src={previewImage}
			alt="图片预览"
		/>
	</div>
{/if}
