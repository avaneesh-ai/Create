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
  app: document.querySelector("#app-screen"),
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

const chatElements = {
  messages: document.querySelector("#chat-messages"),
  form: document.querySelector("#chat-form"),
  input: document.querySelector("#chat-input"),
  clear: document.querySelector("#clear-chat"),
};

const createElements = {
  form: document.querySelector("#create-form"),
  status: document.querySelector("#publish-status"),
  panel: document.querySelector("#generated-app"),
  title: document.querySelector("#generated-title"),
  preview: document.querySelector("#app-preview"),
  open: document.querySelector("#open-generated-app"),
  download: document.querySelector("#download-generated-app"),
  updateCount: document.querySelector("#update-count"),
  updateForm: document.querySelector("#update-form"),
  updateRequest: document.querySelector("#update-request"),
  fields: {
    name: document.querySelector("#project-name"),
    purpose: document.querySelector("#project-purpose"),
    problems: document.querySelector("#project-problems"),
    inputs: document.querySelector("#project-inputs"),
    outputs: document.querySelector("#project-outputs"),
  },
  errors: {
    name: document.querySelector("#project-name-error"),
    purpose: document.querySelector("#project-purpose-error"),
    problems: document.querySelector("#project-problems-error"),
    inputs: document.querySelector("#project-inputs-error"),
    outputs: document.querySelector("#project-outputs-error"),
  },
};

const appDownloadLink = document.querySelector("#download-create-ai");
const safetyElements = {
  sessionExpiry: document.querySelector("#session-expiry"),
  clearLocalData: document.querySelector("#clear-local-data"),
};

const SESSION_TTL_MS = 30 * 60 * 1000;
const PENDING_TTL_MS = 10 * 60 * 1000;
const LOGIN_LOCK_MS = 30 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_ATTEMPTS_KEY = "secureAppLoginAttempts";

let chatMessages = [];
let typingTimer = null;
let createdProject = null;
let generatedAppUrl = "";
let appDownloadUrl = "";

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");

  dots.account.classList.toggle("active", name === "account");
  dots.account.classList.toggle("done", name !== "account");
  dots.profile.classList.toggle("active", name === "profile");
  dots.profile.classList.toggle("done", ["sent", "confirm", "app"].includes(name));
  dots.verify.classList.toggle("active", ["sent", "confirm"].includes(name));
  dots.verify.classList.toggle("done", name === "app");
}

function setError(key, message) {
  errors[key].textContent = message;
}

function clearErrors() {
  Object.values(errors).forEach((error) => {
    error.textContent = "";
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidMobile(value) {
  return /^[0-9+\-\s()]{7,16}$/.test(value);
}

function cleanText(value, maxLength = 1000) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isStrongPassword(value) {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

function createToken() {
  const bytes = new Uint8Array(24);

  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getBaseUrl() {
  return window.location.href.split("#")[0];
}

function getStoredUser() {
  const saved = sessionStorage.getItem("secureAppUser");
  localStorage.removeItem("secureAppUser");

  if (!saved) {
    return null;
  }

  try {
    const user = JSON.parse(saved);

    if (!user.expiresAt || Date.now() > user.expiresAt) {
      sessionStorage.removeItem("secureAppUser");
      return null;
    }

    return user;
  } catch {
    sessionStorage.removeItem("secureAppUser");
    return null;
  }
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

function getChatKey() {
  return `secureAppChat:${state.email || "guest"}`;
}

function getCreateKey() {
  return `secureAppCreate:${state.email || "guest"}`;
}

function getFirstName() {
  return state.name.trim().split(/\s+/)[0] || "there";
}

function savePendingUser() {
  localStorage.setItem("pendingSecureAppUser", JSON.stringify(getPendingUser()));
}

function loadPendingUser() {
  const saved = localStorage.getItem("pendingSecureAppUser");

  if (!saved) {
    return false;
  }

  try {
    const pendingUser = JSON.parse(saved);

    if (!pendingUser.expiresAt || Date.now() > pendingUser.expiresAt) {
      localStorage.removeItem("pendingSecureAppUser");
      return false;
    }

    Object.assign(state, pendingUser);
    return Boolean(state.email && state.token);
  } catch {
    localStorage.removeItem("pendingSecureAppUser");
    return false;
  }
}

function sendVerificationLink() {
  state.token = createToken();
  savePendingUser();

  const link = `${getBaseUrl()}#verify=${encodeURIComponent(state.token)}`;
  const verificationLink = document.querySelector("#verification-link");

  document.querySelector("#mail-to").textContent = `To: ${state.email}`;
  verificationLink.href = link;
}

function fillAppScreen() {
  document.querySelector("#confirm-email").textContent = state.email;
  document.querySelector("#welcome-name").textContent = `Welcome, ${state.name}`;
  document.querySelector("#account-email").textContent = state.email;
  document.querySelector("#account-mobile").textContent = state.mobile;
  updateSessionStatus();
  updateAppDownload();
  loadCreatedProject();
  loadChat();
}

function finishLogin() {
  sessionStorage.setItem("secureAppUser", JSON.stringify(getSessionUser()));
  localStorage.removeItem("pendingSecureAppUser");
  window.location.hash = "";
  fillAppScreen();
  showScreen("app");
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

  fillAppScreen();
  showScreen("confirm");
  return true;
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
    setError("password", "Use at least 8 characters with a letter and a number.");
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
  fields.email.focus();
});

document.querySelector("#edit-profile").addEventListener("click", () => {
  showScreen("profile");
  fields.name.focus();
});

document.querySelector("#enter-app").addEventListener("click", finishLogin);

document.querySelector("#logout").addEventListener("click", () => {
  secureLogout();
});

document.querySelector("#toggle-password").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const isHidden = fields.password.type === "password";
  fields.password.type = isHidden ? "text" : "password";
  button.textContent = isHidden ? "Hide" : "Show";
  button.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
  button.title = isHidden ? "Hide password" : "Show password";
});

function cleanupSessionArtifacts() {
  if (typingTimer) {
    window.clearTimeout(typingTimer);
    typingTimer = null;
    setChatBusy(false);
  }

  if (appDownloadUrl) {
    URL.revokeObjectURL(appDownloadUrl);
    appDownloadUrl = "";
    appDownloadLink.href = "#";
  }

  if (generatedAppUrl) {
    URL.revokeObjectURL(generatedAppUrl);
    generatedAppUrl = "";
    createElements.open.href = "#";
    createElements.download.href = "#";
  }
}

function secureLogout({ clearStoredSession = true } = {}) {
  cleanupSessionArtifacts();

  if (clearStoredSession) {
    sessionStorage.removeItem("secureAppUser");
  }

  fields.password.value = "";
  window.location.hash = "";
  showScreen("account");
}

function updateSessionStatus() {
  const savedUser = getStoredUser();

  if (!savedUser) {
    safetyElements.sessionExpiry.textContent = "Auto-lock enabled";
    return;
  }

  const minutes = Math.max(1, Math.ceil((savedUser.expiresAt - Date.now()) / 60000));
  safetyElements.sessionExpiry.textContent = `Locks in ${minutes} min`;
}

function refreshSessionExpiry() {
  if (!screens.app.classList.contains("active")) {
    return;
  }

  const savedUser = getStoredUser();

  if (!savedUser) {
    return;
  }

  sessionStorage.setItem("secureAppUser", JSON.stringify({ ...savedUser, expiresAt: Date.now() + SESSION_TTL_MS }));
  updateSessionStatus();
}

function clearAllLocalData() {
  cleanupSessionArtifacts();
  sessionStorage.removeItem("secureAppUser");
  localStorage.removeItem("pendingSecureAppUser");
  localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("secureAppChat:") || key.startsWith("secureAppCreate:")) {
      localStorage.removeItem(key);
    }
  });

  chatMessages = [];
  createdProject = null;
  Object.assign(state, { email: "", name: "", mobile: "", token: "" });
  Object.values(createElements.fields).forEach((field) => {
    field.value = "";
  });
  createElements.panel.classList.add("hidden");
  createElements.status.textContent = "Not created";
  createElements.status.classList.remove("live");
  secureLogout({ clearStoredSession: false });
}

safetyElements.clearLocalData.addEventListener("click", clearAllLocalData);

function buildCreateAiDownloadHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'" />
    <meta name="referrer" content="no-referrer" />
    <title>Create_AI</title>
    <style>
      :root { font-family: Inter, system-ui, sans-serif; color: #141c22; background: #f8fffc; }
      * { box-sizing: border-box; }
      body {
        min-height: 100vh;
        margin: 0;
        background:
          linear-gradient(120deg, rgba(8, 125, 119, .14), transparent 35%),
          linear-gradient(300deg, rgba(110, 91, 215, .16), transparent 42%),
          #f8fffc;
      }
      main { width: min(980px, calc(100vw - 28px)); margin: 0 auto; padding: 28px 0; }
      header {
        padding: 28px;
        color: white;
        border-radius: 8px;
        background: linear-gradient(135deg, #087d77, #17232c 48%, #6e5bd7 78%, #cf942f);
      }
      .logo { width: 76px; height: 76px; display: grid; place-items: center; margin-bottom: 28px; border-radius: 18px; background: rgba(255,255,255,.12); font-size: 2.6rem; font-weight: 950; }
      h1, h2, p { margin-top: 0; letter-spacing: 0; }
      h1 { margin-bottom: 10px; font-size: clamp(2.4rem, 8vw, 5rem); line-height: .95; }
      section { margin-top: 14px; padding: 20px; border: 1px solid #d5e2e4; border-radius: 8px; background: rgba(255,255,255,.94); box-shadow: 0 20px 48px rgba(18,28,34,.1); }
      label { display: block; margin-top: 14px; font-weight: 800; }
      input, textarea { width: 100%; margin-top: 8px; padding: 12px; border: 1px solid #d5e2e4; border-radius: 8px; font: inherit; }
      textarea { min-height: 100px; resize: vertical; }
      button { min-height: 46px; margin-top: 14px; padding: 0 16px; border: 0; border-radius: 8px; color: white; background: #087d77; font: inherit; font-weight: 900; cursor: pointer; }
      .result { margin-top: 14px; padding: 16px; border-radius: 8px; background: #eef7f3; white-space: pre-wrap; }
      .safe-note { color: #64737a; font-size: .92rem; line-height: 1.55; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div class="logo">A</div>
        <h1>Create_AI</h1>
        <p>Create local browser app ideas without sending account details anywhere.</p>
      </header>

      <section>
        <h2>Create a web app</h2>
        <p class="safe-note">This downloaded copy is local. It does not include your password, email, mobile number, or chat history.</p>
        <label>Project name<input id="name" autocomplete="off" maxlength="120" /></label>
        <label>Purpose<textarea id="purpose" maxlength="1000"></textarea></label>
        <label>Problems to solve<textarea id="problems" maxlength="1000"></textarea></label>
        <label>User inputs<textarea id="inputs" maxlength="1000"></textarea></label>
        <label>Expected outputs<textarea id="outputs" maxlength="1000"></textarea></label>
        <button id="create" type="button">Generate Plan</button>
        <div class="result" id="result">Your app plan will appear here.</div>
      </section>
    </main>

    <script>
      function clean(value) {
        return value.trim() || "Not specified";
      }

      document.querySelector("#create").addEventListener("click", () => {
        const name = clean(document.querySelector("#name").value);
        const purpose = clean(document.querySelector("#purpose").value);
        const problems = clean(document.querySelector("#problems").value);
        const inputs = clean(document.querySelector("#inputs").value);
        const outputs = clean(document.querySelector("#outputs").value);

        document.querySelector("#result").textContent =
          name + "\\n\\n" +
          "Purpose: " + purpose + "\\n" +
          "Problems solved: " + problems + "\\n" +
          "Inputs accepted: " + inputs + "\\n" +
          "Outputs returned: " + outputs + "\\n\\n" +
          "Suggested build: create a clear input form, validate every field, generate the requested output, and keep all user data local unless a real backend is added.";
      });
    <\/script>
  </body>
</html>`;
}

function updateAppDownload() {
  const html = buildCreateAiDownloadHtml();
  const blob = new Blob([html], { type: "text/html" });

  if (appDownloadUrl) {
    URL.revokeObjectURL(appDownloadUrl);
  }

  appDownloadUrl = URL.createObjectURL(blob);
  appDownloadLink.href = appDownloadUrl;
  appDownloadLink.download = "Create_AI.html";
}

function setCreateError(key, message) {
  createElements.errors[key].textContent = message;
}

function clearCreateErrors() {
  Object.values(createElements.errors).forEach((error) => {
    error.textContent = "";
  });
}

function readCreateForm() {
  return {
    name: cleanText(createElements.fields.name.value, 120),
    purpose: cleanText(createElements.fields.purpose.value, 1000),
    problems: cleanText(createElements.fields.problems.value, 1000),
    inputs: cleanText(createElements.fields.inputs.value, 1000),
    outputs: cleanText(createElements.fields.outputs.value, 1000),
  };
}

function validateCreateProject(project) {
  clearCreateErrors();
  let hasError = false;

  Object.entries(project).forEach(([key, value]) => {
    if (!value) {
      setCreateError(key, "This field is required.");
      hasError = true;
    }
  });

  return !hasError;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function slugify(value) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "generated-app";
}

function splitIdeas(value) {
  return value
    .split(/\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function saveCreatedProject() {
  if (createdProject) {
    localStorage.setItem(getCreateKey(), JSON.stringify(createdProject));
  }
}

function loadCreatedProject() {
  const saved = localStorage.getItem(getCreateKey());

  if (!saved) {
    createdProject = null;
    createElements.panel.classList.add("hidden");
    createElements.status.textContent = "Not created";
    createElements.status.classList.remove("live");
    createElements.preview.srcdoc = "";
    createElements.title.textContent = "";
    createElements.updateCount.textContent = "0";
    return;
  }

  try {
    createdProject = JSON.parse(saved);
  } catch {
    createdProject = null;
    localStorage.removeItem(getCreateKey());
  }

  if (createdProject) {
    Object.entries(createElements.fields).forEach(([key, field]) => {
      field.value = createdProject[key] || "";
    });
    renderCreatedProject();
  }
}

function buildGeneratedAppHtml(project) {
  const problemItems = splitIdeas(project.problems);
  const inputItems = splitIdeas(project.inputs);
  const outputItems = splitIdeas(project.outputs);
  const updates = project.updates || [];
  const problemList = problemItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const inputList = inputItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const outputList = outputItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const updateList = updates.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'" />
    <meta name="referrer" content="no-referrer" />
    <title>${escapeHtml(project.name)}</title>
    <style>
      :root { font-family: Inter, system-ui, sans-serif; color: #172026; background: #f7faf9; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: linear-gradient(135deg, rgba(15,118,110,.08), rgba(197,139,44,.1)), #f7faf9; }
      main { width: min(980px, calc(100vw - 32px)); margin: 0 auto; padding: 34px 0; }
      header { padding: 26px; border-radius: 8px; color: white; background: linear-gradient(135deg, #0f766e, #22323a); }
      h1, h2, p { margin-top: 0; letter-spacing: 0; }
      h1 { margin-bottom: 10px; font-size: clamp(2rem, 6vw, 4rem); line-height: 1; }
      section { margin-top: 16px; padding: 20px; border: 1px solid #d7e0e4; border-radius: 8px; background: white; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      ul { padding-left: 18px; margin-bottom: 0; }
      textarea { width: 100%; min-height: 110px; padding: 12px; border: 1px solid #d7e0e4; border-radius: 8px; font: inherit; }
      button { min-height: 44px; padding: 0 16px; border: 0; border-radius: 8px; color: white; background: #0f766e; font: inherit; font-weight: 800; cursor: pointer; }
      .result { min-height: 92px; margin-top: 12px; padding: 14px; border-radius: 8px; background: #edf5f2; white-space: pre-wrap; }
      @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${escapeHtml(project.name)}</h1>
        <p>${escapeHtml(project.purpose)}</p>
      </header>

      <section class="grid">
        <article>
          <h2>Problems</h2>
          <ul>${problemList || `<li>${escapeHtml(project.problems)}</li>`}</ul>
        </article>
        <article>
          <h2>Inputs</h2>
          <ul>${inputList || `<li>${escapeHtml(project.inputs)}</li>`}</ul>
        </article>
        <article>
          <h2>Outputs</h2>
          <ul>${outputList || `<li>${escapeHtml(project.outputs)}</li>`}</ul>
        </article>
      </section>

      <section>
        <h2>Use the app</h2>
        <textarea id="user-input" maxlength="1000" placeholder="Enter your input"></textarea>
        <button id="generate-output" type="button">Generate Output</button>
        <div class="result" id="result">Your output will appear here.</div>
      </section>

      ${updates.length ? `<section><h2>Updates applied</h2><ul>${updateList}</ul></section>` : ""}
    </main>

    <script>
      const projectName = ${safeJson(project.name)};
      const purpose = ${safeJson(project.purpose)};
      const problems = ${safeJson(project.problems)};
      const outputs = ${safeJson(project.outputs)};

      document.querySelector("#generate-output").addEventListener("click", () => {
        const input = document.querySelector("#user-input").value.trim();
        const result = document.querySelector("#result");

        if (!input) {
          result.textContent = "Enter an input first, then the app will generate the output.";
          return;
        }

        result.textContent =
          projectName + " reviewed your input: " + input + "\\n\\n" +
          "Purpose: " + purpose + "\\n" +
          "Problems solved: " + problems + "\\n" +
          "Output style: " + outputs + "\\n\\n" +
          "Suggested result: organize the input, identify the main need, and return a focused answer for the user.";
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
  createElements.panel.classList.remove("hidden");
  createElements.status.textContent = "Published locally";
  createElements.status.classList.add("live");
  createElements.title.textContent = createdProject.name;
  createElements.preview.srcdoc = html;
  createElements.open.href = generatedAppUrl;
  createElements.download.href = generatedAppUrl;
  createElements.download.download = `${slugify(createdProject.name)}.html`;
  createElements.updateCount.textContent = String((createdProject.updates || []).length);
}

createElements.form.addEventListener("submit", (event) => {
  event.preventDefault();

  const project = readCreateForm();

  if (!validateCreateProject(project)) {
    return;
  }

  Object.entries(createElements.fields).forEach(([key, field]) => {
    field.value = project[key];
  });

  createdProject = {
    ...project,
    updates: [],
    createdAt: new Date().toISOString(),
  };
  saveCreatedProject();
  renderCreatedProject();
});

createElements.updateForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!createdProject) {
    return;
  }

  const request = cleanText(createElements.updateRequest.value, 1000);

  if (!request) {
    createElements.updateRequest.focus();
    return;
  }

  createdProject.updates = [...(createdProject.updates || []), request];
  createdProject.purpose = `${createdProject.purpose}\nUpdate: ${request}`;
  createElements.fields.purpose.value = createdProject.purpose;
  createElements.updateRequest.value = "";
  saveCreatedProject();
  renderCreatedProject();
});

function createWelcomeMessage() {
  return {
    role: "assistant",
    text: `Hi ${getFirstName()}, I am your AI chatbot. Ask me to write, summarize, plan, or explain anything.`,
  };
}

function saveChat() {
  localStorage.setItem(getChatKey(), JSON.stringify(chatMessages));
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

function setChatBusy(isBusy) {
  chatElements.input.disabled = isBusy;
  chatElements.form.querySelector("button").disabled = isBusy;
}

function showTypingMessage() {
  const bubble = document.createElement("div");
  bubble.className = "message assistant typing";
  bubble.textContent = "Thinking...";
  chatElements.messages.append(bubble);
  chatElements.messages.scrollTop = chatElements.messages.scrollHeight;
}

function getCreatedProjectSummary() {
  if (!createdProject) {
    return "";
  }

  return `\n\nCurrent created app: ${createdProject.name}\nPurpose: ${createdProject.purpose}\nInputs: ${createdProject.inputs}\nOutputs: ${createdProject.outputs}`;
}

function getPromptKeywords(prompt) {
  const ignored = new Set(["what", "when", "where", "which", "should", "would", "could", "about", "please", "with", "from", "that", "this", "your"]);
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !ignored.has(word))
    .slice(0, 5);
}

function buildPromptBasedAnswer(prompt) {
  const keywords = getPromptKeywords(prompt);
  const focus = keywords.length ? keywords.join(", ") : "your request";
  const questionIntro = prompt.includes("?") ? "Short answer" : "Helpful response";

  return `${questionIntro}: based on your prompt, the main focus is ${focus}.\n\n1. Clarify the exact goal.\n2. Break the request into the smallest useful steps.\n3. Create an output that matches the input and the result you asked for.\n\nMy suggested next step: provide one example input and one example output, then I can shape the answer more closely.${getCreatedProjectSummary()}`;
}

function buildAiReply(prompt) {
  const text = prompt.toLowerCase();
  const greeting = `${getFirstName()},`;

  if (text.includes("created app") || text.includes("generated app") || text.includes("publish")) {
    if (!createdProject) {
      return `${greeting} no app has been created yet. Fill the Create section with the project name, purpose, problems, inputs, and outputs, then click Create and Publish.`;
    }

    return `${greeting} your app "${createdProject.name}" is published locally for browser preview. You can open it in Chrome with the Open button, download the HTML file, and apply update requests from the Create section.`;
  }

  if (text.includes("account") || text.includes("details")) {
    return `${greeting} your account is verified.\nEmail: ${state.email}\nMobile: ${state.mobile}`;
  }

  if (text.includes("email") || text.includes("write")) {
    return `Subject: Quick update\n\nHi,\n\nI hope you are doing well. I wanted to share a clear update and confirm the next steps. Please let me know if you would like any changes.\n\nBest,\n${state.name || "Me"}`;
  }

  if (text.includes("plan") || text.includes("day")) {
    return `${greeting} here is a simple plan:\n1. Pick the most important task.\n2. Work on it for 45 minutes.\n3. Reply to messages.\n4. Review progress and choose the next small step.`;
  }

  if (text.includes("summarize") || text.includes("summary")) {
    return `${greeting} the short summary is: you have signed in, verified your account, and can now use the AI Chatbot section inside the app.`;
  }

  if (/(^|\s)(hello|hi|hey)(\s|$)/.test(text)) {
    return `Hi ${getFirstName()}. I am ready. What should we work on first?`;
  }

  return `${greeting} ${buildPromptBasedAnswer(prompt)}`;
}

function sendChatMessage(message) {
  const text = cleanText(message, 1000);

  if (!text || typingTimer) {
    return;
  }

  addChatMessage("user", text);
  chatElements.input.value = "";
  setChatBusy(true);
  showTypingMessage();

  typingTimer = window.setTimeout(() => {
    typingTimer = null;
    addChatMessage("assistant", buildAiReply(text));
    setChatBusy(false);
    chatElements.input.focus();
  }, 650);
}

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
  button.addEventListener("click", () => {
    sendChatMessage(button.dataset.prompt);
  });
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
  chatElements.input.focus();
});

document.addEventListener("click", refreshSessionExpiry);
document.addEventListener("keydown", refreshSessionExpiry);

window.setInterval(() => {
  if (!screens.app.classList.contains("active")) {
    return;
  }

  if (!getStoredUser()) {
    secureLogout({ clearStoredSession: false });
    return;
  }

  updateSessionStatus();
}, 15000);

window.addEventListener("hashchange", handleVerificationRoute);

const savedUser = getStoredUser();

if (handleVerificationRoute()) {
  // The verification hash chooses the first visible screen.
} else if (savedUser) {
  Object.assign(state, savedUser);
  fillAppScreen();
  showScreen("app");
} else {
  showScreen("account");
}
