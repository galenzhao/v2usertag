const GITHUB_API_URL = 'https://api.github.com';
const TAGS_FILE_PATH = 'v2ex_tags.json';

// Keep an in-memory cache of tags for fast content-script access
let tagsCache = null;

// Initialize when extension loads
chrome.runtime.onInstalled.addListener(() => {
    console.log('V2EX Tags Sync extension installed.');
});

// MessageListener wrapper for content scripts -> background and popup -> background communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Background] Received message type:', request.type, request);
    if (request.type === 'INIT_REPO') {
        initializeRepo(request.repo)
            .then(() => {
                console.log('[Background] INIT_REPO success');
                sendResponse({ success: true })
            })
            .catch((err) => sendResponse({ success: false, error: err.message }));
        return true; // Keep message channel open for async response
    }

    if (request.type === 'GET_TAGS') {
        getTags()
            .then(tags => sendResponse({ success: true, tags }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (request.type === 'ADD_TAG') {
        console.log('[Background] Processing ADD_TAG for user:', request.username, 'tag:', request.tag);
        modifyTag(request.username, request.tag, 'add')
            .then(() => {
                console.log('[Background] modifyTag (add) success');
                sendResponse({ success: true })
            })
            .catch(err => {
                console.error('[Background] modifyTag (add) error:', err);
                sendResponse({ success: false, error: err.message })
            });
        return true;
    }

    if (request.type === 'REMOVE_TAG') {
        modifyTag(request.username, request.tag, 'remove')
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
});

// Fetch current configurations
async function getConfigs() {
    const data = await chrome.storage.local.get(['ghToken', 'ghUsername', 'ghRepo']);
    if (!data.ghToken || !data.ghRepo) {
        throw new Error('GitHub configuration missing. Please setup via popup.');
    }
    return data;
}

// Ensure the tags file exists in the repo
async function initializeRepo(repo) {
    const { ghToken } = await getConfigs();
    const url = `${GITHUB_API_URL}/repos/${repo}/contents/${TAGS_FILE_PATH}`;

    try {
        const res = await fetch(url + '?t=' + Date.now(), {
            headers: {
                'Authorization': `token ${ghToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (res.status === 404) {
            // Create empty file
            const content = btoa(JSON.stringify({})); // Empty json object base64 encoded
            const writeRes = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${ghToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'Initialize V2EX Tags sync file',
                    content: content
                })
            });
            if (!writeRes.ok) throw new Error('Failed to create file in repository');
            const data = await writeRes.json();
            tagsCache = {};
            await chrome.storage.local.set({ v2exTagsCache: tagsCache, fileSha: data.content.sha });
        } else if (!res.ok) {
            throw new Error('Failed to access repository');
        } else {
            // Success reading existing file, load it into cache
            const data = await res.json();
            const decoded = decodeURIComponent(escape(atob(data.content)));
            tagsCache = JSON.parse(decoded);
            await chrome.storage.local.set({ v2exTagsCache: tagsCache, fileSha: data.sha });
        }
    } catch (err) {
        console.error('Init Repo Error:', err);
        throw err;
    }
}

// Get tags from memory / storage / github
async function getTags() {
    if (tagsCache) return tagsCache;
    const data = await chrome.storage.local.get(['v2exTagsCache']);
    if (data.v2exTagsCache) {
        tagsCache = data.v2exTagsCache;
        return tagsCache;
    }

    // Need to fetch from GitHub
    const { ghRepo, ghToken } = await getConfigs();
    const url = `${GITHUB_API_URL}/repos/${ghRepo}/contents/${TAGS_FILE_PATH}`;
    const res = await fetch(url + '?t=' + Date.now(), {
        headers: {
            'Authorization': `token ${ghToken}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (res.ok) {
        const fileData = await res.json();
        const decoded = decodeURIComponent(escape(atob(fileData.content)));
        tagsCache = JSON.parse(decoded);
        await chrome.storage.local.set({ v2exTagsCache: tagsCache, fileSha: fileData.sha });
        return tagsCache;
    } else if (res.status === 404) {
        return {};
    } else {
        throw new Error('Cannot fetch tags from GitHub');
    }
}

async function modifyTag(username, tag, action) {
    console.log(`[modifyTag] Called with username=${username}, tag=${tag}, action=${action}`);
    const currentTags = await getTags();
    console.log('[modifyTag] Current tags from getTags():', clonedTags(currentTags));
    if (!currentTags[username]) {
        currentTags[username] = [];
    }

    const userTags = currentTags[username];
    let isModified = false;

    if (action === 'add') {
        if (!userTags.includes(tag)) {
            userTags.push(tag);
            isModified = true;
        }
    } else if (action === 'remove') {
        const index = userTags.indexOf(tag);
        if (index > -1) {
            userTags.splice(index, 1);
            isModified = true;
        }
        // Clean up empty array
        if (userTags.length === 0) {
            delete currentTags[username];
        }
    }

    console.log(`[modifyTag] isModified=${isModified}`);
    if (isModified) {
        tagsCache = currentTags;
        // Save to local immediately so UI feels fast
        await chrome.storage.local.set({ v2exTagsCache: tagsCache });
        console.log('[modifyTag] Saved to local storage. Awaiting syncToGitHub...');

        // Await the GitHub sync directly to hold the service worker alive
        await syncToGitHub(currentTags);
        console.log('[modifyTag] syncToGitHub completed.');
    }
}

function clonedTags(tags) {
    try { return JSON.parse(JSON.stringify(tags)); } catch (e) { return tags; }
}

async function syncToGitHub(tagsObj) {
    console.log('[syncToGitHub] Starting sync. Object:', clonedTags(tagsObj));
    try {
        const { ghRepo, ghToken } = await getConfigs();
        const { fileSha } = await chrome.storage.local.get(['fileSha']);
        console.log(`[syncToGitHub] Config repo=${ghRepo}, currentSha=${fileSha}`);

        const url = `${GITHUB_API_URL}/repos/${ghRepo}/contents/${TAGS_FILE_PATH}`;

        // Convert object stringify to base64 properly handling unicode
        const jsonStr = JSON.stringify(tagsObj, null, 2);
        const content = btoa(unescape(encodeURIComponent(jsonStr)));

        const payload = {
            message: 'Update V2EX User Tags',
            content: content
        };

        // If file exists, need to provide SHA to update it
        if (fileSha) {
            payload.sha = fileSha;
        } else {
            // Double check SHA if somehow missing
            const checkRes = await fetch(url + '?t=' + Date.now(), { headers: { 'Authorization': `token ${ghToken}` } });
            if (checkRes.ok) {
                const fileData = await checkRes.json();
                payload.sha = fileData.sha;
            }
        }

        console.log(`[syncToGitHub] Using SHA for update: ${payload.sha}`);

        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${ghToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('[syncToGitHub] Response completely failed:', res.status, res.statusText, errText);
            throw new Error(`Failed to sync to GitHub: ${errText}`);
        }

        const responseData = await res.json();
        console.log('[syncToGitHub] Success response! Data:', responseData);
        // Update the SHA for next write operation
        await chrome.storage.local.set({ fileSha: responseData.content.sha });
        console.log('[syncToGitHub] fileSha updated locally to:', responseData.content.sha);

    } catch (err) {
        console.error('[syncToGitHub] Fatal Sync error:', err);
        throw err;
    }
}
