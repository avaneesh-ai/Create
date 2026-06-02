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
- When the Ollama Cloud backend is connected, the chatbot can use Ollama cloud models through `/api/messages`.
- When the Ollama Cloud backend is not connected, the zero-cost local chatbot still answers every safe prompt using local chatbot logic.
- The app builder also runs locally with prompt-based fallback logic.
- Generated apps are previewed in a sandboxed frame and can be opened or downloaded as HTML.
- The install button uses the browser install event when hosted over HTTPS, with fallback install steps in local preview.
- Passwords are not saved.
- Ollama API keys must stay on the backend, never inside `index.html` or `assets/app.js`.
- To enable real Ollama Cloud replies, deploy with `api/messages.js` and set `OLLAMA_API_KEY` as a Vercel environment variable.
- For a real production login, add a secure backend with server-side password hashing and real email delivery.
