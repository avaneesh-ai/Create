const ALLOWED_MODELS = new Set([
  "gpt-5.4-nano",
  "gpt-5.4-mini",
  "gpt-4.1-nano",
]);

const SYSTEM_PROMPT = [
  "You are the Create_AI Assistant, a friendly AI chatbot inside the Create_AI app.",
  "Answer clearly and helpfully like a high-quality assistant.",
  "Refuse harmful, illegal, deceptive, credential-stealing, malware, self-harm, hateful, or sexual-minor content.",
  "For app-building requests, ask for missing project details and give practical next steps.",
].join(" ");

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function parseRequestBody(req) {
  if (req.body && typeof req.body === "object") {
    return Promise.resolve(req.body);
  }

  if (typeof req.body === "string") {
    return Promise.resolve(JSON.parse(req.body || "{}"));
  }

  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;

      if (raw.length > 120000) {
        reject(new Error("Request body is too large."));
      }
    });

    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function normalizeMessage(message) {
  const role = message?.role;
  const content = typeof message?.content === "string" ? message.content.trim() : "";

  if ((role !== "user" && role !== "assistant") || !content) {
    return null;
  }

  return {
    role,
    content: content.slice(0, 4000),
  };
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string") {
    return data.output_text.trim();
  }

  if (!Array.isArray(data?.output)) {
    return "";
  }

  return data.output
    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .filter((item) => item.type === "output_text" || item.type === "text")
    .map((item) => item.text || "")
    .join("\n")
    .trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Use POST for OpenAI messages." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 503, { error: "OpenAI backend is not configured." });
  }

  let body;

  try {
    body = await parseRequestBody(req);
  } catch {
    return sendJson(res, 400, { error: "Invalid message request." });
  }

  const model = ALLOWED_MODELS.has(body.model) ? body.model : "gpt-5.4-nano";
  const maxTokens = Math.min(Math.max(Number(body.max_tokens) || 1000, 128), 2000);
  const messages = Array.isArray(body.messages)
    ? body.messages.map(normalizeMessage).filter(Boolean).slice(-24)
    : [];

  if (!messages.some((message) => message.role === "user")) {
    return sendJson(res, 400, { error: "Add a user message before calling OpenAI." });
  }

  try {
    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        instructions: SYSTEM_PROMPT,
        input: messages,
        max_output_tokens: maxTokens,
      }),
    });

    const data = await openAIResponse.json().catch(() => ({}));

    if (!openAIResponse.ok) {
      return sendJson(res, openAIResponse.status, {
        error: data?.error?.message || "OpenAI request failed.",
      });
    }

    const text = extractOutputText(data);

    return sendJson(res, 200, {
      content: [{ type: "text", text }],
      output_text: text,
    });
  } catch {
    return sendJson(res, 502, { error: "Could not reach OpenAI." });
  }
};
