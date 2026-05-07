import { askResumeQuestion, collectMarkdownContext } from "../src/server/resume-chat-core.mjs";

const KNOWLEDGE_CONTEXT = collectMarkdownContext(process.cwd());

function sendJson(res, statusCode, payload) {
	res.statusCode = statusCode;
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	res.setHeader("Cache-Control", "no-store");
	res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
	if (req.method !== "POST") {
		sendJson(res, 405, { error: "Method not allowed" });
		return;
	}

	try {
		const question = String(req.body?.question || "").trim();
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
}
