const SESSION_TTL_MS = 15 * 60 * 1000;
const PENDING_TTL_MS = 10 * 60 * 1000;
const LOGIN_LOCK_MS = 30 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_ATTEMPTS_KEY = "createAI:loginAttempts";

const state = {
  email: "",
  name: "",
  mobile: "",
  token: "",
};

const screens = {
  account: document.querySelector("#account-form"),
  profile: document.querySelector("#profile-form"),
  sent: document.querySelector("#sent-screen"),
  confirm: document.querySelector("#confirm-screen"),
};

const dots = {
  account: document.querySelector('[data-step-dot="account"]'),
  profile: document.querySelector('[data-step-dot="profile"]'),
  verify: document.querySelector('[data-step-dot="verify"]'),
};

const fields = {
  email: document.querySelector("#email"),
  password: document.querySelector("#password"),
  name: document.querySelector("#full-name"),
  mobile: document.querySelector("#mobile"),
};

const errors = {
  email: document.querySelector("#email-error"),
  password: document.querySelector("#password-error"),
  name: document.querySelector("#name-error"),
  mobile: document.querySelector("#mobile-error"),
};

const passwordStrength = {
  bar: document.querySelector("#password-strength-bar"),
  label: document.querySelector("#password-strength-label"),
};

const authShell = document.querySelector("#auth-shell");
const appShell = document.querySelector("#app-shell");

const chatElements = {
  messages: document.querySelector("#chat-messages"),
  form: document.querySelector("#chat-form"),
  input: document.querySelector("#chat-input"),
  model: document.querySelector("#chat-model"),
  clear: document.querySelector("#clear-chat"),
};

const createElements = {
  form: document.querySelector("#create-form"),
  status: document.querySelector("#publish-status"),
  area: document.querySelector("#generated-area"),
  title: document.querySelector("#generated-title"),
  preview: document.querySelector("#generated-preview"),
  code: document.querySelector("#generated-code"),
  showPreview: document.querySelector("#show-preview"),
  showCode: document.querySelector("#show-code"),
  copy: document.querySelector("#copy-generated-app"),
  publish: document.querySelector("#publish-generated-app"),
  open: document.querySelector("#open-generated-app"),
  download: document.querySelector("#download-generated-app"),
  updateForm: document.querySelector("#update-form"),
  updateRequest: document.querySelector("#update-request"),
  fields: {
    name: document.querySelector("#project-name"),
    problem: document.querySelector("#project-problem"),
    inputs: document.querySelector("#project-inputs"),
    outputs: document.querySelector("#project-outputs"),
  },
  errors: {
    name: document.querySelector("#project-name-error"),
    problem: document.querySelector("#project-problem-error"),
    inputs: document.querySelector("#project-inputs-error"),
    outputs: document.querySelector("#project-outputs-error"),
  },
};

const publishElements = {
  modal: document.querySelector("#publish-modal"),
  close: document.querySelector("#close-publish-modal"),
  download: document.querySelector("#publish-download-link"),
  copy: document.querySelector("#publish-copy-code"),
};

const installElements = {
  button: document.querySelector("#install-create-ai"),
  modal: document.querySelector("#install-modal"),
  close: document.querySelector("#close-install-modal"),
};

const appTypes = [
  { id: "general-assistant", title: "ChatGPT style", sub: "General answers" },
  { id: "coding-assistant", title: "Codex style", sub: "Code and debugging" },
  { id: "writing-assistant", title: "ChatGPT style", sub: "Writing and reasoning" },
  { id: "study-tutor", title: "Study tutor", sub: "Lessons and quizzes" },
  { id: "support-chatbot", title: "Support bot", sub: "Customer help" },
  { id: "business-dashboard", title: "Dashboard", sub: "Data and tasks" },
  { id: "workflow-tool", title: "Workflow tool", sub: "Plans and process" },
  { id: "custom", title: "Custom", sub: "Your own idea" },
];

const purposeOptions = [
  { id: "answer", title: "Answer questions", sub: "Chat replies" },
  { id: "code", title: "Create code", sub: "Snippets and fixes" },
  { id: "write", title: "Write content", sub: "Drafts and edits" },
  { id: "analyze", title: "Analyze input", sub: "Summaries and insights" },
  { id: "plan", title: "Plan tasks", sub: "Steps and schedules" },
  { id: "teach", title: "Teach users", sub: "Guides and quizzes" },
  { id: "support", title: "Support users", sub: "Answers and triage" },
  { id: "publish", title: "Publish app", sub: "Downloadable HTML" },
  { id: "update", title: "Update later", sub: "Change requests" },
];

const featureOptions = [
  { id: "chat", title: "Chat screen", sub: "Assistant interface" },
  { id: "code-panel", title: "Code panel", sub: "Show generated code" },
  { id: "dashboard", title: "Dashboard", sub: "Metrics and cards" },
  { id: "forms", title: "Smart forms", sub: "Validated inputs" },
  { id: "download", title: "Download", sub: "Save HTML app" },
  { id: "history", title: "History", sub: "Local saved results" },
  { id: "reset", title: "Reset", sub: "Clear app state" },
  { id: "safety", title: "Safety", sub: "Input guardrails" },
];

let selectedAppType = "coding-assistant";
let selectedPurposes = new Set(["answer", "code", "analyze", "publish", "update"]);
let selectedFeatures = new Set(["chat", "code-panel", "forms", "download", "safety"]);
let chatMessages = [];
let typingTimer = null;
let createdProject = null;
let generatedAppUrl = "";
let deferredInstallPrompt = null;

function cleanText(value, maxLength = 1500) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeJson(value) {
  return JSON.stringify(String(value || "")).replaceAll("<", "\\u003c");
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugify(value) {
  const slug = cleanText(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "generated-app";
}

function getFirstName() {
  return state.name.trim().split(/\s+/)[0] || "there";
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");

  dots.account.classList.toggle("active", name === "account");
  dots.account.classList.toggle("done", name !== "account");
  dots.profile.classList.toggle("active", name === "profile");
  dots.profile.classList.toggle("done", ["sent", "confirm"].includes(name));
  dots.verify.classList.toggle("active", ["sent", "confirm"].includes(name));
}

function setError(key, message) {
  errors[key].textContent = message;
}

function clearErrors() {
  Object.values(errors).forEach((error) => {
    error.textContent = "";
  });
}

function setCreateError(key, message) {
  createElements.errors[key].textContent = message;
}

function clearCreateErrors() {
  Object.values(createElements.errors).forEach((error) => {
    error.textContent = "";
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidMobile(value) {
  return /^[0-9+\-\s()]{7,16}$/.test(value);
}

function getPasswordScore(value) {
  let score = 0;

  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  return Math.min(score, 4);
}

function updatePasswordStrength() {
  const score = getPasswordScore(fields.password.value);
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["#b4232c", "#c2532f", "#d08a2e", "#2c7a6b", "#0d766e"];

  passwordStrength.bar.style.width = `${Math.max(6, (score / 4) * 100)}%`;
  passwordStrength.bar.style.background = colors[score];
  passwordStrength.label.textContent = fields.password.value ? labels[score] : "Enter at least 8 characters.";
}

function isStrongPassword(value) {
  return value.length >= 8 && getPasswordScore(value) >= 3;
}

function createToken() {
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getBaseUrl() {
  return window.location.href.split("#")[0];
}

function getPersistableUser() {
  return {
    email: state.email,
    name: state.name,
    mobile: state.mobile,
  };
}

function getSessionUser() {
  return {
    ...getPersistableUser(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
}

function getPendingUser() {
  return {
    ...getPersistableUser(),
    token: state.token,
    expiresAt: Date.now() + PENDING_TTL_MS,
  };
}

function getStoredUser() {
  const saved = sessionStorage.getItem("createAI:user");

  if (!saved) {
    return null;
  }

  try {
    const user = JSON.parse(saved);

    if (!user.expiresAt || Date.now() > user.expiresAt) {
      sessionStorage.removeItem("createAI:user");
      return null;
    }

    return user;
  } catch {
    sessionStorage.removeItem("createAI:user");
    return null;
  }
}

function savePendingUser() {
  localStorage.setItem("createAI:pendingUser", JSON.stringify(getPendingUser()));
}

function loadPendingUser() {
  const saved = localStorage.getItem("createAI:pendingUser");

  if (!saved) {
    return false;
  }

  try {
    const pending = JSON.parse(saved);

    if (!pending.expiresAt || Date.now() > pending.expiresAt) {
      localStorage.removeItem("createAI:pendingUser");
      return false;
    }

    Object.assign(state, pending);
    return Boolean(state.email && state.token);
  } catch {
    localStorage.removeItem("createAI:pendingUser");
    return false;
  }
}

function getChatKey() {
  return `createAI:chat:${state.email || "guest"}`;
}

function getProjectKey() {
  return `createAI:projects:${state.email || "guest"}`;
}

function getCurrentProjectKey() {
  return `createAI:currentProject:${state.email || "guest"}`;
}

function getLoginAttempts() {
  const saved = localStorage.getItem(LOGIN_ATTEMPTS_KEY);

  if (!saved) {
    return { count: 0, lockedUntil: 0 };
  }

  try {
    return JSON.parse(saved);
  } catch {
    localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
    return { count: 0, lockedUntil: 0 };
  }
}

function setLoginAttempts(attempts) {
  localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(attempts));
}

function isLoginLocked() {
  const attempts = getLoginAttempts();

  if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
    return Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
  }

  if (attempts.lockedUntil && Date.now() >= attempts.lockedUntil) {
    localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
  }

  return 0;
}

function recordFailedLoginAttempt() {
  const attempts = getLoginAttempts();
  const nextCount = (attempts.count || 0) + 1;

  setLoginAttempts({
    count: nextCount,
    lockedUntil: nextCount >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOGIN_LOCK_MS : 0,
  });
}

function sendVerificationLink() {
  state.token = createToken();
  savePendingUser();

  const link = `${getBaseUrl()}#verify=${encodeURIComponent(state.token)}`;
  const verificationLink = document.querySelector("#verification-link");

  document.querySelector("#mail-to").textContent = `To: ${state.email}`;
  verificationLink.href = link;
}

function finishLogin() {
  sessionStorage.setItem("createAI:user", JSON.stringify(getSessionUser()));
  localStorage.removeItem("createAI:pendingUser");
  window.location.hash = "";
  enterApp();
}

function handleVerificationRoute() {
  if (!window.location.hash.startsWith("#verify=")) {
    return false;
  }

  const token = decodeURIComponent(window.location.hash.replace("#verify=", ""));

  if (!loadPendingUser() || token !== state.token) {
    showScreen("account");
    return true;
  }

  document.querySelector("#confirm-email").textContent = state.email;
  showScreen("confirm");
  return true;
}

function updateSessionStatus() {
  const user = getStoredUser();
  const sessionExpiry = document.querySelector("#session-expiry");

  if (!user) {
    sessionExpiry.textContent = "Auto-lock";
    return;
  }

  const minutes = Math.max(1, Math.ceil((user.expiresAt - Date.now()) / 60000));
  sessionExpiry.textContent = `Locks in ${minutes} min`;
}

function refreshSessionExpiry() {
  if (appShell.classList.contains("hidden")) {
    return;
  }

  const saved = getStoredUser();

  if (!saved) {
    return;
  }

  sessionStorage.setItem("createAI:user", JSON.stringify({ ...saved, expiresAt: Date.now() + SESSION_TTL_MS }));
  updateSessionStatus();
}

function enterApp() {
  const savedUser = getStoredUser();

  if (savedUser) {
    Object.assign(state, savedUser);
  }

  authShell.classList.add("hidden");
  appShell.classList.remove("hidden");
  document.querySelector("#welcome-name").textContent = `Welcome, ${state.name}`;
  document.querySelector("#sidebar-name").textContent = state.name;
  document.querySelector("#sidebar-email").textContent = state.email;
  document.querySelector("#account-email").textContent = state.email;
  document.querySelector("#account-mobile").textContent = state.mobile;
  updateSessionStatus();
  loadChat();
  loadCurrentProject();
  renderProjects();
}

function secureLogout({ clearStoredSession = true } = {}) {
  if (typingTimer) {
    window.clearTimeout(typingTimer);
    typingTimer = null;
  }

  if (generatedAppUrl) {
    URL.revokeObjectURL(generatedAppUrl);
    generatedAppUrl = "";
  }

  if (clearStoredSession) {
    sessionStorage.removeItem("createAI:user");
  }

  fields.password.value = "";
  appShell.classList.add("hidden");
  authShell.classList.remove("hidden");
  showScreen("account");
}

function clearAllLocalData() {
  if (generatedAppUrl) {
    URL.revokeObjectURL(generatedAppUrl);
    generatedAppUrl = "";
  }

  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("createAI:")) {
      localStorage.removeItem(key);
    }
  });
  sessionStorage.removeItem("createAI:user");
  Object.assign(state, { email: "", name: "", mobile: "", token: "" });
  chatMessages = [];
  createdProject = null;
  createElements.area.classList.add("hidden");
  createElements.status.textContent = "Not created";
  createElements.status.classList.remove("live");
  Object.values(createElements.fields).forEach((field) => {
    if (field.tagName !== "SELECT") {
      field.value = "";
    }
  });
  secureLogout({ clearStoredSession: false });
}

function showSection(name) {
  document.querySelectorAll(".nav-tabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === name);
  });
  document.querySelectorAll(".app-section").forEach((section) => {
    section.classList.toggle("active", section.id === `section-${name}`);
  });
}

function createWelcomeMessage() {
  return {
    role: "assistant",
    text: `Hi ${getFirstName()}. I can help like a ChatGPT or Codex style assistant. I will use ${getSelectedOpenAIModelLabel()} when the OpenAI backend is connected, and I will keep answering in local chatbot mode when it is not connected.`,
  };
}

function saveChat() {
  localStorage.setItem(getChatKey(), JSON.stringify(chatMessages.slice(-80)));
  document.querySelector("#home-chat-summary").textContent = `${Math.max(chatMessages.length - 1, 0)} messages`;
}

function loadChat() {
  const saved = localStorage.getItem(getChatKey());

  if (!saved) {
    chatMessages = [createWelcomeMessage()];
    renderChat();
    saveChat();
    return;
  }

  try {
    chatMessages = JSON.parse(saved);
  } catch {
    chatMessages = [createWelcomeMessage()];
  }

  if (!Array.isArray(chatMessages) || chatMessages.length === 0) {
    chatMessages = [createWelcomeMessage()];
  }

  renderChat();
  saveChat();
}

function renderChat() {
  chatElements.messages.replaceChildren();

  chatMessages.forEach((message) => {
    const bubble = document.createElement("div");
    bubble.className = `message ${message.role}`;
    bubble.textContent = message.text;
    chatElements.messages.append(bubble);
  });

  chatElements.messages.scrollTop = chatElements.messages.scrollHeight;
}

function addChatMessage(role, text) {
  chatMessages.push({ role, text });
  renderChat();
  saveChat();
}

function showTypingMessage() {
  const bubble = document.createElement("div");
  bubble.className = "message assistant typing";
  bubble.textContent = "Thinking...";
  chatElements.messages.append(bubble);
  chatElements.messages.scrollTop = chatElements.messages.scrollHeight;
  return bubble;
}

function removeTypingMessage(bubble) {
  if (bubble && bubble.parentNode) {
    bubble.remove();
  }
}

function getPromptSubject(prompt) {
  const cleaned = cleanText(prompt, 260).trim();

  return cleaned
    .replace(/^(please\s+)?(can you|could you|would you|help me|i need|i want|tell me|give me|make|create|build|write|draft|compose|explain|summarize|compare|review|fix|improve|generate|answer)\b\s*/i, "")
    .replace(/^(what is|what are|what does|what causes|why should|why does|why do|how does|how do|how can i|how to|who is|where is|when is|which is|should i)\b\s*/i, "")
    .replace(/^(i|we|you)\s+/i, "")
    .replace(/^(bullet points for|bullets for|list of|points for|learn|study|understand)\b\s*/i, "")
    .replace(/[?!.]+$/g, "")
    .replace(/^(a|an|the|about|for|to|with|this|that)\s+/i, "")
    .trim() || cleaned || "your question";
}

function formatTopic(value) {
  const topic = cleanText(value, 220).replace(/\s+/g, " ").trim();

  if (!topic) {
    return "that topic";
  }

  return topic.charAt(0).toUpperCase() + topic.slice(1);
}

function isUnsafePrompt(text) {
  return includesAny(text, ["malware", "phishing", "steal password", "credential harvesting", "virus", "bypass login", "hack account"]);
}

function buildMathAnswer(prompt) {
  const match = prompt.match(/(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)/);

  if (!match) {
    return "";
  }

  const left = Number(match[1]);
  const operator = match[2];
  const right = Number(match[3]);

  if (operator === "/" && right === 0) {
    return "That cannot be divided by zero.";
  }

  const result = {
    "+": left + right,
    "-": left - right,
    "*": left * right,
    "/": left / right,
  }[operator];

  return `${match[1]} ${operator} ${match[3]} = ${Number.isInteger(result) ? result : Number(result.toFixed(6))}`;
}

function buildCodeAnswer(prompt) {
  const lower = prompt.toLowerCase();
  const subject = getPromptSubject(prompt);
  const lines = [
    `Code help for ${subject}:`,
    "1. Reproduce the issue in the smallest possible example.",
    "2. Check the selector, input, expected result, and current result.",
    "3. Fix one behavior at a time.",
    "4. Test the exact user flow again.",
  ];

  if (includesAny(lower, ["button", "click", "event"])) {
    lines.push("");
    lines.push("Example:");
    lines.push('const button = document.querySelector("#action");');
    lines.push('const result = document.querySelector("#result");');
    lines.push("");
    lines.push('button.addEventListener("click", () => {');
    lines.push('  result.textContent = "Action complete";');
    lines.push("});");
  } else if (includesAny(lower, ["html", "css"])) {
    lines.push("");
    lines.push("For frontend work, keep structure in HTML, visual design in CSS, and behavior in JavaScript.");
  } else {
    lines.push("");
    lines.push("Paste the code or error message and I can turn this into a tighter fix.");
  }

  return lines.join("\n");
}

function buildWritingAnswer(prompt) {
  const subject = getPromptSubject(prompt);

  if (prompt.toLowerCase().includes("email")) {
    return `Subject: ${subject}\n\nHi,\n\nI hope you are doing well. I am writing about ${subject}. I wanted to share the key details clearly and confirm the next step.\n\nPlease let me know if you would like any changes.\n\nBest,\n${state.name || "Me"}`;
  }

  if (prompt.toLowerCase().includes("description")) {
    return `Create_AI helps users turn a project idea into a safe browser app with guided choices, a local AI chatbot, downloadable output, and update requests after the first version is created.`;
  }

  return `Here is a polished draft:\n\n${subject}\n\nThe strongest version should be clear, specific, and easy to act on. Start with the goal, add the important detail, and end with the exact next step.`;
}

function buildAppPlanningAnswer(prompt) {
  const lower = prompt.toLowerCase();
  const type = lower.includes("codex") || lower.includes("code") ? "Codex style coding assistant" : lower.includes("claude") || lower.includes("writing") ? "Claude style writing assistant" : lower.includes("chatgpt") ? "ChatGPT style general assistant" : "AI app";

  return `${type} plan:\n1. Project name: give it a clear product name.\n2. Purpose/problem: describe what the assistant should solve.\n3. User input: list prompts, code, files described as text, examples, or tasks the user gives.\n4. Expected output: answer, plan, generated code, explanation, or downloadable app.\n5. Refinement: use the follow-up update box after the first version is generated.\n\nCreate_AI now uses those four fields as the source of truth instead of inventing a random purpose.`;
}

function buildKnownTopicAnswer(prompt) {
  const lower = prompt.toLowerCase();
  const topics = [
    {
      keywords: ["rain"],
      answer: "Rain happens when water evaporates, rises into the air, cools into clouds, and then falls back to the ground as droplets when the clouds become heavy enough.",
    },
    {
      keywords: ["water cycle"],
      answer: "The water cycle is the movement of water between oceans, land, air, clouds, and rain. It includes evaporation, condensation, precipitation, and collection.",
    },
    {
      keywords: ["photosynthesis"],
      answer: "Photosynthesis is how plants use sunlight, water, and carbon dioxide to make food. It also releases oxygen into the air.",
    },
    {
      keywords: ["gravity"],
      answer: "Gravity is the force that pulls objects toward each other. On Earth, it pulls things toward the ground and keeps the Moon moving around Earth.",
    },
    {
      keywords: ["electricity"],
      answer: "Electricity is the movement of electric charge. It powers lights, phones, computers, motors, and many other devices.",
    },
    {
      keywords: ["internet"],
      answer: "The internet is a global network of connected computers and servers. It lets devices send information, open websites, use apps, and communicate across the world.",
    },
    {
      keywords: ["blockchain"],
      answer: "Blockchain is a shared digital record that stores information in connected blocks. It is often used when people want a record that is hard to change without everyone noticing.",
    },
    {
      keywords: ["artificial intelligence", " ai ", "ai"],
      answer: "Artificial intelligence is software that can recognize patterns, understand prompts, generate text or images, make predictions, and help users complete tasks.",
    },
    {
      keywords: ["chatbot", "chat bot"],
      answer: "A chatbot is an app that takes a message from a user, understands the intent, and returns a helpful response. A stronger chatbot keeps conversation memory and uses a model or local rules to answer.",
    },
    {
      keywords: ["api"],
      answer: "An API is a way for one app to talk to another app or service. In Create_AI, `/api/messages` is the safe server route that can talk to OpenAI without exposing the API key in the browser.",
    },
    {
      keywords: ["backend"],
      answer: "A backend is the server side of an app. It handles private work such as API keys, real login, email sending, database storage, and secure OpenAI requests.",
    },
    {
      keywords: ["frontend"],
      answer: "A frontend is the part of an app users see and use in the browser, such as screens, buttons, forms, chat bubbles, and previews.",
    },
    {
      keywords: ["website", "web app"],
      answer: "A website or web app runs in the browser. It usually uses HTML for structure, CSS for design, JavaScript for behavior, and sometimes a backend for private or powerful features.",
    },
    {
      keywords: ["mobile app"],
      answer: "A mobile app is software built for phones or tablets. It can be native, like an iPhone or Android app, or web-based as a PWA that installs from the browser.",
    },
    {
      keywords: ["pwa", "install app", "installable"],
      answer: "A PWA is a web app that can be installed from the browser. It uses a manifest and service worker so Chrome can offer an install button after the site is hosted correctly.",
    },
    {
      keywords: ["password"],
      answer: "A safer password is long, unique, and hard to guess. It should not be stored in browser code. A production app should hash passwords on a secure backend.",
    },
    {
      keywords: ["cloud"],
      answer: "The cloud means servers on the internet that run apps, store data, or connect services. For Create_AI, OpenAI should run through a cloud or server backend, not directly from browser code.",
    },
    {
      keywords: ["google chrome", "chrome"],
      answer: "Google Chrome can run Create_AI as a normal website. If it is hosted over HTTPS with the manifest and service worker, Chrome can also show an install option.",
    },
  ];

  const matched = topics.find((topic) => topic.keywords.some((keyword) => new RegExp(`\\b${escapeRegExp(keyword.trim())}\\b`).test(lower)));
  return matched ? matched.answer : "";
}

function buildExplanationAnswer(prompt) {
  const lower = prompt.toLowerCase();
  const subject = getPromptSubject(prompt);
  const knownAnswer = buildKnownTopicAnswer(prompt);

  if (knownAnswer) {
    return knownAnswer;
  }

  if (includesAny(lower, ["chatgpt", "claude", "codex"])) {
    return "ChatGPT, Claude, and Codex are assistant-style apps. They read a user prompt, infer the goal, and return useful writing, code, explanations, or plans. Create_AI now lets the user choose that kind of app before generating the output.";
  }

  if (includesAny(lower, ["safe", "security", "privacy"])) {
    return "A safer app keeps secrets out of storage, limits input size, validates fields, blocks risky requests, isolates generated previews, and avoids sending user prompts to unknown places.";
  }

  if (includesAny(lower, ["what causes", "why does", "why do"])) {
    return `The cause of ${subject} usually comes from a chain of conditions. Look for what changed first, what effect it created, and what evidence connects the two.`;
  }

  if (includesAny(lower, ["who is", "where is", "when is", "latest", "today"])) {
    return `${formatTopic(subject)} may depend on current or changing information. My best answer is to check the newest trusted source, then I can help explain it, summarize it, or turn it into a plan.`;
  }

  return `${formatTopic(subject)} can be understood in three parts:\n1. Meaning: what the topic is about.\n2. Importance: why it matters or what problem it solves.\n3. Example: how someone would use it in real life.\n\nA good next step is to ask for either a simple explanation, examples, pros and cons, or a step-by-step plan.`;
}

function buildCompareAnswer(prompt) {
  const subject = getPromptSubject(prompt);

  return `Comparison for ${subject}:\n1. ChatGPT style is best for broad question answering and everyday tasks.\n2. Claude style is best for longer writing, reasoning, and careful review.\n3. Codex style is best for code, debugging, and app-building steps.\n\nFor Create_AI, the four builder fields should describe which style the user wants, then the generator follows that description.`;
}

function buildIdeaAnswer(prompt) {
  const subject = getPromptSubject(prompt);

  return `Ideas for ${subject}:\n1. Start with the smallest useful version.\n2. Add one feature that saves time for the user.\n3. Make the input simple and the output clear.\n4. Add a download, copy, or share action.\n5. Improve it with follow-up requests after the first version works.`;
}

function buildSummaryAnswer(prompt) {
  const subject = getPromptSubject(prompt);

  return `Summary of ${subject}:\n1. Main point: focus on the user goal.\n2. Important detail: define the input clearly.\n3. Useful result: return something the user can act on.\n4. Next step: ask for missing details only when they are truly needed.`;
}

function buildLearningAnswer(prompt) {
  const subject = getPromptSubject(prompt);

  return `To learn ${subject}, use this simple path:\n1. Start with the basic meaning and one example.\n2. Practice the smallest useful task.\n3. Check what confused you.\n4. Repeat with a slightly harder task.\n5. Teach it back in your own words.`;
}

function buildQuestionAnswer(prompt) {
  const lower = prompt.toLowerCase();
  const subject = getPromptSubject(prompt);
  const knownAnswer = buildKnownTopicAnswer(prompt);

  if (includesAny(lower, ["how do i", "how can i", "how to"])) {
    return `Here is how to handle ${subject}:\n1. Decide the exact outcome you want.\n2. Break it into the smallest first step.\n3. Gather the needed input or information.\n4. Create the first version.\n5. Test it, then improve the weak part.`;
  }

  if (includesAny(lower, ["why"])) {
    return `Why ${subject}: the useful answer is cause and effect. First identify what changed, then what result happened, then what evidence connects them. If you want, I can turn that into a shorter answer, a school-style answer, or a detailed explanation.`;
  }

  if (includesAny(lower, ["should i", "which", "best"])) {
    return `For ${subject}, choose the option that is simplest, safest, and easiest to test first. If two choices look equal, pick the one that gives a working result faster, then improve it with feedback.`;
  }

  if (knownAnswer) {
    return knownAnswer;
  }

  if (includesAny(lower, ["what is", "what are", "what does"])) {
    return `${formatTopic(subject)} is the topic you asked about. The simplest way to understand it is:\n1. What it means.\n2. Why people use it or care about it.\n3. One real example.\n\nTell me if you want it explained like a beginner, in one sentence, or with examples.`;
  }

  return buildExplanationAnswer(prompt);
}

function buildGeneralOfflineAnswer(prompt) {
  const lower = prompt.toLowerCase();
  const subject = getPromptSubject(prompt);

  if (includesAny(lower, ["list", "points", "bullets"])) {
    return `Here are useful points about ${subject}:\n1. Start with the main idea.\n2. Add the most important detail.\n3. Give one example.\n4. End with the next action.`;
  }

  if (includesAny(lower, ["help", "stuck", "confused"])) {
    return `I can help with ${subject}. The easiest way forward is:\n1. Say what result you want.\n2. Share what you already tried.\n3. Pick the part that is confusing.\n4. I will turn it into a clear next step.`;
  }

  return `I understand your question about ${subject}. Here is a useful answer:\n\n${formatTopic(subject)} should be handled by first finding the main goal, then breaking it into simple parts, then choosing the next practical step. If the topic is an app, define the input and output. If it is writing, decide the tone and audience. If it is learning, use a simple explanation plus one example.`;
}

function buildLocalAssistantReply(prompt) {
  const text = cleanText(prompt, 1500);
  const lower = text.toLowerCase();
  const mathAnswer = buildMathAnswer(text);

  if (!text) {
    return "Ask a question or describe what you want to build.";
  }

  if (isUnsafePrompt(lower)) {
    return "I cannot help with harmful or deceptive requests. I can help build safer login flows, privacy checks, defensive security notes, or safe app templates.";
  }

  if (/^(hi|hello|hey)\b/.test(lower)) {
    return `Hi ${getFirstName()}. What should we create or improve?`;
  }

  if (mathAnswer) {
    return mathAnswer;
  }

  if (includesAny(lower, ["summarize", "summary", "shorten", "brief"])) {
    return buildSummaryAnswer(text);
  }

  if (includesAny(lower, ["idea", "ideas", "brainstorm", "suggest", "recommend"])) {
    return buildIdeaAnswer(text);
  }

  if (includesAny(lower, ["learn", "study", "understand", "teach me"])) {
    return buildLearningAnswer(text);
  }

  if (includesAny(lower, ["codex", "chatgpt", "claude", "build app", "create app", "app builder", "ai app"])) {
    return buildAppPlanningAnswer(text);
  }

  if (includesAny(lower, ["code", "javascript", "html", "css", "bug", "error", "function", "button", "click"])) {
    return buildCodeAnswer(text);
  }

  if (includesAny(lower, ["write", "draft", "compose", "email", "caption", "description", "post"])) {
    return buildWritingAnswer(text);
  }

  if (includesAny(lower, ["compare", "difference", " vs ", " versus "])) {
    return buildCompareAnswer(text);
  }

  if (includesAny(lower, ["plan", "schedule", "roadmap", "steps"])) {
    return `Plan for ${getPromptSubject(text)}:\n1. Set the exact goal.\n2. Write the purpose/problem clearly.\n3. Define what the user gives as input.\n4. Define the output the user should receive.\n5. Generate the first version.\n6. Apply follow-up updates until it matches the need.`;
  }

  if (text.includes("?") || includesAny(lower, ["what", "why", "how", "explain", "who", "where", "when", "which", "should"])) {
    return buildQuestionAnswer(text);
  }

  return buildGeneralOfflineAnswer(text);
}

function getSelectedOpenAIModel() {
  return chatElements.model?.value || "gpt-5.4-nano";
}

function getSelectedOpenAIModelLabel() {
  return chatElements.model?.selectedOptions?.[0]?.textContent || "GPT-5.4 nano";
}

async function callOpenAIBackend() {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: getSelectedOpenAIModel(),
      max_tokens: 1000,
      system: "You are the Create_AI Assistant, a friendly, concise AI helper. Follow safety rules: refuse harmful, illegal, deceptive, credential-stealing, malware, self-harm, hateful, or sexual-minor content. Be helpful, warm, and clear.",
      messages: chatMessages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({ role: message.role, content: message.text })),
    }),
  });

  if (!response.ok) {
    throw new Error("OpenAI backend is not connected.");
  }

  const data = await response.json();
  const content = Array.isArray(data.content) ? data.content : [];
  const text = content.filter((item) => item.type === "text").map((item) => item.text).join("\n").trim();

  return text || "";
}

async function getAssistantReply(prompt) {
  const lower = prompt.toLowerCase();

  if (isUnsafePrompt(lower)) {
    return buildLocalAssistantReply(prompt);
  }

  try {
    const backendReply = await callOpenAIBackend();

    if (backendReply) {
      return backendReply;
    }
  } catch {
    // Static previews fall back locally when no OpenAI backend is deployed.
  }

  return buildLocalAssistantReply(prompt);
}

function setChatBusy(isBusy) {
  chatElements.input.disabled = isBusy;
  if (chatElements.model) {
    chatElements.model.disabled = isBusy;
  }
  chatElements.form.querySelector("button").disabled = isBusy;
}

function sendChatMessage(message) {
  const text = cleanText(message, 1500);

  if (!text || typingTimer) {
    return;
  }

  addChatMessage("user", text);
  chatElements.input.value = "";
  setChatBusy(true);
  const typingBubble = showTypingMessage();

  typingTimer = window.setTimeout(async () => {
    typingTimer = null;
    const reply = await getAssistantReply(text);
    removeTypingMessage(typingBubble);
    addChatMessage("assistant", reply);
    setChatBusy(false);
    chatElements.input.focus();
  }, 420);
}

function renderChoiceButtons(container, options, activeSetOrId, handler) {
  container.replaceChildren();

  options.forEach((option) => {
    const button = document.createElement("button");
    const isActive = activeSetOrId instanceof Set ? activeSetOrId.has(option.id) : activeSetOrId === option.id;

    button.type = "button";
    button.className = `${container.id === "feature-options" ? "feature-button" : "choice-button"}${isActive ? " active" : ""}`;
    button.dataset.id = option.id;
    button.innerHTML = `<strong>${escapeHtml(option.title)}</strong><span>${escapeHtml(option.sub)}</span>`;
    button.addEventListener("click", () => handler(option.id));
    container.append(button);
  });
}

function renderBuilderOptions() {
  const appTypeContainer = document.querySelector("#app-type-options");
  const purposeContainer = document.querySelector("#purpose-options");
  const featureContainer = document.querySelector("#feature-options");

  if (!appTypeContainer || !purposeContainer || !featureContainer) {
    return;
  }

  renderChoiceButtons(appTypeContainer, appTypes, selectedAppType, (id) => {
    selectedAppType = id;
    applyTypeDefaults(id);
    renderBuilderOptions();
  });

  renderChoiceButtons(purposeContainer, purposeOptions, selectedPurposes, (id) => {
    if (selectedPurposes.has(id)) {
      selectedPurposes.delete(id);
    } else {
      selectedPurposes.add(id);
    }
    renderBuilderOptions();
  });

  renderChoiceButtons(featureContainer, featureOptions, selectedFeatures, (id) => {
    if (selectedFeatures.has(id)) {
      selectedFeatures.delete(id);
    } else {
      selectedFeatures.add(id);
    }
    renderBuilderOptions();
  });
}

function applyTypeDefaults(type) {
  const defaults = {
    "general-assistant": {
      purposes: ["answer", "analyze", "plan", "publish", "update"],
      features: ["chat", "forms", "download", "history", "safety"],
      style: "chat-focused",
    },
    "coding-assistant": {
      purposes: ["answer", "code", "analyze", "publish", "update"],
      features: ["chat", "code-panel", "forms", "download", "safety"],
      style: "developer",
    },
    "writing-assistant": {
      purposes: ["answer", "write", "analyze", "publish", "update"],
      features: ["chat", "forms", "history", "download", "safety"],
      style: "professional",
    },
    "study-tutor": {
      purposes: ["answer", "teach", "plan", "update"],
      features: ["chat", "forms", "history", "reset", "safety"],
      style: "simple",
    },
    "support-chatbot": {
      purposes: ["answer", "support", "analyze", "update"],
      features: ["chat", "forms", "history", "safety"],
      style: "chat-focused",
    },
    "business-dashboard": {
      purposes: ["analyze", "plan", "publish", "update"],
      features: ["dashboard", "forms", "download", "history", "safety"],
      style: "dashboard",
    },
    "workflow-tool": {
      purposes: ["plan", "analyze", "publish", "update"],
      features: ["forms", "dashboard", "history", "download", "safety"],
      style: "professional",
    },
    custom: {
      purposes: ["answer", "analyze", "publish", "update"],
      features: ["forms", "download", "safety"],
      style: "professional",
    },
  };
  const selected = defaults[type];

  selectedPurposes = new Set(selected.purposes);
  selectedFeatures = new Set(selected.features);
  if (createElements.fields.style) {
    createElements.fields.style.value = selected.style;
  }
}

function inferProjectType(text) {
  if (includesAny(text, ["code", "coding", "debug", "bug", "developer", "javascript", "html", "css"])) {
    return "coding-assistant";
  }

  if (includesAny(text, ["write", "essay", "story", "email", "draft", "document", "reasoning"])) {
    return "writing-assistant";
  }

  if (includesAny(text, ["support", "customer", "ticket", "faq", "helpdesk"])) {
    return "support-chatbot";
  }

  if (includesAny(text, ["dashboard", "metric", "chart", "analytics", "report"])) {
    return "business-dashboard";
  }

  if (includesAny(text, ["study", "learn", "quiz", "lesson", "teach", "student"])) {
    return "study-tutor";
  }

  return "general-assistant";
}

function inferPurposes(text, type) {
  const purposes = new Set(["answer", "analyze", "publish", "update"]);

  if (type === "coding-assistant" || includesAny(text, ["code", "debug", "bug", "snippet"])) purposes.add("code");
  if (type === "writing-assistant" || includesAny(text, ["write", "draft", "email", "content"])) purposes.add("write");
  if (type === "study-tutor" || includesAny(text, ["teach", "learn", "quiz"])) purposes.add("teach");
  if (type === "support-chatbot" || includesAny(text, ["support", "customer", "ticket"])) purposes.add("support");
  if (includesAny(text, ["plan", "schedule", "steps", "workflow"])) purposes.add("plan");

  return [...purposes];
}

function inferFeatures(text, type) {
  const features = new Set(["chat", "forms", "download", "safety"]);

  if (type === "coding-assistant" || includesAny(text, ["code", "debug", "developer"])) features.add("code-panel");
  if (type === "business-dashboard" || includesAny(text, ["dashboard", "metric", "chart"])) features.add("dashboard");
  if (includesAny(text, ["history", "save", "memory"])) features.add("history");
  if (includesAny(text, ["reset", "clear"])) features.add("reset");

  return [...features];
}

function readCreateForm() {
  const name = cleanText(createElements.fields.name.value, 120);
  const problem = cleanText(createElements.fields.problem.value, 1500);
  const inputs = cleanText(createElements.fields.inputs.value, 1500);
  const outputs = cleanText(createElements.fields.outputs.value, 1500);
  const promptText = `${name} ${problem} ${inputs} ${outputs}`.toLowerCase();
  const type = inferProjectType(promptText);

  return {
    name,
    type,
    purposes: inferPurposes(promptText, type),
    problem,
    inputs,
    outputs,
    style: type === "coding-assistant" ? "developer" : type === "business-dashboard" ? "dashboard" : type === "general-assistant" ? "chat-focused" : "professional",
    depth: "detailed",
    features: inferFeatures(promptText, type),
  };
}

function validateCreateProject(project) {
  clearCreateErrors();
  let valid = true;

  if (!project.name) {
    setCreateError("name", "Enter the project name.");
    valid = false;
  }

  if (!project.problem) {
    setCreateError("problem", "Describe the problem.");
    valid = false;
  }

  if (!project.inputs) {
    setCreateError("inputs", "Describe the user input.");
    valid = false;
  }

  if (!project.outputs) {
    setCreateError("outputs", "Describe the output.");
    valid = false;
  }

  if (project.purposes.length === 0) {
    valid = false;
  }

  return valid;
}

function getTypeLabel(type) {
  return appTypes.find((item) => item.id === type)?.title || "Custom app";
}

function getPurposeLabels(ids) {
  return ids.map((id) => purposeOptions.find((item) => item.id === id)?.title || id);
}

function getFeatureLabels(ids) {
  return ids.map((id) => featureOptions.find((item) => item.id === id)?.title || id);
}

function buildGeneratedAppHtml(project) {
  const typeLabel = getTypeLabel(project.type);
  const purposeLabels = getPurposeLabels(project.purposes);
  const featureLabels = getFeatureLabels(project.features);
  const updates = project.updates || [];
  const hasChat = project.features.includes("chat") || project.type.includes("assistant") || project.type.includes("chatbot");
  const hasCodePanel = project.features.includes("code-panel") || project.type === "coding-assistant";
  const hasDashboard = project.features.includes("dashboard") || project.type === "business-dashboard";
  const darkByUpdate = updates.some((update) => /dark|black|night/i.test(update));
  const accent = project.type === "coding-assistant" ? "#5865f2" : project.type === "writing-assistant" ? "#0d9488" : project.type === "business-dashboard" ? "#f05d5e" : "#17201f";
  const updateList = updates.map((update) => `<li>${escapeHtml(update)}</li>`).join("");
  const purposeList = purposeLabels.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const featureList = featureLabels.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'" />
    <meta name="referrer" content="no-referrer" />
    <title>${escapeHtml(project.name)}</title>
    <style>
      * { box-sizing: border-box; }
      :root {
        --bg: ${darkByUpdate ? "#101616" : "#f7fbf8"};
        --panel: ${darkByUpdate ? "#182221" : "#ffffff"};
        --ink: ${darkByUpdate ? "#edf8f4" : "#17201f"};
        --muted: ${darkByUpdate ? "#9eb5ae" : "#60716c"};
        --line: ${darkByUpdate ? "#2a3a37" : "#d8e4df"};
        --accent: ${accent};
      }
      body { min-height: 100vh; margin: 0; color: var(--ink); background: var(--bg); font-family: Inter, system-ui, sans-serif; }
      main { width: min(1120px, calc(100vw - 28px)); margin: 0 auto; padding: 28px 0; }
      header { padding: 24px; border-radius: 8px; color: #fff; background: linear-gradient(135deg, var(--accent), #17201f 72%); }
      h1, h2, h3, p { margin-top: 0; letter-spacing: 0; }
      h1 { margin-bottom: 10px; font-size: clamp(2.2rem, 7vw, 4.6rem); line-height: .95; }
      section { margin-top: 14px; padding: 18px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .workspace { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, .8fr); gap: 14px; align-items: start; }
      label { display: block; margin-bottom: 8px; color: var(--muted); font-size: .86rem; font-weight: 800; }
      textarea, input { width: 100%; min-height: 48px; padding: 12px; border: 1px solid var(--line); border-radius: 8px; color: var(--ink); background: transparent; font: inherit; }
      textarea { min-height: 132px; resize: vertical; }
      button { min-height: 46px; padding: 0 16px; border: 0; border-radius: 8px; color: #fff; background: var(--accent); font: inherit; font-weight: 900; cursor: pointer; }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
      .secondary { color: var(--ink); border: 1px solid var(--line); background: transparent; }
      .result, .chat { min-height: 160px; margin-top: 12px; padding: 14px; border: 1px solid var(--line); border-radius: 8px; white-space: pre-wrap; line-height: 1.55; }
      .chat { display: grid; gap: 10px; align-content: start; max-height: 360px; overflow: auto; }
      .bubble { padding: 10px 12px; border-radius: 8px; background: ${darkByUpdate ? "#22302d" : "#f0f6f3"}; }
      .bubble.user { color: #fff; background: var(--accent); }
      ul { margin: 0; padding-left: 18px; }
      code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      pre { overflow: auto; padding: 12px; border-radius: 8px; color: #eaf8f4; background: #101616; }
      @media (max-width: 820px) { .grid, .workspace { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <p>${escapeHtml(typeLabel)}</p>
        <h1>${escapeHtml(project.name)}</h1>
        <p>${escapeHtml(project.problem)}</p>
      </header>

      <section class="grid">
        <article><h2>Purposes</h2><ul>${purposeList}</ul></article>
        <article><h2>Inputs</h2><p>${escapeHtml(project.inputs)}</p></article>
        <article><h2>Outputs</h2><p>${escapeHtml(project.outputs)}</p></article>
      </section>

      <div class="workspace">
        <section>
          <h2>${hasChat ? "Assistant" : "Generator"}</h2>
          <label for="main-input">User input</label>
          <textarea id="main-input" maxlength="1500" placeholder="Enter a prompt, task, code issue, or project detail"></textarea>
          <div class="actions">
            <button id="generate" type="button">Generate</button>
            <button class="secondary" id="reset" type="button">Reset</button>
          </div>
          ${hasChat ? `<div class="chat" id="chat-log"><div class="bubble">Ready for ${escapeHtml(typeLabel)} prompts.</div></div>` : `<div class="result" id="result">Your output will appear here.</div>`}
          ${hasCodePanel ? `<pre id="code-output">// Generated code and implementation notes will appear here.</pre>` : ""}
        </section>

        <section>
          <h2>Blueprint</h2>
          <p><strong>Style:</strong> ${escapeHtml(project.style)}</p>
          <p><strong>Depth:</strong> ${escapeHtml(project.depth)}</p>
          <p><strong>Features:</strong></p>
          <ul>${featureList}</ul>
          ${hasDashboard ? `<div class="result" id="dashboard">Score: 0\\nTasks: 0\\nReady items: 0</div>` : ""}
          ${updates.length ? `<h3>Updates</h3><ul>${updateList}</ul>` : ""}
        </section>
      </div>
    </main>

    <script>
      const config = {
        type: ${safeJson(project.type)},
        typeLabel: ${safeJson(typeLabel)},
        purposes: ${JSON.stringify(project.purposes)},
        problem: ${safeJson(project.problem)},
        inputs: ${safeJson(project.inputs)},
        outputs: ${safeJson(project.outputs)},
        depth: ${safeJson(project.depth)}
      };
      const hasChat = ${JSON.stringify(hasChat)};
      const hasCodePanel = ${JSON.stringify(hasCodePanel)};
      const hasDashboard = ${JSON.stringify(hasDashboard)};

      function clean(value) {
        return String(value || "").replace(/[<>]/g, "").trim().slice(0, 1500);
      }

      function reply(prompt) {
        const text = clean(prompt);
        const lower = text.toLowerCase();

        if (!text) return "Enter an input first.";
        if (/(malware|phishing|steal password|credential)/.test(lower)) return "I cannot help with unsafe requests. I can help with safe alternatives.";
        if (config.type === "coding-assistant" || config.purposes.includes("code")) {
          return "Code assistant result:\\n1. Goal: " + config.problem + "\\n2. Input reviewed: " + text + "\\n3. Suggested fix: isolate the smallest failing part, validate the input, then return a clear patch or snippet.\\n4. Output style: " + config.outputs;
        }
        if (config.type === "writing-assistant" || config.purposes.includes("write")) {
          return "Writing assistant result:\\n" + text + "\\n\\nImproved version: make the message clear, specific, and useful. Start with the purpose, add the strongest detail, and finish with the next step.";
        }
        if (config.purposes.includes("plan")) {
          return "Plan:\\n1. Define the target.\\n2. Collect the needed input.\\n3. Produce " + config.outputs + ".\\n4. Review and improve.";
        }
        return config.typeLabel + " result:\\nInput: " + text + "\\n\\nAnswer: use the prompt to solve " + config.problem + " and return " + config.outputs + ".";
      }

      function renderOutput(text) {
        if (hasChat) {
          const chat = document.querySelector("#chat-log");
          const user = document.createElement("div");
          const assistant = document.createElement("div");
          user.className = "bubble user";
          assistant.className = "bubble";
          user.textContent = text;
          assistant.textContent = reply(text);
          chat.append(user, assistant);
          chat.scrollTop = chat.scrollHeight;
        } else {
          document.querySelector("#result").textContent = reply(text);
        }

        if (hasCodePanel) {
          document.querySelector("#code-output").textContent =
            "// " + config.typeLabel + "\\n" +
            "function handlePrompt(prompt) {\\n" +
            "  return " + JSON.stringify(reply(text)).replace(/\\\\n/g, "\\\\n") + ";\\n" +
            "}";
        }

        if (hasDashboard) {
          const score = Math.min(100, text.length);
          document.querySelector("#dashboard").textContent =
            "Score: " + score + "\\n" +
            "Tasks: " + Math.max(1, text.split(/[,.;]/).filter(Boolean).length) + "\\n" +
            "Ready items: " + config.purposes.length;
        }
      }

      document.querySelector("#generate").addEventListener("click", () => {
        renderOutput(document.querySelector("#main-input").value);
      });

      document.querySelector("#reset").addEventListener("click", () => {
        document.querySelector("#main-input").value = "";
        if (hasChat) {
          document.querySelector("#chat-log").innerHTML = '<div class="bubble">Ready for ' + config.typeLabel + ' prompts.</div>';
        } else {
          document.querySelector("#result").textContent = "Your output will appear here.";
        }
        if (hasCodePanel) document.querySelector("#code-output").textContent = "// Generated code and implementation notes will appear here.";
        if (hasDashboard) document.querySelector("#dashboard").textContent = "Score: 0\\nTasks: 0\\nReady items: 0";
      });
    <\/script>
  </body>
</html>`;
}

function renderCreatedProject() {
  if (!createdProject) {
    return;
  }

  const html = buildGeneratedAppHtml(createdProject);
  const blob = new Blob([html], { type: "text/html" });

  if (generatedAppUrl) {
    URL.revokeObjectURL(generatedAppUrl);
  }

  generatedAppUrl = URL.createObjectURL(blob);
  createElements.area.classList.remove("hidden");
  createElements.status.textContent = "Published locally";
  createElements.status.classList.add("live");
  createElements.title.textContent = createdProject.name;
  createElements.preview.srcdoc = html;
  createElements.code.textContent = html;
  createElements.open.href = generatedAppUrl;
  createElements.download.href = generatedAppUrl;
  createElements.download.download = `${slugify(createdProject.name)}.html`;
  document.querySelector("#home-create-summary").textContent = `${createdProject.name} ready`;
}

function getSavedProjects() {
  const saved = localStorage.getItem(getProjectKey());

  if (!saved) {
    return [];
  }

  try {
    const projects = JSON.parse(saved);
    return Array.isArray(projects) ? projects : [];
  } catch {
    return [];
  }
}

function saveProject(project) {
  const projects = getSavedProjects().filter((item) => item.id !== project.id);
  const nextProjects = [project, ...projects].slice(0, 12);

  localStorage.setItem(getProjectKey(), JSON.stringify(nextProjects));
  localStorage.setItem(getCurrentProjectKey(), JSON.stringify(project));
  renderProjects();
}

function loadCurrentProject() {
  const saved = localStorage.getItem(getCurrentProjectKey());

  if (!saved) {
    createdProject = null;
    createElements.area.classList.add("hidden");
    createElements.status.textContent = "Not created";
    createElements.status.classList.remove("live");
    document.querySelector("#home-create-summary").textContent = "No project yet";
    return;
  }

  try {
    createdProject = JSON.parse(saved);
    renderCreatedProject();
  } catch {
    createdProject = null;
  }
}

function renderProjects() {
  const list = document.querySelector("#project-list");
  const projects = getSavedProjects();

  list.replaceChildren();

  if (projects.length === 0) {
    const empty = document.createElement("article");
    empty.innerHTML = "<strong>No saved projects</strong><span>Create an app to save it here.</span>";
    list.append(empty);
    return;
  }

  projects.forEach((project) => {
    const card = document.createElement("article");
    const type = getTypeLabel(project.type);
    const button = document.createElement("button");

    card.innerHTML = `<strong>${escapeHtml(project.name)}</strong><span>${escapeHtml(type)}</span><span>${escapeHtml(project.problem)}</span>`;
    button.className = "secondary-button compact";
    button.type = "button";
    button.textContent = "Open";
    button.addEventListener("click", () => {
      createdProject = project;
      localStorage.setItem(getCurrentProjectKey(), JSON.stringify(project));
      renderCreatedProject();
      showSection("create");
    });
    card.append(button);
    list.append(card);
  });
}

function buildCreateAiDownloadHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'" />
    <title>Create_AI Local</title>
    <style>
      body { margin: 0; min-height: 100vh; font-family: system-ui, sans-serif; color: #17201f; background: #f6fbf8; }
      main { width: min(840px, calc(100vw - 28px)); margin: 0 auto; padding: 30px 0; }
      header, section { padding: 20px; border-radius: 8px; border: 1px solid #d8e4df; background: #fff; }
      header { color: #fff; background: linear-gradient(135deg, #0d9488, #17201f); }
      input, textarea, button { width: 100%; margin-top: 8px; min-height: 44px; padding: 10px; border-radius: 8px; font: inherit; }
      textarea { min-height: 110px; }
      button { border: 0; color: white; background: #17201f; font-weight: 800; }
      .result { margin-top: 12px; white-space: pre-wrap; padding: 12px; border-radius: 8px; background: #eef7f3; }
    </style>
  </head>
  <body>
    <main>
      <header><h1>Create_AI</h1><p>Local app builder copy</p></header>
      <section>
        <label>Project name<input id="name" maxlength="120"></label>
        <label>Purpose<textarea id="purpose" maxlength="1200"></textarea></label>
        <button id="build" type="button">Create Plan</button>
        <div class="result" id="result">Your plan will appear here.</div>
      </section>
    </main>
    <script>
      document.querySelector("#build").addEventListener("click", () => {
        const name = document.querySelector("#name").value.trim() || "New app";
        const purpose = document.querySelector("#purpose").value.trim() || "Solve a user problem";
        document.querySelector("#result").textContent = name + "\\n\\nPurpose: " + purpose + "\\nInputs: user prompt and project details\\nOutputs: useful answer, plan, or downloadable app.";
      });
    <\/script>
  </body>
</html>`;
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getCurrentGeneratedHtml() {
  return createdProject ? buildGeneratedAppHtml(createdProject) : "";
}

async function copyText(text, successElement, successText) {
  if (!text) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);

    if (successElement) {
      const oldText = successElement.textContent;
      successElement.textContent = successText;
      window.setTimeout(() => {
        successElement.textContent = oldText;
      }, 1400);
    }

    return true;
  } catch {
    return false;
  }
}

function openModal(modal) {
  modal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

async function handleInstallClick() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();

    try {
      await deferredInstallPrompt.userChoice;
    } catch {
      // Some browsers do not expose a result in local previews.
    }

    deferredInstallPrompt = null;
    return;
  }

  openModal(installElements.modal);
}

document.querySelector("#account-form").addEventListener("submit", (event) => {
  event.preventDefault();
  clearErrors();

  const lockedSeconds = isLoginLocked();

  if (lockedSeconds) {
    setError("email", `Too many attempts. Try again in ${lockedSeconds} seconds.`);
    return;
  }

  const email = cleanText(fields.email.value, 254).toLowerCase();
  const password = fields.password.value;
  let hasError = false;

  if (!isValidEmail(email)) {
    setError("email", "Enter a valid email id.");
    hasError = true;
  }

  if (!isStrongPassword(password)) {
    setError("password", "Use 8+ characters with mixed letters, a number, and stronger variety.");
    hasError = true;
  }

  if (hasError) {
    recordFailedLoginAttempt();
    return;
  }

  localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
  state.email = email;
  fields.email.value = email;
  fields.password.value = "";
  showScreen("profile");
  fields.name.focus();
});

document.querySelector("#profile-form").addEventListener("submit", (event) => {
  event.preventDefault();
  clearErrors();

  const name = cleanText(fields.name.value, 80);
  const mobile = cleanText(fields.mobile.value, 20);
  let hasError = false;

  if (name.length < 2) {
    setError("name", "Enter your name.");
    hasError = true;
  }

  if (!isValidMobile(mobile)) {
    setError("mobile", "Enter a valid mobile number.");
    hasError = true;
  }

  if (hasError) {
    return;
  }

  state.name = name;
  state.mobile = mobile;
  fields.name.value = name;
  fields.mobile.value = mobile;
  sendVerificationLink();
  showScreen("sent");
});

document.querySelector("#back-to-account").addEventListener("click", () => {
  showScreen("account");
});

document.querySelector("#edit-profile").addEventListener("click", () => {
  showScreen("profile");
});

document.querySelector("#enter-app").addEventListener("click", finishLogin);
document.querySelector("#logout").addEventListener("click", () => secureLogout());
document.querySelector("#clear-local-data").addEventListener("click", clearAllLocalData);
document.querySelector("#download-create-ai").addEventListener("click", () => {
  downloadTextFile("Create_AI.html", buildCreateAiDownloadHtml());
});

installElements.button.addEventListener("click", handleInstallClick);
installElements.close.addEventListener("click", () => closeModal(installElements.modal));
installElements.modal.addEventListener("click", (event) => {
  if (event.target === installElements.modal) {
    closeModal(installElements.modal);
  }
});

document.querySelector("#toggle-password").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const show = fields.password.type === "password";
  fields.password.type = show ? "text" : "password";
  button.textContent = show ? "Hide" : "Show";
  button.setAttribute("aria-label", show ? "Hide password" : "Show password");
});

fields.password.addEventListener("input", updatePasswordStrength);

document.querySelectorAll(".nav-tabs button").forEach((button) => {
  button.addEventListener("click", () => showSection(button.dataset.section));
});

chatElements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendChatMessage(chatElements.input.value);
});

chatElements.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatElements.form.requestSubmit();
  }
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => sendChatMessage(button.dataset.prompt));
});

chatElements.clear.addEventListener("click", () => {
  if (typingTimer) {
    window.clearTimeout(typingTimer);
    typingTimer = null;
    setChatBusy(false);
  }

  chatMessages = [createWelcomeMessage()];
  renderChat();
  saveChat();
});

createElements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const project = readCreateForm();

  if (!validateCreateProject(project)) {
    return;
  }

  createdProject = {
    ...project,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    updates: [],
    createdAt: new Date().toISOString(),
  };

  saveProject(createdProject);
  renderCreatedProject();
});

createElements.updateForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!createdProject) {
    return;
  }

  const update = cleanText(createElements.updateRequest.value, 1200);

  if (!update) {
    createElements.updateRequest.focus();
    return;
  }

  createdProject.updates = [...(createdProject.updates || []), update];

  if (/chat|assistant/i.test(update)) {
    createdProject.features = [...new Set([...createdProject.features, "chat"])];
  }

  if (/code|developer/i.test(update)) {
    createdProject.features = [...new Set([...createdProject.features, "code-panel"])];
  }

  if (/dashboard|metric|chart/i.test(update)) {
    createdProject.features = [...new Set([...createdProject.features, "dashboard"])];
  }

  createElements.updateRequest.value = "";
  saveProject(createdProject);
  renderCreatedProject();
});

createElements.showPreview.addEventListener("click", () => {
  createElements.preview.classList.remove("hidden");
  createElements.code.classList.add("hidden");
  createElements.showPreview.classList.add("active");
  createElements.showCode.classList.remove("active");
});

createElements.showCode.addEventListener("click", () => {
  createElements.preview.classList.add("hidden");
  createElements.code.classList.remove("hidden");
  createElements.showPreview.classList.remove("active");
  createElements.showCode.classList.add("active");
});

createElements.copy.addEventListener("click", () => {
  copyText(getCurrentGeneratedHtml(), createElements.copy, "Copied");
});

createElements.publish.addEventListener("click", () => {
  if (!createdProject) {
    return;
  }

  publishElements.download.href = generatedAppUrl;
  publishElements.download.download = `${slugify(createdProject.name)}.html`;
  openModal(publishElements.modal);
});

publishElements.close.addEventListener("click", () => closeModal(publishElements.modal));
publishElements.modal.addEventListener("click", (event) => {
  if (event.target === publishElements.modal) {
    closeModal(publishElements.modal);
  }
});
publishElements.copy.addEventListener("click", () => {
  copyText(getCurrentGeneratedHtml(), publishElements.copy, "Copied");
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Local file previews and some private browser modes do not allow service workers.
    });
  });
}

document.addEventListener("click", refreshSessionExpiry);
document.addEventListener("keydown", refreshSessionExpiry);
window.addEventListener("hashchange", handleVerificationRoute);

window.setInterval(() => {
  if (appShell.classList.contains("hidden")) {
    return;
  }

  if (!getStoredUser()) {
    secureLogout({ clearStoredSession: false });
    return;
  }

  updateSessionStatus();
}, 15000);

renderBuilderOptions();
updatePasswordStrength();

const savedUser = getStoredUser();

if (handleVerificationRoute()) {
  // Verification hash chooses the visible screen.
} else if (savedUser) {
  Object.assign(state, savedUser);
  enterApp();
} else {
  showScreen("account");
}
