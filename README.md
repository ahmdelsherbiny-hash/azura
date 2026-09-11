# Azura Studio — Luxury Architectural Website & Digital Identity

A refined, minimal, high-performance website prototype designed for **Azura Studio** (Architecture, Interior, and CGI Visualization).

---

## ✨ Key Features & Capabilities

- **Architectural Identity & Design System:** Derived directly from the Azura logo emblem — deep sapphire diamond blue (`#0a2540`), architectural gold accents (`#c5a880`), and travertine textures.
- **Hero Split-Screen Wipe (Sketch to Render):** Seamless interactive comparison slider showing the transformation of an architectural 2D sketch into a photorealistic render with an Azura-blue glowing divider line.
- **Diamond Constellation Particle Canvas:** High-performance background animation inspired by blue diamonds and stars, paused automatically when tab is hidden or when reduced motion is preferred.
- **8 Selected Projects (Editorial Asymmetric Grid):** Curated architectural showcase with smooth scroll-to-reveal animations and direct exploration links.
- **Complete Bilingual Support (EN / AR):** Dynamic instantaneous switching with complete RTL (Right-to-Left) typography, spacing, and alignment adjustments.
- **Dark Mode & Light Mode (Travertine):** Luxury obsidian dark theme and limestone/travertine light theme with `localStorage` persistence.
- **Privacy-Friendly Analytics:** First-party anonymous session and interaction tracking without invasive cookies or keystroke logging.
- **Secure Cloudflare Worker API:** Connects the RFQ submissions and analytics to Google Sheets while keeping all credentials safely server-side.

---

## 📁 Project Structure

```
AZURA WEBSITE/
├── index.html                   # Main landing page markup
├── assets/
│   ├── css/
│   │   ├── style.css            # Design tokens, typography, layout, RTL rules
│   │   └── animations.css       # Keyframes, scroll-reveal, diamond shimmer
│   ├── js/
│   │   ├── app.js               # i18n dictionaries, theme toggle, nav controls
│   │   ├── hero-slider.js       # Interactive sketch-to-render wipe logic
│   │   ├── particles.js         # Diamond constellation canvas animation
│   │   ├── analytics.js         # Privacy-friendly session & event tracker
│   │   └── rfq.js               # RFQ validation, submission & feedback states
│   └── images/                  # High-resolution architectural renders & logo
├── backend/
│   └── worker.js                # Cloudflare Worker API for Google Sheets sync
├── Azura_Studio_Website_Spec.md # Original project specifications
└── README.md                    # Documentation & deployment guide
```

---

## 🚀 How to Run Locally

Because the project is built with vanilla modern web standards (HTML5, CSS3, ES6+ Modules), no complex build step or `npm install` is required:

1. Open `index.html` directly in any modern browser, or use a local development server (e.g. VS Code Live Server / `python -m http.server 8000` / `npx serve`).
2. Test the language switcher (`EN` / `عربي`) and theme switcher (🌙 / ☀️).
3. Interact with the Hero split-screen slider by dragging or letting it auto-pan smoothly.

---

## ☁️ Cloudflare Worker & Google Sheets Integration

### Step 1: Set up Google Sheets Webhook
1. Create a new Google Sheet named **Azura Studio Data** with two sheets: `RFQ_Submissions` and `Analytics_Events`.
2. Go to **Extensions > Apps Script** and paste a lightweight webhook script:
```javascript
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (data.type === 'RFQ_SUBMISSION') {
    var sheet = ss.getSheetByName('RFQ_Submissions') || ss.insertSheet('RFQ_Submissions');
    sheet.appendRow([data.timestamp, data.name, data.email, data.phone, data.clientType, data.brief, data.language]);
  } else if (data.type === 'ANALYTICS_EVENT') {
    var sheet = ss.getSheetByName('Analytics_Events') || ss.insertSheet('Analytics_Events');
    sheet.appendRow([data.timestamp, data.sessionId, data.eventName, JSON.stringify(data.eventData), data.language, data.theme, data.elapsedSeconds]);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
}
```
3. Click **Deploy > New Deployment > Web App** (set access to *Anyone*), and copy the deployment URL.

### Step 2: Deploy Cloudflare Worker
1. Deploy `backend/worker.js` to Cloudflare Workers via Wrangler or the Cloudflare Dashboard.
2. Add the secret environment variable:
   - `GOOGLE_SHEET_WEBHOOK_URL` = `<Your Google Apps Script Web App URL>`
3. Set your Worker route endpoint in `assets/js/app.js`:
```javascript
window.AZURA_CONFIG = {
  ANALYTICS_ENDPOINT: 'https://your-worker.your-subdomain.workers.dev/api/analytics',
  RFQ_ENDPOINT: 'https://your-worker.your-subdomain.workers.dev/api/rfq',
  // ...
};
```

---

## 🌐 Deploying to GitHub Pages
1. Push the repository to GitHub.
2. In GitHub repository settings, go to **Pages**.
3. Under **Branch**, select `main` (or `master`) and folder `/ (root)`, then click **Save**.
4. To connect your custom domain (e.g. `azurastudio.com`), enter it under **Custom domain** and configure the DNS CNAME records.
