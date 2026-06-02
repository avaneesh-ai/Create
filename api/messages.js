const ALLOWED_MODELS = new Set([
  "gpt-oss:120b",
  "gpt-oss:20b",
  "gpt-oss",
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Use POST for Ollama Cloud messages." });
  }

  if (!process.env.OLLAMA_API_KEY) {
    return sendJson(res, 503, { error: "Ollama Cloud backend is not configured." });
  }

  let body;

  try {
    body = await parseRequestBody(req);
  } catch {
    return sendJson(res, 400, { error: "Invalid message request." });
  }

  const model = ALLOWED_MODELS.has(body.model) ? body.model : "gpt-oss:120b";
  const maxTokens = Math.min(Math.max(Number(body.max_tokens) || 1000, 128), 2000);
  const messages = Array.isArray(body.messages)
    ? body.messages.map(normalizeMessage).filter(Boolean).slice(-24)
    : [];

  if (!messages.some((message) => message.role === "user")) {
    return sendJson(res, 400, { error: "Add a user message before calling Ollama Cloud." });
  }

  try {
    const ollamaResponse = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OLLAMA_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: false,
        options: {
          num_predict: maxTokens,
        },
      }),
    });

    const data = await ollamaResponse.json().catch(() => ({}));

    if (!ollamaResponse.ok) {
      return sendJson(res, ollamaResponse.status, {
        error: data?.error || "Ollama Cloud request failed.",
      });
    }

    const text = typeof data?.message?.content === "string" ? data.message.content.trim() : "";

    return sendJson(res, 200, {
      content: [{ type: "text", text }],
      output_text: text,
    });
  } catch {
    return sendJson(res, 502, { error: "Could not reach Ollama Cloud." });
  }
};
