import http from "node:http";
import {
	generateDtcPage,
	getDtcCopilotConfig,
} from "../src/server/dtc-page-copilot-core.mjs";

const PORT = Number(process.env.DTC_COPILOT_PORT || 8788);

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
		"Cache-Control": "no-store",
		"Access-Control-Allow-Origin": getAllowedOrigin(req),
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
			if (body.length > 1_800_000) {
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

	if (req.method !== "POST" || req.url !== "/api/dtc-page-copilot") {
		sendJson(req, res, 404, { error: "Not found" });
		return;
	}

	try {
		const rawBody = await readRequestBody(req);
		const body = JSON.parse(rawBody || "{}");
		const result = await generateDtcPage(body);
		sendJson(req, res, 200, result);
	} catch (error) {
		sendJson(req, res, error?.statusCode || 500, {
			error: error instanceof Error ? error.message : String(error),
		});
	}
});

server.listen(PORT, () => {
	const config = getDtcCopilotConfig();
	console.log(`DTC page copilot API: http://localhost:${PORT}/api/dtc-page-copilot`);
	console.log(`Model: ${config.model}`);
	console.log(`OpenAI base URL: ${config.baseUrl}`);
});
