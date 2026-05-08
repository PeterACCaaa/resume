import http from "node:http";
import {
	collectMarkdownContext,
	getResumeChatConfig,
	streamResumeAnswer,
} from "../src/server/resume-chat-core.mjs";

const PORT = Number(process.env.RESUME_CHAT_PORT || 8787);
const KNOWLEDGE_CONTEXT = collectMarkdownContext();

function getAllowedOrigin(req) {
	const origin = req?.headers?.origin;
	if (!origin) return "http://localhost:4321";

	try {
		const url = new URL(origin);
		const isDevHost =
			url.hostname === "localhost" ||
			url.hostname === "127.0.0.1" ||
			url.hostname.startsWith("192.168.") ||
			url.hostname.startsWith("10.") ||
			url.hostname.startsWith("172.");
		const isAstroDevPort = url.port === "4321";

		if (isDevHost && isAstroDevPort) {
			return origin;
		}
	} catch {
		return "http://localhost:4321";
	}

	return "http://localhost:4321";
}

function sendJson(req, res, statusCode, payload) {
	res.writeHead(statusCode, {
		"Content-Type": "application/json; charset=utf-8",
		"Access-Control-Allow-Origin": getAllowedOrigin(req),
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Allow-Methods": "POST, OPTIONS",
	});
	res.end(JSON.stringify(payload));
}

function startSse(req, res) {
	res.writeHead(200, {
		"Content-Type": "text/event-stream; charset=utf-8",
		"Cache-Control": "no-cache, no-transform",
		Connection: "keep-alive",
		"Access-Control-Allow-Origin": getAllowedOrigin(req),
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Allow-Methods": "POST, OPTIONS",
	});
}

function writeSse(res, event, payload = {}) {
	res.write(`event: ${event}\n`);
	res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function readRequestBody(req) {
	return new Promise((resolve, reject) => {
		let body = "";
		req.on("data", (chunk) => {
			body += chunk;
			if (body.length > 20_000) {
				reject(new Error("Request body too large"));
				req.destroy();
			}
		});
		req.on("end", () => resolve(body));
		req.on("error", reject);
	});
}

const server = http.createServer(async (req, res) => {
	if (req.method === "OPTIONS") {
		sendJson(req, res, 204, {});
		return;
	}

	if (req.method !== "POST" || req.url !== "/api/resume-chat") {
		sendJson(req, res, 404, { error: "Not found" });
		return;
	}

	try {
		const rawBody = await readRequestBody(req);
		const body = JSON.parse(rawBody || "{}");
		const question = String(body.question || "").trim();

		if (!question) {
			sendJson(req, res, 400, { error: "question is required" });
			return;
		}

		startSse(req, res);
		for await (const delta of streamResumeAnswer(question, {
			context: KNOWLEDGE_CONTEXT,
		})) {
			writeSse(res, "delta", { text: delta });
		}
		writeSse(res, "done");
		res.end();
	} catch (error) {
		if (!res.headersSent) {
			sendJson(req, res, 500, {
				error: error instanceof Error ? error.message : String(error),
			});
			return;
		}

		writeSse(res, "error", {
			message: error instanceof Error ? error.message : String(error),
		});
		res.end();
	}
});

server.listen(PORT, () => {
	const config = getResumeChatConfig();
	console.log(`Resume chat API: http://localhost:${PORT}/api/resume-chat`);
	console.log(`Model: ${config.model}`);
	console.log(`OpenAI base URL: ${config.baseUrl}`);
});
