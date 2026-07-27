const GOOGLE_CLIENT_ID = "149310433677-59s44lsvvvfnt70g6okhvvrprj2td9ht.apps.googleusercontent.com";
const ATLASSIAN_CLIENT_ID = "OULWq49W7enCX1cVWMFtRTlj2axvx0Ge";

const DEFAULT_SCOPES = [
    "Logic", "Logic UI", "UI", "Interruption", "Sound",
    "Tutorial/Trial", "Data", " promotion", "Common Behaviour",
    "Compatibility", "UAT", "Regression Test", "Check Feedback",
    "Crosscheck", "BetfailBan&Maintainance"
];

const PRIORITY_ORDER = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

let currentScopesList = [...DEFAULT_SCOPES];
let checkedScopesMap = {};
let currentJiraStatuses = [];
let checkedJiraStatusesMap_B = {};
let checkedJiraStatusesMap_Unverified = {};
let checkedJiraStatusesMap_Pending = {};
let customNotesData = [];
let currentLoadingToast = null;
let googleAccessToken = localStorage.getItem('google_access_token') || null;
let jiraAccessToken = localStorage.getItem('jira_access_token') || null;
let jiraCloudId = localStorage.getItem('jira_cloud_id') || null;

async function handleJiraAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
        showLoadingToast('Processing Jira SSO login...');
        try {
            const redirectUri = window.location.origin + window.location.pathname;
            const res = await fetch('/api/jira-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, redirectUri })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Authentication failed');
            jiraAccessToken = data.access_token;
            jiraCloudId = data.cloud_id;
            localStorage.setItem('jira_access_token', jiraAccessToken);
            localStorage.setItem('jira_cloud_id', jiraCloudId);
            window.history.replaceState({}, document.title, window.location.pathname);
            updateJiraAuthUI();
            hideLoadingToast();
            showSuccessToast("Connected to Jira SSO successfully!");
        } catch (e) {
            hideLoadingToast();
            showErrorToast("Jira Login Error: " + e.message);
        }
    }
}

function updateJiraAuthUI() {
    const statusText = document.getElementById('jira-status-text');
    const statusDot = document.getElementById('jira-status-dot');
    const loginBtn = document.getElementById('btn-jira-login');
    if (jiraAccessToken && jiraCloudId) {
        if (statusText) {
            statusText.innerText = "Jira: Connected";
            statusText.style.color = "var(--success)";
        }
        if (statusDot) {
            statusDot.style.backgroundColor = "var(--success)";
        }
        if (loginBtn) {
            loginBtn.innerText = "Disconnect";
            loginBtn.className = "btn btn-sm btn-secondary";
            loginBtn.onclick = () => {
                localStorage.removeItem('jira_access_token');
                localStorage.removeItem('jira_cloud_id');
                jiraAccessToken = null;
                jiraCloudId = null;
                updateJiraAuthUI();
                showSuccessToast("Disconnected Jira.");
            };
        }
    } else {
        if (statusText) {
            statusText.innerText = "Jira: Not Connected";
            statusText.style.color = "var(--text-muted)";
        }
        if (statusDot) {
            statusDot.style.backgroundColor = "var(--text-muted)";
        }
        if (loginBtn) {
            loginBtn.innerText = "Connect SSO";
            loginBtn.className = "btn btn-sm btn-primary";
            loginBtn.onclick = initiateJiraSSO;
        }
    }
}

function initiateJiraSSO() {
    const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
    const scope = encodeURIComponent("read:jira-work read:jira-user offline_access");
    const authUrl = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${ATLASSIAN_CLIENT_ID}&scope=${scope}&redirect_uri=${redirectUri}&response_type=code&prompt=consent`;
    window.location.href = authUrl;
}

async function getGoogleToken(forceRefresh = false) {
    if (!forceRefresh && googleAccessToken) {
        return googleAccessToken;
    }
    return new Promise((resolve, reject) => {
        if (!window.google || !window.google.accounts) {
            reject(new Error("Google Identity SDK failed to load. Check internet connection."));
            return;
        }
        const client = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.metadata.readonly',
            callback: (response) => {
                if (response.error) {
                    if (response.error === 'interaction_required') {
                        reject(new Error("Session expired. Please reload and click Generate again."));
                    } else {
                        reject(new Error("Google Login Error: " + response.error));
                    }
                } else {
                    googleAccessToken = response.access_token;
                    localStorage.setItem('google_access_token', googleAccessToken);
                    resolve(googleAccessToken);
                }
            },
        });
        if (forceRefresh) {
            client.requestAccessToken({ prompt: '' });
        } else {
            client.requestAccessToken();
        }
    });
}

async function getGameIdFromDriveFolder(folderUrl, token) {
    if (!folderUrl) return null;
    const folderIdMatch = folderUrl.match(/folders\/([a-zA-Z0-9-_]+)/);
    if (!folderIdMatch) return null;
    const folderId = folderIdMatch[1];
    try {
        const driveApiUrl = `https://www.googleapis.com/drive/v3/files/${folderId}?fields=name`;
        const res = await fetch(driveApiUrl, { headers: { 'Authorization': 'Bearer ' + token } });
        if (!res.ok) return null;
        const data = await res.json();
        const folderName = data.name || '';
        const gameIdMatch = folderName.match(/^\d{4}/);
        return gameIdMatch ? gameIdMatch[0] : null;
    } catch (e) {
        return null;
    }
}

function toggleAppVersionRequirement() {
    const reqStar = document.getElementById('req-app-version');
    const chkWebapp = document.getElementById('chk-webapp');
    const chkApptek = document.getElementById('chk-apptek');
    if (reqStar) {
        if ((chkWebapp && chkWebapp.checked) || (chkApptek && chkApptek.checked)) {
            reqStar.style.display = 'inline';
        } else {
            reqStar.style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadLastSession();
    await handleJiraAuthCallback();
    updateJiraAuthUI();

    const chkWebapp = document.getElementById('chk-webapp');
    const chkApptek = document.getElementById('chk-apptek');
    if (chkWebapp) chkWebapp.addEventListener('change', toggleAppVersionRequirement);
    if (chkApptek) chkApptek.addEventListener('change', toggleAppVersionRequirement);

    document.getElementById('btn-all-scope').addEventListener('click', () => {
        currentScopesList.forEach(s => checkedScopesMap[s] = true);
        saveCurrentSessionState();
        renderScopeCheckboxes();
    });
    document.getElementById('btn-none-scope').addEventListener('click', () => {
        currentScopesList.forEach(s => checkedScopesMap[s] = false);
        saveCurrentSessionState();
        renderScopeCheckboxes();
    });

    document.getElementById('btn-add-scope').addEventListener('click', () => {
        const input = document.getElementById('new-scope-input');
        const val = input.value.trim();
        if (val && !currentScopesList.includes(val)) {
            currentScopesList.push(val);
            checkedScopesMap[val] = true;
            input.value = '';
            renderScopeCheckboxes();
            saveCurrentSessionState();
        }
    });

    document.getElementById('btn-all-b').addEventListener('click', () => {
        currentJiraStatuses.forEach(s => checkedJiraStatusesMap_B[s] = true);
        saveCurrentSessionState();
        renderStatusGroup('status-b-container', checkedJiraStatusesMap_B);
    });
    document.getElementById('btn-none-b').addEventListener('click', () => {
        currentJiraStatuses.forEach(s => checkedJiraStatusesMap_B[s] = false);
        saveCurrentSessionState();
        renderStatusGroup('status-b-container', checkedJiraStatusesMap_B);
    });

    document.getElementById('btn-all-unverified').addEventListener('click', () => {
        currentJiraStatuses.forEach(s => checkedJiraStatusesMap_Unverified[s] = true);
        saveCurrentSessionState();
        renderStatusGroup('status-unverified-container', checkedJiraStatusesMap_Unverified);
    });
    document.getElementById('btn-none-unverified').addEventListener('click', () => {
        currentJiraStatuses.forEach(s => checkedJiraStatusesMap_Unverified[s] = false);
        saveCurrentSessionState();
        renderStatusGroup('status-unverified-container', checkedJiraStatusesMap_Unverified);
    });

    document.getElementById('btn-all-pending').addEventListener('click', () => {
        currentJiraStatuses.forEach(s => checkedJiraStatusesMap_Pending[s] = true);
        saveCurrentSessionState();
        renderStatusGroup('status-pending-container', checkedJiraStatusesMap_Pending);
    });
    document.getElementById('btn-none-pending').addEventListener('click', () => {
        currentJiraStatuses.forEach(s => checkedJiraStatusesMap_Pending[s] = false);
        saveCurrentSessionState();
        renderStatusGroup('status-pending-container', checkedJiraStatusesMap_Pending);
    });

    document.getElementById('btn-load-statuses').addEventListener('click', async () => {
        const projectKey = document.getElementById('sheet-name').value.trim();
        if (!jiraAccessToken || !jiraCloudId) {
            initiateJiraSSO();
            return;
        }
        if (!projectKey) {
            showErrorToast("Please enter a Project Key before loading statuses.");
            return;
        }
        showLoadingToast('Fetching Jira statuses...');
        try {
            const targetUrl = `https://api.atlassian.com/ex/jira/${jiraCloudId}/rest/api/2/project/${projectKey}/statuses`;
            const res = await fetch(targetUrl, {
                headers: { 'Authorization': 'Bearer ' + jiraAccessToken, 'Accept': 'application/json' }
            });
            if (!res.ok) throw new Error("Project not found or access denied.");
            const data = await res.json();
            const statusSet = new Set();
            data.forEach(issueType => {
                issueType.statuses.forEach(status => {
                    statusSet.add(status.name.toUpperCase());
                });
            });
            currentJiraStatuses = Array.from(statusSet);
            checkedJiraStatusesMap_B = {};
            checkedJiraStatusesMap_Unverified = {};
            checkedJiraStatusesMap_Pending = {};
            currentJiraStatuses.forEach(s => {
                const cleanS = s.replace(/[^A-Z0-9]/g, '');
                checkedJiraStatusesMap_B[s] = ['TODO', 'INPROGRESS', 'FIXEDDONE', 'FIXDONE', 'RESOLVED'].includes(cleanS);
                checkedJiraStatusesMap_Unverified[s] = ['DEPLOYED', 'INTESTING'].includes(cleanS);
                checkedJiraStatusesMap_Pending[s] = ['PENDING', 'WAITFOR', 'WAITING'].some(p => cleanS.includes(p));
            });
            renderJiraStatuses();
            saveCurrentSessionState();
            hideLoadingToast();
            showSuccessToast("Loaded Jira statuses successfully!");
        } catch (err) {
            hideLoadingToast();
            showErrorToast("Failed to load Jira statuses: " + err.message);
        }
    });

    const chkCustomNote = document.getElementById('chk-custom-note');
    const notesWrapper = document.getElementById('notes-wrapper');
    const btnAddNote = document.getElementById('btn-add-note');

    chkCustomNote.addEventListener('change', () => {
        notesWrapper.style.display = chkCustomNote.checked ? 'flex' : 'none';
        if (chkCustomNote.checked && customNotesData.length === 0) {
            customNotesData.push('');
            renderNotes();
        }
        saveCurrentSessionState();
    });

    btnAddNote.addEventListener('click', () => {
        customNotesData.push('');
        renderNotes();
        saveCurrentSessionState();
    });

    document.getElementById('btn-preview').addEventListener('click', () => {
        const out = document.getElementById('output').value;
        document.getElementById('preview-output').value = out;
        document.getElementById('preview-modal').classList.add('active');
    });

    document.getElementById('btn-close-modal').addEventListener('click', () => {
        document.getElementById('preview-modal').classList.remove('active');
    });

    document.getElementById('btn-copy-main').addEventListener('click', executeCopy);
    document.getElementById('btn-copy-modal').addEventListener('click', executeCopy);
});

function executeCopy() {
    const outputText = document.getElementById('output').value;
    if (!outputText) {
        showErrorToast("Execution Error: No data available to copy.");
        return;
    }
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(outputText)
            .then(() => showSuccessToast("Copied to clipboard!"))
            .catch(() => fallbackCopy(outputText));
    } else {
        fallbackCopy(outputText);
    }
}

function fallbackCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showSuccessToast("Copied to clipboard!");
    } catch (err) {
        showErrorToast("Failed to copy text.");
    }
    textArea.remove();
}

function renderNotes() {
    const notesList = document.getElementById('notes-list');
    if (!notesList) return;
    notesList.innerHTML = '';
    customNotesData.forEach((note, index) => {
        const row = document.createElement('div');
        row.className = 'note-row';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = note;
        input.placeholder = "Enter note detail...";
        input.style.flex = '1';
        input.addEventListener('input', (e) => {
            customNotesData[index] = e.target.value;
            saveCurrentSessionState();
        });
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.innerHTML = '✕';
        delBtn.className = 'btn-delete-scope';
        delBtn.title = "Delete note";
        delBtn.onclick = () => {
            customNotesData.splice(index, 1);
            renderNotes();
            saveCurrentSessionState();
        };
        row.appendChild(input);
        row.appendChild(delBtn);
        notesList.appendChild(row);
    });
}

function showToast(message, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    if (type !== 'loading') {
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) reverse forwards';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }
    return toast;
}

function showErrorToast(message) {
    showToast(message, 'error');
}

function showSuccessToast(message) {
    showToast(message, 'success');
}

function showLoadingToast(message) {
    if (currentLoadingToast) currentLoadingToast.remove();
    currentLoadingToast = showToast(message, 'loading');
}

function hideLoadingToast() {
    if (currentLoadingToast) {
        currentLoadingToast.remove();
        currentLoadingToast = null;
    }
}

function renderStatusGroup(containerId, mapVar) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (currentJiraStatuses.length === 0) {
        container.innerHTML = '<span class="helper">Click ↻ to fetch...</span>';
        return;
    }
    currentJiraStatuses.forEach((status) => {
        const wrap = document.createElement('div');
        const chkId = containerId + '-' + status.replace(/[^a-zA-Z0-9]/g, '-');
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'pill-checkbox';
        chk.id = chkId;
        chk.checked = !!mapVar[status];
        chk.addEventListener('change', () => {
            mapVar[status] = chk.checked;
            saveCurrentSessionState();
        });
        const lblText = document.createElement('label');
        lblText.className = 'pill-label';
        lblText.htmlFor = chkId;
        lblText.innerText = status;
        lblText.title = status;
        wrap.appendChild(chk);
        wrap.appendChild(lblText);
        container.appendChild(wrap);
    });
}

function renderJiraStatuses() {
    renderStatusGroup('status-b-container', checkedJiraStatusesMap_B);
    renderStatusGroup('status-unverified-container', checkedJiraStatusesMap_Unverified);
    renderStatusGroup('status-pending-container', checkedJiraStatusesMap_Pending);
}

function renderScopeCheckboxes() {
    const container = document.getElementById('scope-checkboxes-container');
    if (!container) return;
    container.innerHTML = '';
    currentScopesList.forEach((scope) => {
        const wrap = document.createElement('div');
        const safeId = 'scope-chk-' + scope.replace(/[^a-zA-Z0-9]/g, '-');
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'pill-checkbox';
        chk.id = safeId;
        chk.checked = checkedScopesMap[scope] === undefined ? true : !!checkedScopesMap[scope];
        chk.addEventListener('change', () => {
            checkedScopesMap[scope] = chk.checked;
            saveCurrentSessionState();
        });
        const lblText = document.createElement('label');
        lblText.className = 'pill-label';
        lblText.htmlFor = safeId;
        lblText.innerText = scope;
        if (!DEFAULT_SCOPES.includes(scope)) {
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn-delete-scope';
            delBtn.innerHTML = '✕';
            delBtn.title = "Delete Scope";
            delBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                currentScopesList = currentScopesList.filter(s => s !== scope);
                delete checkedScopesMap[scope];
                renderScopeCheckboxes();
                saveCurrentSessionState();
            };
            lblText.appendChild(delBtn);
        }
        wrap.appendChild(chk);
        wrap.appendChild(lblText);
        container.appendChild(wrap);
    });
}

function saveCurrentSessionState() {
    try {
        const currentConfig = getCurrentConfigObject();
        localStorage.setItem('last_session_state', JSON.stringify(currentConfig));
    } catch (e) {
        console.warn("Could not save session state:", e);
    }
}

document.getElementById('btn-generate').addEventListener('click', async () => {
    const outputTextarea = document.getElementById('output');
    document.getElementById('btn-preview').disabled = true;
    document.getElementById('btn-copy-main').disabled = true;
    if (!jiraAccessToken || !jiraCloudId) {
        initiateJiraSSO();
        return;
    }
    const sheetNameEl = document.getElementById('sheet-name');
    const qcNamesEl = document.getElementById('qc-names');
    const versionGameEl = document.getElementById('version-game');
    const versionAppEl = document.getElementById('version-app');
    const chkWebappEl = document.getElementById('chk-webapp');
    const chkApptekEl = document.getElementById('chk-apptek');
    const linkSharedEl = document.getElementById('link-shared');
    const projectKeyInput = sheetNameEl ? sheetNameEl.value.trim() : '';
    const qcNamesInput = qcNamesEl ? qcNamesEl.value.trim() : '';
    const versionGameInput = versionGameEl ? versionGameEl.value.trim() : '';
    const versionAppInput = versionAppEl ? versionAppEl.value.trim() : '';
    const isAppRequired = (chkWebappEl && chkWebappEl.checked) || (chkApptekEl && chkApptekEl.checked);
    const selectedScopes = currentScopesList.filter(scope => checkedScopesMap[scope]);
    const sharedInputValue = linkSharedEl ? linkSharedEl.value.trim() : '';
    let errors = [];
    if (!projectKeyInput) errors.push("Project Key");
    if (!qcNamesInput) errors.push("QC Team");
    if (!versionGameInput) errors.push("Game Version");
    if (isAppRequired && !versionAppInput) errors.push("App Version");
    if (selectedScopes.length === 0) errors.push("Scope of Testing (at least 1)");
    if (errors.length > 0) {
        showErrorToast("Missing required fields: " + errors.join(', '));
        return;
    }
    let finalGameId = projectKeyInput;
    const sheetTabEl = document.getElementById('sheet-tab-name');
    const rawSheetTabInput = sheetTabEl ? sheetTabEl.value.trim() : '';
    const actualSheetTabName = rawSheetTabInput || projectKeyInput;
    const urlInput = "https://docs.google.com/spreadsheets/d/1XF2bOLyXoVM3Py6qYBidSe1tcfOqMuuwg14wnLVf1lA/edit?gid=45247494#gid=45247494";
    outputTextarea.value = '';
    showLoadingToast('Authenticating with Google...');
    saveCurrentSessionState();
    let token = '';
    try {
        token = await getGoogleToken();
    } catch (authErr) {
        hideLoadingToast();
        showErrorToast("Google Login Failed: " + authErr.message);
        return;
    }
    showLoadingToast('Connecting to Google Sheets...');
    let finalReport = '';
    let sheetTagOrder = [];
    let autoTestcaseLink = '';
    let groups = {};
    try {
        const spreadsheetIdMatch = urlInput.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (!spreadsheetIdMatch) throw new Error("Invalid spreadsheet URL.");
        const spreadsheetId = spreadsheetIdMatch[1];
        const sheetApiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(actualSheetTabName)}'`;
        let sheetRes = await fetch(sheetApiUrl, { headers: { 'Authorization': 'Bearer ' + token } });
        if (sheetRes.status === 401) {
            token = await getGoogleToken(true);
            sheetRes = await fetch(sheetApiUrl, { headers: { 'Authorization': 'Bearer ' + token } });
        }
        if (!sheetRes.ok) {
            if (sheetRes.status === 403) throw new Error("Permission denied. Check sharing settings.");
            if (sheetRes.status === 400) throw new Error(`Tab '${actualSheetTabName}' not found.`);
            throw new Error(`Google Sheets API Error: ${sheetRes.statusText}`);
        }
        const sheetData = await sheetRes.json();
        const rows = sheetData.values || [];
        const a1ApiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges='${encodeURIComponent(actualSheetTabName)}'!A1&fields=sheets.data.rowData.values(hyperlink,formattedValue,textFormatRuns,chipRuns)`;
        const a1Res = await fetch(a1ApiUrl, { headers: { 'Authorization': 'Bearer ' + token } });
        if (a1Res.ok) {
            const a1Data = await a1Res.json();
            try {
                const cell = a1Data.sheets[0].data[0].rowData[0].values[0];
                let extractedLink = '';
                if (cell.hyperlink) extractedLink = cell.hyperlink;
                else if (cell.chipRuns && cell.chipRuns.length > 0) {
                    for (const run of cell.chipRuns) {
                        if (run.chip && run.chip.richLinkProperties && run.chip.richLinkProperties.uri) { extractedLink = run.chip.richLinkProperties.uri; break; }
                    }
                } else if (cell.textFormatRuns && cell.textFormatRuns.length > 0) {
                    for (const run of cell.textFormatRuns) {
                        if (run.format && run.format.link && run.format.link.uri) { extractedLink = run.format.link.uri; break; }
                    }
                }
                if (!extractedLink) extractedLink = cell.formattedValue || '';
                autoTestcaseLink = extractedLink.trim();
            } catch (e) {
                autoTestcaseLink = (rows.length > 0 && rows[0].length > 0) ? rows[0][0].toString().trim() : '';
            }
        } else {
            autoTestcaseLink = (rows.length > 0 && rows[0].length > 0) ? rows[0][0].toString().trim() : '';
        }
        if (autoTestcaseLink && autoTestcaseLink.includes("drive.google.com")) {
            showLoadingToast('Extracting ID Game...');
            const extractedId = await getGameIdFromDriveFolder(autoTestcaseLink, token);
            if (extractedId) finalGameId = extractedId;
        }
        let totalItems = 0;
        let doneHeaderPercent = '0%';
        let inProgressHeaderPercent = '0%';
        let remainingHeaderPercent = '0%';
        if (rows.length > 1) {
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                for (let j = 0; j < row.length; j++) {
                    const cellText = row[j] ? row[j].toString().trim().toLowerCase() : '';
                    if (cellText === '% done') {
                        let nextVal = row[j + 1] ? row[j + 1].toString().trim() : '';
                        if (nextVal && !nextVal.includes('%') && !isNaN(nextVal)) nextVal = ((parseFloat(nextVal) * 100).toFixed(2) + '%').replace('.00%', '%');
                        else if (nextVal) nextVal = nextVal.replace('.00%', '%');
                        doneHeaderPercent = nextVal || '0%';
                    } else if (cellText === '% in progress') {
                        let nextVal = row[j + 1] ? row[j + 1].toString().trim() : '';
                        if (nextVal && !nextVal.includes('%') && !isNaN(nextVal)) nextVal = ((parseFloat(nextVal) * 100).toFixed(2) + '%').replace('.00%', '%');
                        else if (nextVal) nextVal = nextVal.replace('.00%', '%');
                        inProgressHeaderPercent = nextVal || '0%';
                    } else if (cellText === '% remaining') {
                        let nextVal = row[j + 1] ? row[j + 1].toString().trim() : '';
                        if (nextVal && !nextVal.includes('%') && !isNaN(nextVal)) nextVal = ((parseFloat(nextVal) * 100).toFixed(2) + '%').replace('.00%', '%');
                        else if (nextVal) nextVal = nextVal.replace('.00%', '%');
                        remainingHeaderPercent = nextVal || '0%';
                    }
                }
                const colA = row[0] ? row[0].toString().trim() : '';
                const colB = row[1] ? row[1].toString().trim() : '';
                let colE = row[4] ? row[4].toString().trim() : '';
                const colG = row[6] ? row[6].toString().trim() : '';
                const colH = row[7] ? row[7].toString().trim() : '';
                if (colA && colB && colG) {
                    const cleanTag = colA.toUpperCase();
                    if (!sheetTagOrder.includes(cleanTag)) sheetTagOrder.push(cleanTag);
                    const statusKey = colG.toUpperCase();
                    if (colE && !colE.includes('%') && !isNaN(colE)) colE = ((parseFloat(colE) * 100).toFixed(2) + '%').replace('.00%', '%');
                    else if (!colE) colE = '0%';
                    else colE = colE.replace('.00%', '%');
                    let displayRemaining = colE;
                    if (statusKey === 'IN PROGRESS' && colH.toLowerCase().includes('failed')) displayRemaining = 'Failed';
                    if (!groups[statusKey]) groups[statusKey] = [];
                    groups[statusKey].push({ name: colA, remaining: displayRemaining, originalIndex: totalItems });
                    totalItems++;
                }
            }
            let allItems = [];
            const orderList = ['DONE', 'IN PROGRESS', 'REMAINING'];
            orderList.forEach(statusKey => {
                const groupItems = groups[statusKey] || [];
                groupItems.forEach(item => {
                    allItems.push({ ...item, statusKey: statusKey, displayValue: statusKey === 'DONE' ? 'Passed' : item.remaining });
                });
            });
            let normalizedItems = allItems.map(item => {
                let lower = item.name.toLowerCase();
                let finalName = item.name;
                let prefix = "";
                if (lower.includes("common behaviour")) prefix = "Common Behaviour";
                else if (lower.includes("compatibility")) prefix = "Compatibility";
                else if (lower.includes("interruption")) prefix = "Interruption";
                else if (lower.includes("uat")) prefix = "UAT";
                if (prefix && prefix !== "UAT") {
                    let type = lower.includes("webapp") ? "Webapp" : (lower.includes("iframe") ? "Iframe" : "App");
                    let os = lower.includes("ios") ? "iOS" : (lower.includes("android") ? "Android" : (lower.includes("pc") ? "PC" : ""));
                    let browser = lower.includes("safari") ? "Safari" : (lower.includes("chrome") ? "Chrome" : "");
                    if (prefix === "Interruption" && !lower.includes("app")) type = "Iframe";
                    if (prefix === "Compatibility" && !lower.includes("app")) type = "Iframe";
                    if (lower.includes("pc")) type = "Iframe";
                    if (type === "Iframe" && os === "Android" && !browser) browser = "Chrome";
                    if (type === "Webapp" && os === "Android" && !browser) browser = "Chrome";
                    if (os) {
                        if (browser) finalName = prefix + " " + type + " on " + os + " " + browser;
                        else finalName = prefix + " " + type + " on " + os;
                    }
                } else if (prefix === "UAT") {
                    if (lower.includes("iframe")) finalName = "UAT Iframe";
                    else if (lower.includes("app") && !lower.includes("webapp")) finalName = "UAT App";
                    else finalName = "UAT";
                }
                return { ...item, name: finalName };
            });
            const valueGroups = {};
            normalizedItems.forEach(item => {
                if (!valueGroups[item.displayValue]) valueGroups[item.displayValue] = [];
                valueGroups[item.displayValue].push(item);
            });
            let globalMergedLines = [];
            const prefixes = ['Common Behaviour', 'Compatibility', 'Interruption', 'UAT'];
            for (const val in valueGroups) {
                let subGroupItems = [...valueGroups[val]];
                prefixes.forEach(prefix => {
                    let currentPrefixItems = subGroupItems.filter(item => item.name.toLowerCase().startsWith(prefix.toLowerCase()));
                    subGroupItems = subGroupItems.filter(item => !currentPrefixItems.includes(item));
                    if (currentPrefixItems.length <= 1) {
                        subGroupItems = subGroupItems.concat(currentPrefixItems);
                        return;
                    }
                    if (prefix === "UAT") {
                        let hasIframe = currentPrefixItems.find(i => i.name === "UAT Iframe");
                        let hasApp = currentPrefixItems.find(i => i.name === "UAT App");
                        let otherUATs = currentPrefixItems.filter(i => i.name !== "UAT Iframe" && i.name !== "UAT App");
                        if (hasIframe && hasApp) {
                            let minIndex = Math.min(hasIframe.originalIndex, hasApp.originalIndex);
                            subGroupItems.push({ name: "UAT Iframe/App", isMergedString: true, mergedVal: val, originalIndex: minIndex, statusKey: hasIframe.statusKey });
                        } else {
                            if (hasIframe) subGroupItems.push(hasIframe);
                            if (hasApp) subGroupItems.push(hasApp);
                        }
                        otherUATs.forEach(u => subGroupItems.push(u));
                        return;
                    }
                    let parsedItems = currentPrefixItems.map(item => {
                        let remainder = item.name.slice(prefix.length).trim();
                        let words = remainder.split(' ');
                        let type = words[0];
                        let combo = words.slice(1).join(' ');
                        return { item, type, combo };
                    });
                    let typesMap = {};
                    parsedItems.forEach(p => {
                        if (!typesMap[p.type]) typesMap[p.type] = [];
                        typesMap[p.type].push(p);
                    });
                    let stage1Items = [];
                    for (let type in typesMap) {
                        let pList = typesMap[type];
                        let combos = pList.map(p => p.combo);
                        let mergedName = "";
                        let itemsToMerge = [];
                        if (prefix === "Common Behaviour") {
                            if (type === "Webapp") {
                                if (combos.includes("on Android Chrome") && combos.includes("on iOS Chrome") && combos.includes("on iOS Safari")) {
                                    mergedName = "Common Behaviour Webapp";
                                    itemsToMerge = pList.filter(p => ["on Android Chrome", "on iOS Chrome", "on iOS Safari"].includes(p.combo)).map(p => p.item);
                                } else if (combos.includes("on iOS Chrome") && combos.includes("on iOS Safari")) {
                                    mergedName = "Common Behaviour Webapp on iOS";
                                    itemsToMerge = pList.filter(p => ["on iOS Chrome", "on iOS Safari"].includes(p.combo)).map(p => p.item);
                                }
                            } else if (type === "App") {
                                if (combos.includes("on Android") && combos.includes("on iOS")) {
                                    mergedName = "Common Behaviour App";
                                    itemsToMerge = pList.filter(p => ["on Android", "on iOS"].includes(p.combo)).map(p => p.item);
                                }
                            }
                        } else if (prefix === "Compatibility") {
                            if (type === "Iframe") {
                                if (combos.includes("on iOS Safari") && combos.includes("on iOS Chrome") && combos.includes("on Android Chrome")) {
                                    mergedName = "Compatibility Iframe";
                                    itemsToMerge = pList.filter(p => ["on iOS Safari", "on iOS Chrome", "on Android Chrome"].includes(p.combo)).map(p => p.item);
                                } else if (combos.includes("on iOS Safari") && combos.includes("on iOS Chrome")) {
                                    mergedName = "Compatibility Iframe on iOS";
                                    itemsToMerge = pList.filter(p => ["on iOS Safari", "on iOS Chrome"].includes(p.combo)).map(p => p.item);
                                }
                            } else if (type === "App") {
                                if (combos.includes("on iOS") && combos.includes("on Android")) {
                                    mergedName = "Compatibility App";
                                    itemsToMerge = pList.filter(p => ["on iOS", "on Android"].includes(p.combo)).map(p => p.item);
                                }
                            }
                        } else if (prefix === "Interruption") {
                            if (type === "Iframe") {
                                if (combos.includes("on PC") && combos.includes("on iOS Safari") && combos.includes("on iOS Chrome") && combos.includes("on Android Chrome")) {
                                    mergedName = "Interruption Iframe";
                                    itemsToMerge = pList.filter(p => ["on PC", "on iOS Safari", "on iOS Chrome", "on Android Chrome"].includes(p.combo)).map(p => p.item);
                                } else if (combos.includes("on iOS Safari") && combos.includes("on iOS Chrome") && combos.includes("on Android Chrome")) {
                                    mergedName = "Interruption Iframe on iOS/Android";
                                    itemsToMerge = pList.filter(p => ["on iOS Safari", "on iOS Chrome", "on Android Chrome"].includes(p.combo)).map(p => p.item);
                                } else if (combos.includes("on PC") && combos.includes("on iOS Safari") && combos.includes("on iOS Chrome")) {
                                    mergedName = "Interruption Iframe on PC/iOS";
                                    itemsToMerge = pList.filter(p => ["on PC", "on iOS Safari", "on iOS Chrome"].includes(p.combo)).map(p => p.item);
                                } else if (combos.includes("on iOS Safari") && combos.includes("on iOS Chrome")) {
                                    mergedName = "Interruption Iframe on iOS";
                                    itemsToMerge = pList.filter(p => ["on iOS Safari", "on iOS Chrome"].includes(p.combo)).map(p => p.item);
                                }
                            } else if (type === "App") {
                                if (combos.includes("on iOS") && combos.includes("on Android")) {
                                    mergedName = "Interruption App";
                                    itemsToMerge = pList.filter(p => ["on iOS", "on Android"].includes(p.combo)).map(p => p.item);
                                }
                            }
                        }
                        if (mergedName && itemsToMerge.length > 0) {
                            let minIndex = Math.min(...itemsToMerge.map(i => i.originalIndex || 9999));
                            stage1Items.push({ name: mergedName, isMergedString: true, mergedVal: val, originalIndex: minIndex, statusKey: itemsToMerge[0].statusKey });
                            stage1Items = stage1Items.concat(pList.filter(p => !itemsToMerge.includes(p.item)).map(p => p.item));
                        } else {
                            stage1Items = stage1Items.concat(pList.map(p => p.item));
                        }
                    }
                    if (prefix === "Common Behaviour") {
                        let wItem = stage1Items.find(i => i.name === "Common Behaviour Webapp");
                        let aItem = stage1Items.find(i => i.name === "Common Behaviour App");
                        if (wItem && aItem) {
                            stage1Items = stage1Items.filter(i => i !== wItem && i !== aItem);
                            stage1Items.push({ name: "Common Behaviour Webapp/App", isMergedString: true, mergedVal: val, originalIndex: Math.min(wItem.originalIndex, aItem.originalIndex), statusKey: wItem.statusKey });
                        }
                    } else if (prefix === "Compatibility") {
                        let iItem = stage1Items.find(i => i.name === "Compatibility Iframe");
                        let aItem = stage1Items.find(i => i.name === "Compatibility App");
                        if (iItem && aItem) {
                            stage1Items = stage1Items.filter(i => i !== iItem && i !== aItem);
                            stage1Items.push({ name: "Compatibility Iframe/App", isMergedString: true, mergedVal: val, originalIndex: Math.min(iItem.originalIndex, aItem.originalIndex), statusKey: iItem.statusKey });
                        }
                    } else if (prefix === "Interruption") {
                        let iItem = stage1Items.find(i => i.name === "Interruption Iframe");
                        let aItem = stage1Items.find(i => i.name === "Interruption App");
                        if (iItem && aItem) {
                            stage1Items = stage1Items.filter(i => i !== iItem && i !== aItem);
                            stage1Items.push({ name: "Interruption Iframe/App", isMergedString: true, mergedVal: val, originalIndex: Math.min(iItem.originalIndex, aItem.originalIndex), statusKey: iItem.statusKey });
                        }
                    }
                    subGroupItems = subGroupItems.concat(stage1Items);
                });
                subGroupItems.forEach(item => {
                    let lineText = item.isMergedString ? `  + ${item.name}: ${item.mergedVal}\n` : `  + ${item.name}: ${item.statusKey === 'DONE' ? 'Passed' : item.remaining}\n`;
                    globalMergedLines.push({ text: lineText, index: item.originalIndex || 9999, statusKey: item.statusKey });
                });
            }
            ['DONE', 'IN PROGRESS', 'REMAINING'].forEach(statusKey => {
                let groupPercent = statusKey === 'DONE' ? doneHeaderPercent : (statusKey === 'IN PROGRESS' ? inProgressHeaderPercent : remainingHeaderPercent);
                if (groupPercent !== '0.00%' && groupPercent !== '0%' && groupPercent !== '0.0%' && parseFloat(groupPercent) !== 0) {
                    finalReport += `- ${statusKey}: ${groupPercent}\n`;
                    let linesForSection = globalMergedLines.filter(l => l.statusKey === statusKey).sort((a, b) => a.index - b.index);
                    linesForSection.forEach(l => { finalReport += l.text; });
                }
            });
        }
    } catch (error) {
        hideLoadingToast();
        showErrorToast("Google Sheets Error: " + error.message);
        return;
    }
    showLoadingToast('Scanning Jira data...');
    let jiraReportSegment = '';
    let detectedBoardName = '';
    let autoJiraLink = '';
    let unverifiedCount = 0;
    let pendingCount = 0;
    let unverifiedStatusesFound = new Set();
    let pendingStatusesFound = new Set();
    try {
        let targetName = projectKeyInput;
        let realKey = projectKeyInput;
        let boardId = '';

        // 1. Lấy thông tin chính xác của Project (Project Name & Real Project Key)[cite: 5]
        try {
            const pRes = await fetch(`https://api.atlassian.com/ex/jira/${jiraCloudId}/rest/api/2/project/${projectKeyInput}`, { headers: { 'Authorization': 'Bearer ' + jiraAccessToken, 'Accept': 'application/json' } });
            if (pRes.ok) {
                const pData = await pRes.json();
                if (pData && pData.name) targetName = pData.name; //[cite: 5]
                if (pData && pData.key) realKey = pData.key; //[cite: 5]
            }
        } catch (e) { }

        // 2. Lấy Board ID theo mã dự án chuẩn (projectKeyOrId)[cite: 5]
        try {
            let bRes = await fetch(`https://api.atlassian.com/ex/jira/${jiraCloudId}/rest/agile/1.0/board?projectKeyOrId=${realKey}`, { headers: { 'Authorization': 'Bearer ' + jiraAccessToken, 'Accept': 'application/json' } }); //[cite: 5]
            if (bRes.ok) {
                const bData = await bRes.json();
                if (bData && bData.values && bData.values.length > 0) boardId = bData.values[0].id; //[cite: 5]
            }

            // Nếu tìm theo key không ra (với một số dự án team-managed), quét bổ sung theo tên Project
            if (!boardId && targetName) {
                let bRes2 = await fetch(`https://api.atlassian.com/ex/jira/${jiraCloudId}/rest/agile/1.0/board?name=${encodeURIComponent(targetName)}`, { headers: { 'Authorization': 'Bearer ' + jiraAccessToken, 'Accept': 'application/json' } });
                if (bRes2.ok) {
                    const bData2 = await bRes2.json();
                    if (bData2 && bData2.values && bData2.values.length > 0) boardId = bData2.values[0].id;
                }
            }
        } catch (e) { }

        const jqlString = `project = "${projectKeyInput}" AND issuetype in (Bug, Improvement, Question) ORDER BY created DESC`;
        const issueMap = new Map();
        let jHasMore = true;
        let currentToken = null;
        while (jHasMore) {
            const payload = { jql: jqlString, maxResults: 100, fields: ["summary", "status", "issuetype", "priority"] };
            if (currentToken) payload.nextPageToken = currentToken;
            const res = await fetch(`https://api.atlassian.com/ex/jira/${jiraCloudId}/rest/api/3/search/jql`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + jiraAccessToken, 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(`JQL Fetch failed`);
            const d = await res.json();
            const items = d.issues || d.values || [];
            items.forEach(iss => { if (iss && iss.key) issueMap.set(iss.key, iss); });
            if (d.nextPageToken && items.length > 0) currentToken = d.nextPageToken;
            else jHasMore = false;
        }
        const jiraIssues = Array.from(issueMap.values());
        detectedBoardName = targetName;

        // 3. Xây dựng link chuẩn: Có boardId dùng link Bảng, không có boardId chuyển về trang /issues[cite: 5]
        autoJiraLink = boardId
            ? `https://enotion.atlassian.net/jira/software/projects/${realKey}/boards/${boardId}` //[cite: 5]
            : `https://enotion.atlassian.net/jira/software/projects/${realKey}/issues`;

        const typeContainers = { 'BUG': {}, 'IMPROVEMENT': {}, 'QUESTION': {} };
        let totalBoardTickets = 0;
        let buildStatusCount = 0;
        let bugCount = 0, impCount = 0, queCount = 0;
        let bugPriorityMap = {};
        jiraIssues.forEach(issue => {
            let statusName = (issue.fields.status && issue.fields.status.name) ? issue.fields.status.name.toUpperCase().trim() : '';
            if (checkedJiraStatusesMap_Unverified[statusName]) { unverifiedCount++; unverifiedStatusesFound.add(statusName); }
            if (checkedJiraStatusesMap_Pending[statusName]) { pendingCount++; pendingStatusesFound.add(statusName); }
            const issueTypeName = (issue.fields.issuetype && issue.fields.issuetype.name) ? issue.fields.issuetype.name.toUpperCase().trim() : '';
            totalBoardTickets++;
            if (typeContainers[issueTypeName] === undefined) return;
            let isValidStatus = false;
            if (currentJiraStatuses.length > 0) {
                if (checkedJiraStatusesMap_B[statusName]) isValidStatus = true;
            } else {
                const statusClean = statusName.replace(/[^A-Z0-9]/g, '');
                if (['TODO', 'INPROGRESS', 'FIXEDDONE', 'FIXDONE'].includes(statusClean)) isValidStatus = true;
            }
            if (isValidStatus) {
                buildStatusCount++;
                let pName = (issue.fields.priority && issue.fields.priority.name) ? issue.fields.priority.name.trim() : 'Unknown';
                pName = pName.charAt(0).toUpperCase() + pName.slice(1).toLowerCase();
                if (issueTypeName === 'BUG') {
                    bugCount++;
                    if (!bugPriorityMap[pName]) bugPriorityMap[pName] = 0;
                    bugPriorityMap[pName]++;
                } else if (issueTypeName === 'IMPROVEMENT') impCount++;
                else if (issueTypeName === 'QUESTION') queCount++;
                const summary = issue.fields.summary || '';
                const bracketMatch = summary.match(/\[([^\]]+)\]/);
                const tag = bracketMatch ? bracketMatch[1].trim().toUpperCase() : 'OTHERS';
                if (!typeContainers[issueTypeName][tag]) typeContainers[issueTypeName][tag] = {};
                if (!typeContainers[issueTypeName][tag][pName]) typeContainers[issueTypeName][tag][pName] = [];
                typeContainers[issueTypeName][tag][pName].push({ key: issue.key, summary: summary.replace(/\[[^\]]+\]/, '').trim() });
            }
        });
        let buildStatusParts = [];
        if (bugCount > 0) {
            PRIORITY_ORDER.forEach(pr => { if (bugPriorityMap[pr]) buildStatusParts.push(pr + ": " + bugPriorityMap[pr]); });
            for (const pr in bugPriorityMap) { if (!PRIORITY_ORDER.includes(pr)) buildStatusParts.push(pr + ": " + bugPriorityMap[pr]); }
        }
        if (impCount > 0) buildStatusParts.push(`Improvement: ${impCount}`);
        if (queCount > 0) buildStatusParts.push(`Question: ${queCount}`);
        let buildStatusStr = buildStatusCount + " tickets" + (buildStatusParts.length > 0 ? " (" + buildStatusParts.join(', ') + ")" : "");
        let scopeText = selectedScopes.join(', ') || 'Logic UI, Interruption, Promotion, Sound, UI, Tutorial/Trial, Compatibility';
        let summarySection = `——————————————————\nA. [SUMMARY]\n- Scope of testing: ${scopeText}.\n- Testing Status: In-testing\n- Build status: ${buildStatusStr} / Total: ${totalBoardTickets} tickets\n`;
        finalReport = summarySection + finalReport;
        const romanize = (num) => {
            const lookup = { M: 1000, CM: 900, d: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
            let roman = '';
            for (let i in lookup) { while (num >= lookup[i]) { roman += i; num -= lookup[i]; } }
            return roman;
        };
        let jiraBody = '';
        let sectionIndex = 1;
        ['BUG', 'IMPROVEMENT', 'QUESTION'].forEach(typeKey => {
            if (typeKey === 'BUG') {
                const tags = Object.keys(typeContainers['BUG']);
                if (tags.length > 0) {
                    tags.sort((a, b) => {
                        let lowerScopes = currentScopesList.map(s => s.toLowerCase());
                        let iA = lowerScopes.indexOf(a.toLowerCase()), iB = lowerScopes.indexOf(b.toLowerCase());
                        return (iA === -1 ? 9999 : iA) - (iB === -1 ? 9999 : iB);
                    });
                    tags.forEach(tag => {
                        jiraBody += `${romanize(sectionIndex)}. [${tag}]\n`;
                        let totalInTag = Object.values(typeContainers['BUG'][tag]).reduce((acc, arr) => acc + arr.length, 0);
                        const printPriority = (priority) => {
                            if (typeContainers['BUG'][tag][priority]) {
                                const tickets = typeContainers['BUG'][tag][priority];
                                jiraBody += `- ${priority}: ${tickets.length}\n`;
                                if (totalInTag === 1 && (priority === 'High' || priority === 'Highest')) {
                                    tickets.forEach(t => { jiraBody += `  + Ticket ${t.key}: ${t.summary}\n`; });
                                }
                            }
                        };
                        PRIORITY_ORDER.forEach(printPriority);
                        for (const pr in typeContainers['BUG'][tag]) { if (!PRIORITY_ORDER.includes(pr)) printPriority(pr); }
                        jiraBody += "——————————————————\n";
                        sectionIndex++;
                    });
                }
            } else {
                let hasTickets = false;
                const priorityMapForType = {};
                let totalInType = 0;
                for (const tag in typeContainers[typeKey]) {
                    for (const priority in typeContainers[typeKey][tag]) {
                        const tix = typeContainers[typeKey][tag][priority];
                        if (tix.length > 0) {
                            hasTickets = true;
                            if (!priorityMapForType[priority]) priorityMapForType[priority] = [];
                            priorityMapForType[priority] = priorityMapForType[priority].concat(tix);
                            totalInType += tix.length;
                        }
                    }
                }
                if (hasTickets) {
                    jiraBody += `${romanize(sectionIndex)}. [${typeKey}]\n`;
                    const printPriority = (priority) => {
                        if (priorityMapForType[priority]) {
                            const tickets = priorityMapForType[priority];
                            jiraBody += `- ${priority}: ${tickets.length}\n`;
                            if (totalInType === 1) { tickets.forEach(t => { jiraBody += `  + Ticket ${t.key}: ${t.summary}\n`; }); }
                        }
                    };
                    PRIORITY_ORDER.forEach(printPriority);
                    for (const pr in priorityMapForType) { if (!PRIORITY_ORDER.includes(pr)) printPriority(pr); }
                    jiraBody += "——————————————————\n";
                    sectionIndex++;
                }
            }
        });
        if (jiraBody.trim().length > 0) jiraReportSegment = "B. [TICKETS]\n" + jiraBody;
    } catch (error) {
        hideLoadingToast();
        showErrorToast("Jira Error: " + error.message);
        return;
    }
    const now = new Date();
    const currentDateStr = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth() + 1).padStart(2, '0') + '/' + now.getFullYear();
    const formatDate = (dateVal, fallback) => {
        const parts = dateVal ? dateVal.split('-') : [];
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : fallback;
    };
    const inputReportDate = formatDate(document.getElementById('date-report').value, currentDateStr);
    let baseBoardName = (detectedBoardName || projectKeyInput).replace(/^\[.*?\]\s*/, '').replace(/\s*-\s*/g, ' - ').trim();
    let customHeader = `Report for ${baseBoardName} (${inputReportDate})\n`;
    if (versionGameInput) {
        const vGame = versionGameInput.split('/').map(v => v.trim().toLowerCase().startsWith('v') ? v.trim() : 'v' + v.trim()).join('/');
        customHeader += `Version game: ${vGame} (${formatDate(document.getElementById('date-game').value, currentDateStr)})\n`;
    }
    if (chkApptekEl && chkApptekEl.checked && versionAppInput) {
        const vApp = versionAppInput.split('/').map(v => v.trim().toLowerCase().startsWith('v') ? v.trim() : 'v' + v.trim()).join('/');
        customHeader += `Version App: ${vApp} (${formatDate(document.getElementById('date-app').value, currentDateStr)})\n`;
    }
    let envParts = ["Iframe"];
    if (chkWebappEl && chkWebappEl.checked) envParts.push("Webapp");
    if (chkApptekEl && chkApptekEl.checked) envParts.push("App");
    customHeader += `Env: ${envParts.join('/')} - Internal Staging\n`;
    let linksCollected = [`- Iframe: https://iframe-tektale.staging.enostd.gay/en/kts${finalGameId}/?token=xxx&c=USD&ru=https://internal-portal.enostd.gay/`];
    if (chkWebappEl && chkWebappEl.checked) {
        let webappVal = sharedInputValue;
        linksCollected.push("- Webapp: " + (webappVal && !isNaN(webappVal) ? `https://webapp${webappVal}tek.enostd.gay/` : webappVal));
    }
    if (chkApptekEl && chkApptekEl.checked) {
        let appLinkVal = sharedInputValue;
        linksCollected.push("- App: " + (appLinkVal && !isNaN(appLinkVal) ? `TektaleC${appLinkVal}` : (appLinkVal || "")));
    }
    linksCollected.push("- Jira: " + autoJiraLink);
    linksCollected.push("- Testcase: " + (autoTestcaseLink || "No link found in cell A1"));
    if (linksCollected.length > 0) customHeader += "Link:\n" + linksCollected.join('\n') + "\n";
    let notesSegment = "C. [NOTES]\n";
    const chkCustomNote = document.getElementById('chk-custom-note');
    if (chkCustomNote && chkCustomNote.checked && customNotesData.some(n => n.trim() !== "")) {
        customNotesData.forEach(line => {
            let trimmed = line.trim();
            if (trimmed) notesSegment += (trimmed.startsWith('-') ? trimmed : `- ${trimmed}`) + "\n";
        });
    }
    if (unverifiedCount > 0) {
        const arr = Array.from(unverifiedStatusesFound);
        notesSegment += `- There are ${unverifiedCount} unverified tickets in the ${arr.length > 1 ? arr.join(' and ') : arr[0]} columns\n`;
    }
    if (pendingCount > 0) {
        const arr = Array.from(pendingStatusesFound);
        notesSegment += `- There are ${pendingCount} tickets in the ${arr.length > 1 ? arr.join(' and ') : arr[0]} columns\n`;
    }
    notesSegment += `- QC: ${qcNamesInput || 'Victor, Anna, Khanh, Hien, ChinSu, Thea, Atomic'}\n`;
    let finalOutputString = customHeader + finalReport + "——————————————————\n";
    if (jiraReportSegment.trim().length > 0) finalOutputString += jiraReportSegment.replace(/(?:——————————————————\n)$/, "") + "——————————————————\n";
    finalOutputString += notesSegment;
    outputTextarea.value = finalOutputString.trim().replace(/\.00%/g, '%');
    hideLoadingToast();
    showSuccessToast("Report compiled successfully.");
    document.getElementById('btn-preview').disabled = false;
    document.getElementById('btn-copy-main').disabled = false;
});

async function loadLastSession() {
    return new Promise((resolve) => {
        const savedData = localStorage.getItem('last_session_state');
        if (savedData) {
            try { populateFields(JSON.parse(savedData)); } catch (e) { }
        } else {
            currentScopesList = [...DEFAULT_SCOPES];
            checkedScopesMap = {};
            DEFAULT_SCOPES.forEach(s => { checkedScopesMap[s] = true; });
            renderScopeCheckboxes();
            renderJiraStatuses();
        }
        resolve();
    });
}

function getCurrentConfigObject() {
    return {
        sheetName: document.getElementById('sheet-name')?.value || '',
        sheetTabName: document.getElementById('sheet-tab-name')?.value || '',
        dateReport: document.getElementById('date-report')?.value || '',
        versionGame: document.getElementById('version-game')?.value || '',
        dateGame: document.getElementById('date-game')?.value || '',
        versionApp: document.getElementById('version-app')?.value || '',
        dateApp: document.getElementById('date-app')?.value || '',
        qcNames: document.getElementById('qc-names')?.value || '',
        chkCustomNote: document.getElementById('chk-custom-note')?.checked || false,
        customNotes: customNotesData,
        chkWebapp: document.getElementById('chk-webapp')?.checked || false,
        chkApptek: document.getElementById('chk-apptek')?.checked || false,
        linkShared: document.getElementById('link-shared')?.value || '',
        scopesList: currentScopesList,
        checkedScopes: checkedScopesMap,
        jiraStatusesList: currentJiraStatuses,
        checkedJiraStatuses_B: checkedJiraStatusesMap_B,
        checkedJiraStatuses_Unverified: checkedJiraStatusesMap_Unverified,
        checkedJiraStatuses_Pending: checkedJiraStatusesMap_Pending
    };
}

function populateFields(state) {
    if (!state) return;
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    const setChk = (id, checked) => { const el = document.getElementById(id); if (el) el.checked = !!checked; };
    setVal('sheet-name', state.sheetName);
    setVal('sheet-tab-name', state.sheetTabName);
    setVal('date-report', state.dateReport);
    setVal('version-game', state.versionGame);
    setVal('date-game', state.dateGame);
    setVal('version-app', state.versionApp);
    setVal('date-app', state.dateApp);
    setVal('qc-names', state.qcNames);
    setChk('chk-custom-note', state.chkCustomNote);
    customNotesData = Array.isArray(state.customNotes) ? state.customNotes : [];
    const notesWrapper = document.getElementById('notes-wrapper');
    if (state.chkCustomNote) { notesWrapper.style.display = 'flex'; renderNotes(); }
    else notesWrapper.style.display = 'none';
    setChk('chk-webapp', state.chkWebapp);
    setChk('chk-apptek', state.chkApptek);
    setVal('link-shared', state.linkShared);
    currentScopesList = Array.isArray(state.scopesList) ? state.scopesList : [...DEFAULT_SCOPES];
    checkedScopesMap = state.checkedScopes || {};
    if (!state.checkedScopes) currentScopesList.forEach(s => checkedScopesMap[s] = true);
    currentJiraStatuses = Array.isArray(state.jiraStatusesList) ? state.jiraStatusesList : [];
    checkedJiraStatusesMap_B = state.checkedJiraStatuses_B || {};
    checkedJiraStatusesMap_Unverified = state.checkedJiraStatuses_Unverified || {};
    checkedJiraStatusesMap_Pending = state.checkedJiraStatuses_Pending || {};
    renderScopeCheckboxes();
    renderJiraStatuses();
    toggleAppVersionRequirement();
}