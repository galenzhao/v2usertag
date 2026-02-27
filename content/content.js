// Main logic to observe and inject tags into V2EX
let allTags = {};

// 1. Fetch tags from background script initially
function init() {
    console.log('[V2EX Tags] init() called');
    chrome.runtime.sendMessage({ type: 'GET_TAGS' }, (response) => {
        console.log('[V2EX Tags] GET_TAGS response:', response);
        if (response && response.success) {
            allTags = response.tags || {};
            processDOM();
        } else {
            console.warn('[V2EX Tags] Not configured or failed to load tags.', response?.error);
        }
    });
}

// 2. Traversal and element selection
function processDOM() {
    // Find all links that go to /member/*
    const links = document.querySelectorAll('a[href^="/member/"]');

    links.forEach(link => {
        const text = link.textContent.trim();
        // Exclude avatars (which contain <img>) and empty links
        if (text.length > 0 && !link.querySelector('img') && !link.dataset.v2tagsProcessed) {
            link.dataset.v2tagsProcessed = "true";

            const username = link.getAttribute('href').replace('/member/', '');
            if (username) {
                injectTagContainer(link, username);
            }
        }
    });
}

// 3. Inject Tag UI Next to User Link
function injectTagContainer(userLinkElement, username) {
    const container = document.createElement('span');
    container.className = 'v2user-tags-container';
    container.dataset.username = username;

    renderTags(container, username);

    // Insert after the username link
    userLinkElement.parentNode.insertBefore(container, userLinkElement.nextSibling);
}

// 4. Render Tags + Add Button inside a container
function renderTags(container, username) {
    container.innerHTML = ''; // Clear

    const userTags = allTags[username] || [];

    // Render existing tags
    userTags.forEach(tagText => {
        const tagEl = document.createElement('span');
        tagEl.className = 'v2user-tag';

        tagEl.innerHTML = `
      <span class="tag-text">${escapeHTML(tagText)}</span>
      <span class="tag-remove">×</span>
    `;

        // Click to remove
        tagEl.addEventListener('click', () => {
            // Optimistic update
            tagEl.remove();
            allTags[username] = allTags[username].filter(t => t !== tagText);
            console.log(`[V2EX Tags] Sending REMOVE_TAG: username=${username}, tag=${tagText}`);
            chrome.runtime.sendMessage({ type: 'REMOVE_TAG', username, tag: tagText }, (res) => {
                console.log(`[V2EX Tags] REMOVE_TAG response:`, res);
            });
        });

        container.appendChild(tagEl);
    });

    // Render Add Button
    const addBtn = document.createElement('span');
    addBtn.className = 'v2user-tag-add';
    addBtn.title = "Add a tag";
    addBtn.innerHTML = '+';

    addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showInput(container, username, addBtn);
    });

    container.appendChild(addBtn);
}

// 5. Show inline input for adding a tag
function showInput(container, username, addBtn) {
    addBtn.classList.add('hidden');

    const wrapper = document.createElement('span');
    wrapper.className = 'v2user-tag-input-wrapper';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'v2user-tag-input';
    input.placeholder = 'Tag...';
    input.maxLength = 20;

    const btnConfirm = document.createElement('button');
    btnConfirm.className = 'v2user-tag-input-confirm';
    btnConfirm.innerHTML = '✓';

    const btnCancel = document.createElement('button');
    btnCancel.className = 'v2user-tag-input-cancel';
    btnCancel.innerHTML = '×';

    wrapper.appendChild(input);
    wrapper.appendChild(btnConfirm);
    wrapper.appendChild(btnCancel);

    container.appendChild(wrapper);

    // Focus input
    input.focus();

    // Handle submit
    const submitTag = () => {
        const val = input.value.trim();
        if (val && val.length > 0) {
            // Optimistic update
            if (!allTags[username]) allTags[username] = [];
            if (!allTags[username].includes(val)) {
                allTags[username].push(val);
                console.log(`[V2EX Tags] Sending ADD_TAG: username=${username}, tag=${val}`);
                chrome.runtime.sendMessage({ type: 'ADD_TAG', username, tag: val }, (res) => {
                    console.log(`[V2EX Tags] ADD_TAG response:`, res);
                });
            }
        }
        wrapper.remove();
        renderTags(container, username); // re-render
    };

    btnConfirm.addEventListener('click', submitTag);

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitTag();
        if (e.key === 'Escape') {
            wrapper.remove();
            addBtn.classList.remove('hidden');
        }
    });

    btnCancel.addEventListener('click', () => {
        wrapper.remove();
        addBtn.classList.remove('hidden');
    });
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag])
    );
}

// Execute Init
init();

// Support for dynamically loaded content on V2EX (if any) or just a simple MutationObserver
const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;
    mutations.forEach(m => {
        if (m.addedNodes.length > 0) shouldProcess = true;
    });
    if (shouldProcess) processDOM();
});

observer.observe(document.body, { childList: true, subtree: true });
