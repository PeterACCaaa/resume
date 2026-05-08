import {
	collectMarkdownContext,
	streamResumeAnswer,
} from "../src/server/resume-chat-core.mjs";

const KNOWLEDGE_CONTEXT = collectMarkdownContext(process.cwd());

function sendJson(res, statusCode, payload) {
	res.statusCode = statusCode;
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	res.setHeader("Cache-Control", "no-store");
	res.end(JSON.stringify(payload));
}

function startSse(res) {
	res.writeHead(200, {
		"Content-Type": "text/event-stream; charset=utf-8",
		"Cache-Control": "no-cache, no-transform",
		Connection: "keep-alive",
	});
}

function writeSse(res, event, payload = {}) {
	res.write(`event: ${event}\n`);
	res.write(`data: ${JSON.stringify(payload)}\n\n`);
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

		startSse(res);
		for await (const delta of streamResumeAnswer(question, {
			context: KNOWLEDGE_CONTEXT,
		})) {
			writeSse(res, "delta", { text: delta });
		}
		writeSse(res, "done");
		res.end();
	} catch (error) {
		if (!res.headersSent) {
			sendJson(res, 500, {
				error: error instanceof Error ? error.message : String(error),
			});
			return;
		}

		writeSse(res, "error", {
			message: error instanceof Error ? error.message : String(error),
		});
		res.end();
	}
}
