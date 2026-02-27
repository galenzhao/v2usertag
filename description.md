# V2EX User Tags - Sync Custom Labels Across Devices

Elevate your V2EX experience by adding custom tags to users directly in the discussion threads. "V2EX User Tags" is a lightweight, strictly-private Chrome extension that allows you to label users for better context and seamlessly syncs this data across all your devices using your personal GitHub repository.

## 🌟 Why V2EX User Tags?

Ever bumped into a user sharing incredibly insightful comments and wished you could mark them as "Hardware Expert" or "Great problem solver"? Or maybe you want to discreetly tag users to filter out noise? V2EX doesn't offer a native tagging feature, and local-only extensions lose your data the moment you switch from your laptop to your desktop. 

We solve this elegantly by leveraging GitHub's infrastructure as a free, secure backend, built exclusively for you.

## ✨ Key Features

**🏷️ Seamless Inline Tagging**
No clunky dashboards. Add, view, and remove tags directly within V2EX conversation threads. A subtle '+' button appears next to usernames, allowing you to quickly stamp a visually pleasing badge without breaking your reading flow. 

**☁️ 100% Free Cloud Sync (via GitHub)**
Never lose your tags again. By securely connecting the extension to your own GitHub repository using a Fine-Grained Personal Access Token (PAT), your tag library is saved as a simple `.json` file (`v2ex_tags.json`). Open the browser on your work computer or personal laptop—your tags are everywhere you go.

**🔒 Total Privacy & Security First**
Your data never touches a third-party server. There are no tracking scripts, no analytics, and no mandatory backend databases. The extension acts purely as a bridge between the V2EX frontend and GitHub API. Your tags belong strictly to you and sit safely in a private repository you control.

**⚡ Optimized Performance**
Engineered using Manifest V3 standards with a lightweight background service worker. Network requests to GitHub are intelligently debounced and cached locally. This ensures your V2EX pages load instantly and GitHub's API rate limits are never exceeded.

**🎨 Stunning Aesthetics**
We believe utility tools should look beautiful. The tags injected into the page use a premium, gradient-driven aesthetic combined with smooth micro-animations that feel native to a modern web experience, rather than feeling hacked-in.

---

## 🛠️ How it Works in 3 Steps

1. **Install the Extension:** Click "Add to Chrome" and pin the extension icon.
2. **Link GitHub Safely:** Open the extension popup. Follow the built-in guide to generate a safe, repository-scoped GitHub Fine-Grained Token.
3. **Start Tagging:** Select a repository from the dropdown. Head over to any V2EX thread, click the '+' next to a username, and build your contextual network!

---

*Disclaimer: "V2EX User Tags" is an independent, open-source project and is not affiliated with, endorsed by, or officially connected to V2EX (v2ex.com).*
