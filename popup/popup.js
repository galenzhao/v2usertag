document.addEventListener('DOMContentLoaded', async () => {
  const UI = {
    auth: document.getElementById('auth-section'),
    repo: document.getElementById('repo-section'),
    ready: document.getElementById('ready-section')
  };

  const els = {
    patInput: document.getElementById('pat-input'),
    btnVerify: document.getElementById('btn-verify-token'),
    btnVerifyText: document.querySelector('#btn-verify-token .btn-text'),
    spinner: document.querySelector('.spinner'),
    authMessage: document.getElementById('auth-message'),
    
    userInfo: document.getElementById('user-info'),
    repoSelect: document.getElementById('repo-select'),
    btnSaveRepo: document.getElementById('btn-save-repo'),
    btnDisconnect: document.getElementById('btn-disconnect'),
    
    currentRepoName: document.getElementById('current-repo-name'),
    btnChangeSettings: document.getElementById('btn-change-settings')
  };

  let currentState = { token: null, username: null, repo: null };

  // Initialize
  await loadState();

  function showSection(name) {
    Object.values(UI).forEach(el => el.classList.add('hidden'));
    if (UI[name]) UI[name].classList.remove('hidden');
  }

  function showMessage(text, isError = false) {
    els.authMessage.textContent = text;
    els.authMessage.className = `message ${isError ? 'error' : 'success'}`;
    els.authMessage.classList.remove('hidden');
  }

  function hideMessage() {
    els.authMessage.classList.add('hidden');
  }

  function setLoading(isLoading) {
    if (isLoading) {
      els.btnVerifyText.classList.add('hidden');
      els.spinner.classList.remove('hidden');
      els.btnVerify.disabled = true;
      els.patInput.disabled = true;
    } else {
      els.btnVerifyText.classList.remove('hidden');
      els.spinner.classList.add('hidden');
      els.btnVerify.disabled = false;
      els.patInput.disabled = false;
    }
  }

  async function loadState() {
    const data = await chrome.storage.local.get(['ghToken', 'ghUsername', 'ghRepo']);
    currentState = {
      token: data.ghToken || null,
      username: data.ghUsername || null,
      repo: data.ghRepo || null
    };

    if (currentState.token && currentState.repo) {
      els.currentRepoName.textContent = currentState.repo;
      showSection('ready');
    } else if (currentState.token) {
      showSection('repo');
      els.userInfo.textContent = `Logged in as ${currentState.username}`;
      fetchRepositories(currentState.token);
    } else {
      showSection('auth');
    }
  }

  // Handle Verify Token
  els.btnVerify.addEventListener('click', async () => {
    const token = els.patInput.value.trim();
    if (!token) {
      showMessage('Please enter a valid token.', true);
      return;
    }

    hideMessage();
    setLoading(true);

    try {
      const resp = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!resp.ok) {
        throw new Error('Invalid token or network error.');
      }

      const user = await resp.json();
      
      // Save token and username
      await chrome.storage.local.set({ ghToken: token, ghUsername: user.login });
      currentState.token = token;
      currentState.username = user.login;
      
      els.userInfo.textContent = `Logged in as ${user.login}`;
      showSection('repo');
      fetchRepositories(token);

    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setLoading(false);
    }
  });

  // Handle Fetch Repos
  async function fetchRepositories(token) {
    els.repoSelect.innerHTML = '<option value="">Loading repositories...</option>';
    els.repoSelect.disabled = true;
    els.btnSaveRepo.disabled = true;

    try {
      // Fetch user repos
      const resp = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!resp.ok) throw new Error('Failed to fetch repositories.');

      const repos = await resp.json();
      
      // Filter out only repositories where user has push access
      const writableRepos = repos.filter(r => r.permissions && r.permissions.push);
      
      els.repoSelect.innerHTML = '<option value="">-- Select a repository --</option>';
      writableRepos.forEach(repo => {
        const opt = document.createElement('option');
        opt.value = repo.full_name;
        opt.textContent = repo.full_name + (repo.private ? ' 🔒' : '');
        els.repoSelect.appendChild(opt);
      });

      els.repoSelect.disabled = false;

    } catch (err) {
      els.repoSelect.innerHTML = `<option value="">Error: ${err.message}</option>`;
    }
  }

  els.repoSelect.addEventListener('change', (e) => {
    els.btnSaveRepo.disabled = !e.target.value;
  });

  // Handle Save Repo
  els.btnSaveRepo.addEventListener('click', async () => {
    const repo = els.repoSelect.value;
    if (!repo) return;

    await chrome.storage.local.set({ ghRepo: repo });
    
    // Notify background script to initialize or verify file existence
    chrome.runtime.sendMessage({ type: 'INIT_REPO', repo: repo }, (response) => {
        // Just proceed to ready screen, background will handle file creation/fetching silently
        currentState.repo = repo;
        els.currentRepoName.textContent = repo;
        showSection('ready');
    });
  });

  // Disconnect / Change Settings
  async function clearSettings() {
    await chrome.storage.local.remove(['ghToken', 'ghUsername', 'ghRepo', 'v2exTagsCache']);
    currentState = { token: null, username: null, repo: null };
    els.patInput.value = '';
    hideMessage();
    showSection('auth');
  }

  els.btnDisconnect.addEventListener('click', clearSettings);
  els.btnChangeSettings.addEventListener('click', () => {
    // Keep token, just change repo
    chrome.storage.local.remove(['ghRepo']).then(() => {
        fetchRepositories(currentState.token);
        showSection('repo');
    });
  });

});
