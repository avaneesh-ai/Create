# Create_AI

Static browser app for a safe local AI chatbot and guided app builder.

## Files
- `index.html`
- `assets/styles.css`
- `assets/app.js`
- `assets/logo.png`
- `assets/background.png`
- `manifest.webmanifest`
- `sw.js`
- `.nojekyll`

## Notes
- No API key is required.
- The chatbot and app builder run locally with prompt-based logic.
- Generated apps are previewed in a sandboxed frame and can be opened or downloaded as HTML.
- The install button uses the browser install event when hosted over HTTPS, with fallback install steps in local preview.
- Passwords are not saved.
- For a real production login, add a secure backend with server-side password hashing and real email delivery.
