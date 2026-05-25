import { generateDtcPage } from "../src/server/dtc-page-copilot-core.mjs";

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
		const result = await generateDtcPage(req.body);
		sendJson(res, 200, result);
	} catch (error) {
		sendJson(res, error?.statusCode || 500, {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
