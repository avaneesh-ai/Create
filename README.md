# Create_AI

Static browser app for a safe local AI chatbot and guided app builder.

## Files
- `index.html`
- `assets/styles.css`
- `assets/app.js`
- `assets/logo.png`
- `assets/background.png`
- `api/messages.js`
- `manifest.webmanifest`
- `sw.js`
- `.nojekyll`

## Notes
- No API key is required.
- When the Claude backend is connected, the chatbot can use Claude Sonnet 4.6 or Claude Haiku 4.5 through `/api/messages`.
- When the Claude backend is not connected, the chatbot still answers safe questions using local chatbot logic.
- The app builder also runs locally with prompt-based fallback logic.
- Generated apps are previewed in a sandboxed frame and can be opened or downloaded as HTML.
- The install button uses the browser install event when hosted over HTTPS, with fallback install steps in local preview.
- Passwords are not saved.
- Claude API keys must stay on the backend, never inside `index.html` or `assets/app.js`.
- To enable real Claude replies, deploy with `api/messages.js` and set `ANTHROPIC_API_KEY` as a server environment variable.
- For a real production login, add a secure backend with server-side password hashing and real email delivery.
