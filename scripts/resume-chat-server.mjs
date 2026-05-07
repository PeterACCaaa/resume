import http from "node:http";
import {
	askResumeQuestion,
	collectMarkdownContext,
	getResumeChatConfig,
} from "../src/server/resume-chat-core.mjs";

const PORT = Number(process.env.RESUME_CHAT_PORT || 8787);
const KNOWLEDGE_CONTEXT = collectMarkdownContext();

function sendJson(res, statusCode, payload) {
	res.writeHead(statusCode, {
		"Content-Type": "application/json; charset=utf-8",
		"Access-Control-Allow-Origin": "http://localhost:4321",
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Allow-Methods": "POST, OPTIONS",
	});
	res.end(JSON.stringify(payload));
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
		sendJson(res, 204, {});
		return;
	}

	if (req.method !== "POST" || req.url !== "/api/resume-chat") {
		sendJson(res, 404, { error: "Not found" });
		return;
	}

	try {
		const rawBody = await readRequestBody(req);
		const body = JSON.parse(rawBody || "{}");
		const question = String(body.question || "").trim();

		if (!question) {
			sendJson(res, 400, { error: "question is required" });
			return;
		}

		const result = await askResumeQuestion(question, {
			context: KNOWLEDGE_CONTEXT,
		});
		sendJson(res, 200, result);
	} catch (error) {
		sendJson(res, 500, {
			error: error instanceof Error ? error.message : String(error),
		});
	}
});

server.listen(PORT, () => {
	const config = getResumeChatConfig();
	console.log(`Resume chat API: http://localhost:${PORT}/api/resume-chat`);
	console.log(`Model: ${config.model}`);
	console.log(`OpenAI base URL: ${config.baseUrl}`);
});
