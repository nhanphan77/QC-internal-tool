import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const GOOGLE_CLIENT_ID = "149310433677-4qv9hp52p00s4csq1eb1trj23nsiu945.apps.googleusercontent.com";
const ATLASSIAN_CLIENT_ID = "OULWq49W7enCX1cVWMFtRTlj2axvx0Ge";

const DEFAULT_SCOPES = [
    "Logic", "Logic UI", "UI", "Interruption", "Sound",
    "Tutorial/Trial", "Data", " promotion", "Common Behaviour",
    "Compatibility", "UAT", "Regression Test", "Check Feedback",
    "Crosscheck", "BetfailBan&Maintainance"
];

const PRIORITY_ORDER = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

export default function App() {
    const [jiraToken, setJiraToken] = useState(() => localStorage.getItem('jira_access_token') || null);
    const [jiraRefreshToken, setJiraRefreshToken] = useState(() => localStorage.getItem('jira_refresh_token') || null);
    const [jiraCloudId, setJiraCloudId] = useState(() => localStorage.getItem('jira_cloud_id') || null);
    const [googleToken, setGoogleToken] = useState(() => localStorage.getItem('google_access_token') || null);

    const [sheetName, setSheetName] = useState('');
    const [sheetTabName, setSheetTabName] = useState('');
    const [dateReport, setDateReport] = useState('');
    const [qcNames, setQcNames] = useState('');

    const [versionGame, setVersionGame] = useState('');
    const [dateGame, setDateGame] = useState('');
    const [versionApp, setVersionApp] = useState('');
    const [dateApp, setDateApp] = useState('');

    const [chkWebapp, setChkWebapp] = useState(false);
    const [chkApptek, setChkApptek] = useState(false);
    const [chkCustomNote, setChkCustomNote] = useState(false);
    const [linkShared, setLinkShared] = useState('');

    const [customNotesData, setCustomNotesData] = useState([]);
    const [customIframesData, setCustomIframesData] = useState([]);
    const [gameLinksData, setGameLinksData] = useState([]);
    const [scopesList, setScopesList] = useState([...DEFAULT_SCOPES]);
    const [checkedScopesMap, setCheckedScopesMap] = useState({});
    const [newScopeInput, setNewScopeInput] = useState('');

    const [jiraStatuses, setJiraStatuses] = useState([]);
    const [checkedJiraB, setCheckedJiraB] = useState({});
    const [checkedJiraUnverified, setCheckedJiraUnverified] = useState({});
    const [checkedJiraPending, setCheckedJiraPending] = useState({});

    const [jiraParents, setJiraParents] = useState([]);
    const [jiraSprints, setJiraSprints] = useState([]);
    const [selectedParent, setSelectedParent] = useState('All');
    const [selectedSprint, setSelectedSprint] = useState('All');

    const [outputReport, setOutputReport] = useState('');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isAccordionOpen, setIsAccordionOpen] = useState(true);
    const [toasts, setToasts] = useState([]);

    const [formErrors, setFormErrors] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const projectKeyRef = useRef(null);
    const qcTeamRef = useRef(null);
    const gameVersionRef = useRef(null);
    const appVersionRef = useRef(null);

    const syncTimeoutRef = useRef(null);

    const showToast = (message, type) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev.filter(t => t.type !== 'loading'), { id, message, type }]);
        if (type !== 'loading') {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 5000);
        }
    };

    const hideLoadingToast = () => {
        setToasts(prev => prev.filter(t => t.type !== 'loading'));
    };

    const handleJiraDisconnect = () => {
        localStorage.removeItem('jira_access_token');
        localStorage.removeItem('jira_refresh_token');
        localStorage.removeItem('jira_cloud_id');
        setJiraToken(null);
        setJiraRefreshToken(null);
        setJiraCloudId(null);
        showToast("Disconnected Jira.", 'success');
    };

    const refreshJiraToken = async () => {
        const storedRefreshToken = localStorage.getItem('jira_refresh_token');
        if (!storedRefreshToken) throw new Error("No refresh token available");
        const res = await fetch('/api/jira-refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: storedRefreshToken })
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Failed to refresh token');
        setJiraToken(data.access_token);
        setJiraRefreshToken(data.refresh_token);
        localStorage.setItem('jira_access_token', data.access_token);
        localStorage.setItem('jira_refresh_token', data.refresh_token);
        return data.access_token;
    };

    const fetchWithJiraAuth = async (url, options = {}) => {
        let currentToken = localStorage.getItem('jira_access_token');
        let res = await fetch(url, {
            ...options,
            headers: { ...options.headers, 'Authorization': 'Bearer ' + currentToken }
        });
        if (res.status === 401) {
            try {
                currentToken = await refreshJiraToken();
                res = await fetch(url, {
                    ...options,
                    headers: { ...options.headers, 'Authorization': 'Bearer ' + currentToken }
                });
            } catch (err) {
                handleJiraDisconnect();
                throw new Error("Jira session expired. Please Connect SSO again.");
            }
        }
        return res;
    };

    useEffect(() => {
        const savedData = localStorage.getItem('last_session_state');
        if (savedData) {
            try {
                const state = JSON.parse(savedData);
                if (state.sheetName) setSheetName(state.sheetName);
                if (state.sheetTabName) setSheetTabName(state.sheetTabName);
                if (state.dateReport) setDateReport(state.dateReport);
                if (state.versionGame) setVersionGame(state.versionGame);
                if (state.dateGame) setDateGame(state.dateGame);
                if (state.versionApp) setVersionApp(state.versionApp);
                if (state.dateApp) setDateApp(state.dateApp);
                if (state.qcNames) setQcNames(state.qcNames);
                if (state.chkCustomNote !== undefined) setChkCustomNote(state.chkCustomNote);
                if (Array.isArray(state.customNotes)) setCustomNotesData(state.customNotes);
                if (Array.isArray(state.customIframesData)) setCustomIframesData(state.customIframesData);
                if (Array.isArray(state.gameLinksData)) setGameLinksData(state.gameLinksData);
                if (state.chkWebapp) setChkWebapp(state.chkWebapp);
                if (state.chkApptek) setChkApptek(state.chkApptek);
                if (state.linkShared) setLinkShared(state.linkShared);
                if (Array.isArray(state.scopesList)) setScopesList(state.scopesList);
                if (state.checkedScopes) setCheckedScopesMap(state.checkedScopes);
                if (Array.isArray(state.jiraStatusesList)) setJiraStatuses(state.jiraStatusesList);
                if (state.checkedJiraStatuses_B) setCheckedJiraB(state.checkedJiraStatuses_B);
                if (state.checkedJiraStatuses_Unverified) setCheckedJiraUnverified(state.checkedJiraStatuses_Unverified);
                if (state.checkedJiraStatuses_Pending) setCheckedJiraPending(state.checkedJiraStatuses_Pending);
                if (Array.isArray(state.jiraParents)) setJiraParents(state.jiraParents);
                if (Array.isArray(state.jiraSprints)) setJiraSprints(state.jiraSprints);
                if (state.selectedParent) setSelectedParent(state.selectedParent);
                if (state.selectedSprint) setSelectedSprint(state.selectedSprint);
            } catch (e) { }
        } else {
            const initMap = {};
            DEFAULT_SCOPES.forEach(s => { initMap[s] = true; });
            setCheckedScopesMap(initMap);
        }

        const handleAuth = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            if (code) {
                showToast('Processing Jira SSO login...', 'loading');
                try {
                    const redirectUri = window.location.origin + window.location.pathname;
                    const res = await fetch('/api/jira-auth', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code, redirectUri })
                    });
                    const data = await res.json();
                    if (!res.ok || data.error) throw new Error(data.error || 'Authentication failed');
                    setJiraToken(data.access_token);
                    setJiraRefreshToken(data.refresh_token);
                    setJiraCloudId(data.cloud_id);
                    localStorage.setItem('jira_access_token', data.access_token);
                    localStorage.setItem('jira_refresh_token', data.refresh_token);
                    localStorage.setItem('jira_cloud_id', data.cloud_id);
                    window.history.replaceState({}, document.title, window.location.pathname);
                    hideLoadingToast();
                    showToast("Connected to Jira SSO successfully!", 'success');
                } catch (e) {
                    hideLoadingToast();
                    showToast("Jira Login Error: " + e.message, 'error');
                }
            }
        };
        handleAuth();
    }, []);

    useEffect(() => {
        const config = {
            sheetName, sheetTabName, dateReport, versionGame, dateGame, versionApp, dateApp,
            qcNames, chkCustomNote, customNotes: customNotesData, customIframesData, gameLinksData, chkWebapp, chkApptek, linkShared,
            scopesList, checkedScopes: checkedScopesMap, jiraStatusesList: jiraStatuses, checkedJiraStatuses_B: checkedJiraB,
            checkedJiraStatuses_Unverified: checkedJiraUnverified, checkedJiraStatuses_Pending: checkedJiraPending,
            jiraParents, jiraSprints, selectedParent, selectedSprint
        };
        localStorage.setItem('last_session_state', JSON.stringify(config));
    }, [
        sheetName, sheetTabName, dateReport, versionGame, dateGame, versionApp, dateApp,
        qcNames, chkCustomNote, customNotesData, customIframesData, gameLinksData, chkWebapp, chkApptek, linkShared,
        scopesList, checkedScopesMap, jiraStatuses, checkedJiraB, checkedJiraUnverified, checkedJiraPending,
        jiraParents, jiraSprints, selectedParent, selectedSprint
    ]);

    useEffect(() => {
        const key = sheetName.trim();
        if (!key || !jiraToken || !jiraCloudId) return;

        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
            fetchJiraStatuses(key, true);
        }, 700);

        return () => {
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        };
    }, [sheetName, jiraToken, jiraCloudId]);

    const initiateJiraSSO = () => {
        const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
        const scope = encodeURIComponent("read:jira-work read:jira-user read:board-scope:jira-software read:project:jira offline_access");
        const authUrl = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${ATLASSIAN_CLIENT_ID}&scope=${scope}&redirect_uri=${redirectUri}&response_type=code&prompt=consent`;
        window.location.href = authUrl;
    };

    const getGoogleTokenAsync = async (forceRefresh = false) => {
        if (!forceRefresh && googleToken) return googleToken;
        return new Promise((resolve, reject) => {
            if (!window.google || !window.google.accounts) {
                reject(new Error("Google Identity SDK failed to load. Check internet connection."));
                return;
            }
            const client = window.google.accounts.oauth2.initTokenClient({
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
                        setGoogleToken(response.access_token);
                        localStorage.setItem('google_access_token', response.access_token);
                        resolve(response.access_token);
                    }
                },
            });
            if (forceRefresh) client.requestAccessToken({ prompt: '' });
            else client.requestAccessToken();
        });
    };

    const getGameIdFromDriveFolder = async (folderUrl, token) => {
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
    };

    const fetchJiraStatuses = async (projectKeysStr, isAuto = false) => {
        if (!jiraToken || !jiraCloudId) {
            if (!isAuto) initiateJiraSSO();
            return;
        }
        if (!projectKeysStr) {
            if (!isAuto) showToast("Please enter Project Key(s) before loading statuses.", 'error');
            return;
        }
        if (!isAuto) showToast('Fetching Jira metadata...', 'loading');
        try {
            const keys = projectKeysStr.split(',').map(k => k.trim()).filter(Boolean);
            const statusSet = new Set();
            const sprintsMap = new Map();
            const parentsMap = new Map();

            for (const key of keys) {
                try {
                    const targetUrl = `https://api.atlassian.com/ex/jira/${jiraCloudId}/rest/api/2/project/${key}/statuses`;
                    const res = await fetchWithJiraAuth(targetUrl, { headers: { 'Accept': 'application/json' } });
                    if (res.ok) {
                        const data = await res.json();
                        data.forEach(issueType => {
                            issueType.statuses.forEach(status => {
                                statusSet.add(status.name.toUpperCase());
                            });
                        });
                    }
                } catch (e) {}

                try {
                    const bRes = await fetchWithJiraAuth(`https://api.atlassian.com/ex/jira/${jiraCloudId}/rest/agile/1.0/board?projectKeyOrId=${key}`, { headers: { 'Accept': 'application/json' } });
                    if (bRes.ok) {
                        const bData = await bRes.json();
                        if (bData && bData.values && bData.values.length > 0) {
                            const boardId = bData.values[0].id;
                            try {
                                const sRes = await fetchWithJiraAuth(`https://api.atlassian.com/ex/jira/${jiraCloudId}/rest/agile/1.0/board/${boardId}/sprint`, { headers: { 'Accept': 'application/json' } });
                                if (sRes.ok) {
                                    const sData = await sRes.json();
                                    sData.values?.forEach(s => sprintsMap.set(s.id, s.name));
                                }
                            } catch (e) {}
                        }
                    }
                } catch (e) {}

                try {
                    const eRes = await fetchWithJiraAuth(`https://api.atlassian.com/ex/jira/${jiraCloudId}/rest/api/3/search/jql`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                        body: JSON.stringify({ jql: `project = "${key}" AND issuetype = Epic`, maxResults: 100, fields: ["summary"] })
                    });
                    if (eRes.ok) {
                        const eData = await eRes.json();
                        eData.issues?.forEach(iss => parentsMap.set(iss.key, iss.fields?.summary || iss.key));
                    }
                } catch (e) {}
            }

            if (statusSet.size > 0) {
                const list = Array.from(statusSet);
                setJiraStatuses(list);
                const mapB = {}, mapUnv = {}, mapPen = {};
                list.forEach(s => {
                    const cleanS = s.replace(/[^A-Z0-9]/g, '');
                    mapB[s] = ['TODO', 'INPROGRESS', 'FIXEDDONE', 'FIXDONE', 'RESOLVED'].includes(cleanS);
                    mapUnv[s] = ['DEPLOYED', 'INTESTING'].includes(cleanS);
                    mapPen[s] = ['PENDING', 'WAITFOR', 'WAITING'].some(p => cleanS.includes(p));
                });
                setCheckedJiraB(mapB);
                setCheckedJiraUnverified(mapUnv);
                setCheckedJiraPending(mapPen);
            }

            setJiraSprints(Array.from(sprintsMap.entries()).map(([id, name]) => ({ id, name })));
            setJiraParents(Array.from(parentsMap.entries()).map(([key, name]) => ({ key, name })));

            if (!isAuto) {
                hideLoadingToast();
                showToast("Loaded Jira metadata successfully!", 'success');
            }
        } catch (err) {
            if (!isAuto) {
                hideLoadingToast();
                showToast("Failed to load Jira metadata: " + err.message, 'error');
            }
        }
    };

    const handleLoadStatuses = () => {
        fetchJiraStatuses(sheetName.trim(), false);
    };

    const toggleAllJiraCategory = (category, selectAll) => {
        const targetList = jiraStatuses.length > 0 ? jiraStatuses : ['TODO', 'IN PROGRESS', 'FIXEDDONE'];
        const newMap = {};
        targetList.forEach(s => { newMap[s] = selectAll; });
        if (category === 'B') setCheckedJiraB(newMap);
        else if (category === 'Unverified') setCheckedJiraUnverified(newMap);
        else if (category === 'Pending') setCheckedJiraPending(newMap);
    };

    const toggleAllScopes = (selectAll) => {
        const newMap = {};
        scopesList.forEach(s => { newMap[s] = selectAll; });
        setCheckedScopesMap(newMap);
    };

    const executeCopy = () => {
        if (!outputReport) {
            showToast("Execution Error: No data available to copy.", 'error');
            return;
        }
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(outputReport)
                .then(() => showToast("Report compiled successfully.", 'success'))
                .catch(() => fallbackCopy(outputReport));
        } else {
            fallbackCopy(outputReport);
        }
    };

    const fallbackCopy = (text) => {
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
            showToast("Report compiled successfully.", 'success');
        } catch (err) {
            showToast("Failed to copy text.", 'error');
        }
        textArea.remove();
    };

    const handleAddNote = () => {
        setCustomNotesData(prev => [...prev, '']);
    };

    const handleNoteChange = (index, val) => {
        setCustomNotesData(prev => {
            const next = [...prev];
            next[index] = val;
            return next;
        });
    };

    const handleNoteDelete = (index) => {
        setCustomNotesData(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddIframe = () => {
        setCustomIframesData(prev => [...prev, '']);
    };

    const handleIframeChange = (index, val) => {
        setCustomIframesData(prev => {
            const next = [...prev];
            next[index] = val;
            return next;
        });
    };

    const handleIframeDelete = (index) => {
        setCustomIframesData(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddGameLink = () => {
        setGameLinksData(prev => [...prev, '']);
    };

    const handleGameLinkChange = (index, val) => {
        setGameLinksData(prev => {
            const next = [...prev];
            next[index] = val;
            return next;
        });
    };

    const handleGameLinkDelete = (index) => {
        setGameLinksData(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddScope = () => {
        const val = newScopeInput.trim();
        if (val && !scopesList.includes(val)) {
            setScopesList(prev => [...prev, val]);
            setCheckedScopesMap(prev => ({ ...prev, [val]: true }));
            setNewScopeInput('');
        }
    };

    const handleDeleteScope = (scope) => {
        setScopesList(prev => prev.filter(s => s !== scope));
        setCheckedScopesMap(prev => {
            const next = { ...prev };
            delete next[scope];
            return next;
        });
    };

    const handleGenerate = async () => {
        if (!jiraToken || !jiraCloudId) {
            initiateJiraSSO();
            return;
        }
        const projectKeysInput = sheetName.split(',').map(k => k.trim()).filter(Boolean);
        const qcNamesInput = qcNames.trim();
        const versionGameInput = versionGame.trim();
        const versionAppInput = versionApp.trim();
        const isAppRequired = chkWebapp || chkApptek;
        const selectedScopes = scopesList.filter(scope => checkedScopesMap[scope] === undefined ? true : checkedScopesMap[scope]);
        const sharedInputValue = linkShared.trim();

        let errors = [];
        if (projectKeysInput.length === 0) errors.push("Project Key");
        if (!qcNamesInput) errors.push("QC Team");
        if (!versionGameInput) errors.push("Game Version");
        if (isAppRequired && !versionAppInput) errors.push("App Version");
        if (selectedScopes.length === 0) errors.push("Scope of Testing (at least 1)");

        setFormErrors(errors);

        if (errors.length > 0) {
            showToast("Missing required fields: " + errors.join(', '), 'error');
            if (errors.includes("Project Key") && projectKeyRef.current) projectKeyRef.current.focus();
            else if (errors.includes("QC Team") && qcTeamRef.current) qcTeamRef.current.focus();
            else if (errors.includes("Game Version") && gameVersionRef.current) gameVersionRef.current.focus();
            else if (errors.includes("App Version") && appVersionRef.current) appVersionRef.current.focus();
            return;
        }

        setIsGenerating(true);

        try {
            let finalGameId = projectKeysInput[0];
            const actualSheetTabName = sheetTabName.trim() || projectKeysInput[0];
            const urlInput = "https://docs.google.com/spreadsheets/d/1XF2bOLyXoVM3Py6qYBidSe1tcfOqMuuwg14wnLVf1lA/edit?gid=45247494#gid=45247494";

            setOutputReport('');
            showToast('Authenticating with Google...', 'loading');

            let token = '';
            try {
                token = await getGoogleTokenAsync();
            } catch (authErr) {
                hideLoadingToast();
                showToast("Google Login Failed: " + authErr.message, 'error');
                return;
            }

            showToast('Connecting to Google Sheets...', 'loading');
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
                    token = await getGoogleTokenAsync(true);
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
                    showToast('Extracting ID Game...', 'loading');
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
                showToast("Google Sheets Error: " + error.message, 'error');
                return;
            }

            showToast('Scanning Jira data...', 'loading');
            let jiraReportSegment = '';
            let detectedBoardName = '';
            let autoJiraLink = '';
            let unverifiedCount = 0;
            let pendingCount = 0;
            let unverifiedStatusesFound = new Set();
            let pendingStatusesFound = new Set();

            try {
                let targetName = projectKeysInput.join(', ');
                let realKey = projectKeysInput[0];
                let boardId = '';

                try {
                    const pRes = await fetchWithJiraAuth(`https://api.atlassian.com/ex/jira/${jiraCloudId}/rest/api/2/project/${realKey}`, { headers: { 'Accept': 'application/json' } });
                    if (pRes.ok) {
                        const pData = await pRes.json();
                        if (pData && pData.name && projectKeysInput.length === 1) targetName = pData.name;
                        if (pData && pData.key) realKey = pData.key;
                    }
                } catch (e) { }

                try {
                    const bRes = await fetchWithJiraAuth(`https://api.atlassian.com/ex/jira/${jiraCloudId}/rest/agile/1.0/board?projectKeyOrId=${realKey}`, { headers: { 'Accept': 'application/json' } });
                    if (bRes.ok) {
                        const bData = await bRes.json();
                        if (bData && bData.values && bData.values.length > 0) {
                            boardId = bData.values[0].id;
                        }
                    }
                } catch (e) { }

                let jqlString = `project in (${projectKeysInput.map(k => `"${k}"`).join(',')}) AND issuetype in (Bug, Improvement, Question)`;
                if (selectedParent !== 'All') jqlString += ` AND (parent = "${selectedParent}" OR "Epic Link" = "${selectedParent}")`;
                if (selectedSprint !== 'All') jqlString += ` AND sprint = ${selectedSprint}`;
                jqlString += ` ORDER BY created DESC`;

                const issueMap = new Map();
                let jHasMore = true;
                let currentToken = null;
                while (jHasMore) {
                    const payload = { jql: jqlString, maxResults: 100, fields: ["summary", "status", "issuetype", "priority"] };
                    if (currentToken) payload.nextPageToken = currentToken;
                    
                    const res = await fetchWithJiraAuth(`https://api.atlassian.com/ex/jira/${jiraCloudId}/rest/api/3/search/jql`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    
                    if (!res.ok) {
                        if (res.status === 400) throw new Error(`Invalid Project Key or Filter.`);
                        throw new Error(`JQL Fetch failed (Status: ${res.status})`);
                    }
                    
                    const d = await res.json();
                    const items = d.issues || d.values || [];
                    items.forEach(iss => { if (iss && iss.key) issueMap.set(iss.key, iss); });
                    if (d.nextPageToken && items.length > 0) currentToken = d.nextPageToken;
                    else jHasMore = false;
                }
                const jiraIssues = Array.from(issueMap.values());
                detectedBoardName = targetName;

                if (boardId) {
                    autoJiraLink = `https://enotion.atlassian.net/jira/software/projects/${realKey}/boards/${boardId}`;
                } else {
                    autoJiraLink = `https://enotion.atlassian.net/jira/software/projects/${realKey}/boards`;
                }

                const typeContainers = { 'BUG': {}, 'IMPROVEMENT': {}, 'QUESTION': {} };
                let totalBoardTickets = 0;
                let buildStatusCount = 0;
                let bugCount = 0, impCount = 0, queCount = 0;
                let bugPriorityMap = {};
                jiraIssues.forEach(issue => {
                    let statusName = (issue.fields.status && issue.fields.status.name) ? issue.fields.status.name.toUpperCase().trim() : '';
                    if (checkedJiraUnverified[statusName]) { unverifiedCount++; unverifiedStatusesFound.add(statusName); }
                    if (checkedJiraPending[statusName]) { pendingCount++; pendingStatusesFound.add(statusName); }
                    const issueTypeName = (issue.fields.issuetype && issue.fields.issuetype.name) ? issue.fields.issuetype.name.toUpperCase().trim() : '';
                    totalBoardTickets++;
                    if (typeContainers[issueTypeName] === undefined) return;
                    let isValidStatus = false;
                    if (jiraStatuses.length > 0) {
                        if (checkedJiraB[statusName]) isValidStatus = true;
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
                let summarySection = `\`\`\`\n——————————————————\nA. [SUMMARY]\n- Scope of testing: ${scopeText}.\n- Testing Status: In-testing\n- Build status: ${buildStatusStr} / Total: ${totalBoardTickets} tickets\n`;
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
                                let lowerScopes = scopesList.map(s => s.toLowerCase());
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
                                            tickets.forEach(t => { jiraBody += `  + Ticket ${t.key.split('-').pop()}: ${t.summary}\n`; });
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
                                    if (totalInType === 1) { tickets.forEach(t => { jiraBody += `  + Ticket ${t.key.split('-').pop()}: ${t.summary}\n`; }); }
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
                showToast("Jira Error: " + error.message, 'error');
                return;
            }

            const now = new Date();
            const currentDateStr = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth() + 1).padStart(2, '0') + '/' + now.getFullYear();
            const formatDate = (dateVal, fallback) => {
                const parts = dateVal ? dateVal.split('-') : [];
                return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : fallback;
            };
            const inputReportDate = formatDate(dateReport, currentDateStr);
            let baseBoardName = (detectedBoardName || projectKeysInput.join(', ')).replace(/^\[.*?\]\s*/, '').replace(/\s*-\s*/g, ' - ').trim();
            let customHeader = `Report for ${baseBoardName} (${inputReportDate})\n`;
            if (versionGameInput) {
                const vGame = versionGameInput.split('/').map(v => v.trim().toLowerCase().startsWith('v') ? v.trim() : 'v' + v.trim()).join('/');
                customHeader += `Version game: ${vGame} (${formatDate(dateGame, currentDateStr)})\n`;
            }
            if (chkApptek && versionAppInput) {
                const vApp = versionAppInput.split('/').map(v => v.trim().toLowerCase().startsWith('v') ? v.trim() : 'v' + v.trim()).join('/');
                customHeader += `Version App: ${vApp} (${formatDate(dateApp, currentDateStr)})\n`;
            }
            let envParts = ["Iframe"];
            if (chkWebapp) envParts.push("Webapp");
            if (chkApptek) envParts.push("App");
            customHeader += `Env: ${envParts.join('/')} - Internal Staging\n`;
            let linksCollected = [];
            
            const validIframes = customIframesData.filter(link => link.trim() !== "");
            if (validIframes.length === 1) {
                linksCollected.push("- Iframe: " + validIframes[0].trim());
            } else if (validIframes.length > 1) {
                linksCollected.push("- Iframe:\n  + " + validIframes.map(l => l.trim()).join("\n  + "));
            } else {
                linksCollected.push(`- Iframe: https://iframe-tektale.staging.enostd.gay/en/kts${finalGameId}/?token=xxx&c=USD&ru=https://internal-portal.enostd.gay/`);
            }
            
            if (chkWebapp) {
                let webappVal = sharedInputValue;
                linksCollected.push("- Webapp: " + (webappVal && !isNaN(webappVal) ? `https://webapp${webappVal}tek.enostd.gay/` : webappVal));
            }
            if (chkApptek) {
                let appLinkVal = sharedInputValue;
                let appNumMatch = appLinkVal.match(/\d+/);
                if (appNumMatch) {
                    linksCollected.push("- App: TektaleC" + appNumMatch[0]);
                } else {
                    linksCollected.push("- App: " + (appLinkVal || ""));
                }
            }

            gameLinksData.forEach(link => {
                if (link.trim()) linksCollected.push("- Game Link: " + link.trim());
            });
            
            linksCollected.push("- Jira: " + autoJiraLink);
            linksCollected.push("- Testcase: " + (autoTestcaseLink || "No link found in cell A1"));
            if (linksCollected.length > 0) customHeader += "Link:\n" + linksCollected.join('\n') + "\n";
            let notesSegment = "C. [NOTES]\n";
            if (customNotesData.some(n => n.trim() !== "")) {
                customNotesData.forEach(line => {
                    let trimmed = line.trim();
                    if (trimmed) notesSegment += (trimmed.startsWith('-') ? trimmed : `- ${trimmed}`) + "\n";
                });
            }
            if (unverifiedCount > 0) {
                const arr = Array.from(unverifiedStatusesFound);
                notesSegment += `- There ${unverifiedCount === 1 ? 'is' : 'are'} ${unverifiedCount} unverified ${unverifiedCount === 1 ? 'ticket' : 'tickets'} in the ${arr.length > 1 ? arr.join(' and ') : arr[0]} ${arr.length === 1 ? 'column' : 'columns'}\n`;
            }
            if (pendingCount > 0) {
                const arr = Array.from(pendingStatusesFound);
                notesSegment += `- There ${pendingCount === 1 ? 'is' : 'are'} ${pendingCount} pending ${pendingCount === 1 ? 'ticket' : 'tickets'} in the ${arr.length > 1 ? arr.join(' and ') : arr[0]} ${arr.length === 1 ? 'column' : 'columns'}\n`;
            }
            notesSegment += `- QC: ${qcNamesInput || 'Victor, Anna, Khanh, Hien, ChinSu, Thea, Atomic'}\n\`\`\`\nQC sends the report today!`;
            let finalOutputString = customHeader + finalReport + "——————————————————\n";
            if (jiraReportSegment.trim().length > 0) finalOutputString += jiraReportSegment.replace(/(?:——————————————————\n)$/, "") + "——————————————————\n";
            finalOutputString += notesSegment;

            setOutputReport(finalOutputString.trim().replace(/\.00%/g, '%'));
            hideLoadingToast();
            showToast("Report compiled successfully.", 'success');

        } finally {
            setIsGenerating(false);
        }
    };

    const statusPillList = jiraStatuses.length > 0 ? jiraStatuses : ['TODO', 'IN PROGRESS', 'FIXEDDONE'];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-6 pb-32">
            <header className="max-w-[1600px] mx-auto mb-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shadow-sm">
                        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">QC Report Internal Tool</h1>
                </div>

                <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-1.5 rounded-xl shadow-sm">
                    <span className={`w-2.5 h-2.5 rounded-full ${jiraToken && jiraCloudId ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-400'}`}></span>
                    <span className="text-xs font-bold text-slate-700">
                        {jiraToken && jiraCloudId ? "Jira Connected" : "Jira Disconnected"}
                    </span>
                    {jiraToken && jiraCloudId ? (
                        <button onClick={handleJiraDisconnect} className="text-xs px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg border border-slate-300 transition-all">
                            Disconnect
                        </button>
                    ) : (
                        <button onClick={initiateJiraSSO} className="text-xs px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition-all">
                            Connect SSO
                        </button>
                    )}
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

                <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                    <h2 className="text-sm font-bold text-slate-900 tracking-wide flex items-center gap-1.5">
                        <span className="text-indigo-600 font-mono">Project Details</span> 
                    </h2>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-600">Project Key(s)</label>
                        <div className="flex gap-2.5">
                            <input
                                ref={projectKeyRef}
                                type="text"
                                value={sheetName}
                                onChange={e => {
                                    setSheetName(e.target.value);
                                    setFormErrors(prev => prev.filter(err => err !== "Project Key"));
                                }}
                                placeholder="e.g. 9707, WS019775"
                                className={`flex-1 h-10 px-3.5 bg-slate-50 border rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition-colors ${formErrors.includes("Project Key") ? 'border-rose-500 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-500'}`}
                            />
                            <button type="button" onClick={handleLoadStatuses} className="px-4 h-10 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5">
                                <span>↻ Sync Meta</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600">Sprint Filter</label>
                            <select value={selectedSprint} onChange={e => setSelectedSprint(e.target.value)} className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white">
                                <option value="All">All Sprints</option>
                                {jiraSprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600">Parent/Epic Filter</label>
                            <select value={selectedParent} onChange={e => setSelectedParent(e.target.value)} className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white">
                                <option value="All">All Parents</option>
                                {jiraParents.map(p => <option key={p.key} value={p.key}>{p.name} ({p.key})</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600">Sheet Tab Name</label>
                            <input type="text" value={sheetTabName} onChange={e => setSheetTabName(e.target.value)} placeholder="Sheet Name" className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600">Report Date</label>
                            <input type="date" value={dateReport} onChange={e => setDateReport(e.target.value)} className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-600">QC Team</label>
                        <div className="relative">
                            <input
                                ref={qcTeamRef}
                                type="text"
                                value={qcNames}
                                onChange={e => {
                                    setQcNames(e.target.value);
                                    setFormErrors(prev => prev.filter(err => err !== "QC Team"));
                                }}
                                placeholder="Victor, Anna..."
                                className={`w-full h-10 pl-9 pr-3.5 bg-slate-50 border rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition-colors ${formErrors.includes("QC Team") ? 'border-rose-500 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-500'}`}
                            />
                            <svg className={`w-4 h-4 absolute left-3 top-3 ${formErrors.includes("QC Team") ? 'text-rose-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden mt-1">
                        <button type="button" onClick={() => setIsAccordionOpen(!isAccordionOpen)} className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all">
                            <span>Jira Status</span>
                            <span className="text-slate-400">{isAccordionOpen ? '▲' : '▼'}</span>
                        </button>

                        {isAccordionOpen && (
                            <div className="p-3 border-t border-slate-200 grid grid-cols-3 gap-3 bg-white">
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Count tickets</span>
                                        <div className="flex gap-1 text-[9px]">
                                            <button type="button" onClick={() => toggleAllJiraCategory('B', true)} className="text-indigo-600 hover:underline font-bold">All</button>
                                            <span className="text-slate-300">|</span>
                                            <button type="button" onClick={() => toggleAllJiraCategory('B', false)} className="text-slate-500 hover:underline">None</button>
                                        </div>
                                    </div>
                                    {statusPillList.map(s => (
                                        <div key={s} onClick={() => setCheckedJiraB(p => ({ ...p, [s]: !p[s] }))} className={`px-2 py-1 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${checkedJiraB[s] ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                                            <span className="text-[10px] font-bold truncate">{s}</span>
                                            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] font-bold ${checkedJiraB[s] ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-300'}`}>{checkedJiraB[s] ? '✓' : ''}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Unverified</span>
                                        <div className="flex gap-1 text-[9px]">
                                            <button type="button" onClick={() => toggleAllJiraCategory('Unverified', true)} className="text-amber-600 hover:underline font-bold">All</button>
                                            <span className="text-slate-300">|</span>
                                            <button type="button" onClick={() => toggleAllJiraCategory('Unverified', false)} className="text-slate-500 hover:underline">None</button>
                                        </div>
                                    </div>
                                    {statusPillList.map(s => (
                                        <div key={s} onClick={() => setCheckedJiraUnverified(p => ({ ...p, [s]: !p[s] }))} className={`px-2 py-1 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${checkedJiraUnverified[s] ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                                            <span className="text-[10px] font-bold truncate">{s}</span>
                                            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] font-bold ${checkedJiraUnverified[s] ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-slate-300'}`}>{checkedJiraUnverified[s] ? '✓' : ''}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Pending</span>
                                        <div className="flex gap-1 text-[9px]">
                                            <button type="button" onClick={() => toggleAllJiraCategory('Pending', true)} className="text-indigo-600 hover:underline font-bold">All</button>
                                            <span className="text-slate-300">|</span>
                                            <button type="button" onClick={() => toggleAllJiraCategory('Pending', false)} className="text-slate-500 hover:underline">None</button>
                                        </div>
                                    </div>
                                    {statusPillList.map(s => (
                                        <div key={s} onClick={() => setCheckedJiraPending(p => ({ ...p, [s]: !p[s] }))} className={`px-2 py-1 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${checkedJiraPending[s] ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                                            <span className="text-[10px] font-bold truncate">{s}</span>
                                            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] font-bold ${checkedJiraPending[s] ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-300'}`}>{checkedJiraPending[s] ? '✓' : ''}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                    <h2 className="text-sm font-bold text-slate-900 tracking-wide flex items-center gap-1.5">
                        <span className="text-indigo-600 font-mono">Environments</span> 
                    </h2>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600">Game Version</label>
                            <input
                                ref={gameVersionRef}
                                type="text"
                                value={versionGame}
                                onChange={e => {
                                    setVersionGame(e.target.value);
                                    setFormErrors(prev => prev.filter(err => err !== "Game Version"));
                                }}
                                placeholder="1.0.0"
                                className={`h-10 px-3.5 bg-slate-50 border rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition-colors ${formErrors.includes("Game Version") ? 'border-rose-500 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-500'}`}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600">Version Date</label>
                            <input type="date" value={dateGame} onChange={e => setDateGame(e.target.value)} className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600">App Version</label>
                            <input
                                ref={appVersionRef}
                                type="text"
                                value={versionApp}
                                onChange={e => {
                                    setVersionApp(e.target.value);
                                    setFormErrors(prev => prev.filter(err => err !== "App Version"));
                                }}
                                placeholder="3.41.790"
                                className={`h-10 px-3.5 bg-slate-50 border rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition-colors ${formErrors.includes("App Version") ? 'border-rose-500 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-500'}`}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600">App Date</label>
                            <input type="date" value={dateApp} onChange={e => setDateApp(e.target.value)} className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700">Webapp/App</label>
                        <span className="text-[11px] font-semibold text-slate-500">Env</span>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setChkWebapp(!chkWebapp)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${chkWebapp ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'}`}>Webapp</button>
                            <button type="button" onClick={() => setChkApptek(!chkApptek)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${chkApptek ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'}`}>App</button>
                        </div>
                    </div>

                    {(chkWebapp || chkApptek) && (
                        <div className="flex flex-col gap-1.5 mt-1">
                            <label className="text-xs font-bold text-slate-600">Wepapp ID/Link</label>
                            <input type="text" value={linkShared} onChange={e => setLinkShared(e.target.value)} placeholder="Internal server number (e.g. 8) or URL..." className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                        </div>
                    )}

                    <div className="flex flex-col gap-2 pt-3 border-t border-slate-200 mt-2">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-700">Custom Iframes</label>
                            <button type="button" onClick={handleAddIframe} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">+ Add Iframe</button>
                        </div>
                        {customIframesData.map((link, idx) => (
                            <div key={idx} className="flex gap-2">
                                <input type="text" value={link} onChange={e => handleIframeChange(idx, e.target.value)} placeholder="https://..." className="flex-1 h-9 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                                <button type="button" onClick={() => handleIframeDelete(idx)} className="px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all">✕</button>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-2 pt-3 border-t border-slate-200 mt-2">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-700">Game Links</label>
                            <button type="button" onClick={handleAddGameLink} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">+ Add Game Link</button>
                        </div>
                        {gameLinksData.map((link, idx) => (
                            <div key={idx} className="flex gap-2">
                                <input type="text" value={link} onChange={e => handleGameLinkChange(idx, e.target.value)} placeholder="https://..." className="flex-1 h-9 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                                <button type="button" onClick={() => handleGameLinkDelete(idx)} className="px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all">✕</button>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-2 pt-3 border-t border-slate-200 mt-2">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-700">Notes</label>
                            <button type="button" onClick={handleAddNote} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">+ Add Note Line</button>
                        </div>
                        {customNotesData.map((note, idx) => (
                            <div key={idx} className="flex gap-2">
                                <input type="text" value={note} onChange={e => handleNoteChange(idx, e.target.value)} placeholder="Add note Line..." className="flex-1 h-9 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                                <button type="button" onClick={() => handleNoteDelete(idx)} className="px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all">✕</button>
                            </div>
                        ))}
                    </div>

                </section>

                <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-sm font-bold text-slate-900 tracking-wide flex items-center gap-1.5">
                            <span className="text-indigo-600 font-mono">Scope of Testing</span> 
                        </h2>
                        <div className="flex gap-1.5 text-xs">
                            <button type="button" onClick={() => { toggleAllScopes(true); setFormErrors(prev => prev.filter(err => err !== "Scope of Testing (at least 1)")); }} className="px-2.5 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-lg transition-all">Select All</button>
                            <button type="button" onClick={() => toggleAllScopes(false)} className="px-2.5 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium rounded-lg transition-all">Deselect All</button>
                        </div>
                    </div>

                    <div className={`flex flex-wrap gap-2.5 min-h-[220px] content-start p-1.5 rounded-xl border transition-colors ${formErrors.includes("Scope of Testing (at least 1)") ? 'border-rose-500 bg-rose-50/30' : 'border-transparent'}`}>
                        {scopesList.map(scope => {
                            const isChecked = checkedScopesMap[scope] === undefined ? true : checkedScopesMap[scope];
                            return (
                                <button key={scope} type="button" onClick={() => { setCheckedScopesMap(p => ({ ...p, [scope]: !isChecked })); setFormErrors(prev => prev.filter(err => err !== "Scope of Testing (at least 1)")); }} className={`px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 ${isChecked ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                    <span className="text-xs font-black">{isChecked ? '✓' : ''}</span>
                                    <span>{scope}</span>
                                    {!DEFAULT_SCOPES.includes(scope) && (
                                        <span onClick={(e) => { e.stopPropagation(); handleDeleteScope(scope); }} className="text-rose-500 hover:text-rose-700 ml-1 font-bold">✕</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex gap-2.5 mt-auto pt-2">
                        <input type="text" value={newScopeInput} onChange={e => setNewScopeInput(e.target.value)} placeholder="Add custom scope..." className="flex-1 h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                        <button type="button" onClick={handleAddScope} className="px-5 h-10 bg-slate-800 hover:bg-slate-900 text-white border border-slate-800 rounded-xl text-xs font-bold transition-all">+ Add</button>
                    </div>
                </section>
            </main>

            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 border border-slate-200 backdrop-blur-xl px-4 py-2 rounded-full shadow-lg flex items-center gap-3 z-50">
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-full shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 min-w-[155px]"
                >
                    {isGenerating ? (
                        <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                        <span>✨ Generate Report</span>
                    )}
                </button>
                <button disabled={!outputReport || isGenerating} onClick={executeCopy} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold text-xs rounded-full border border-slate-300 transition-all flex items-center gap-1.5">
                    <span>📋 Copy Report</span>
                </button>
                <button disabled={!outputReport || isGenerating} onClick={() => setIsPreviewOpen(true)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold text-xs rounded-full border border-slate-300 transition-all flex items-center gap-1.5">
                    <span>👁 Preview Report</span>
                </button>
            </div>

            {isPreviewOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 w-full max-w-4xl h-[80vh] rounded-2xl shadow-xl flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase">Report Preview</h2>
                            <button onClick={() => setIsPreviewOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
                        </div>
                        <div className="flex-1 p-6 bg-slate-50 min-h-0">
                            <textarea value={outputReport} readOnly className="w-full h-full p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed resize-none focus:outline-none font-mono" />
                        </div>
                        <div className="px-6 py-3.5 border-t border-slate-200 flex justify-end gap-3 bg-white">
                            <button onClick={executeCopy} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all">📋 Copy to Clipboard</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
                {toasts.map(t => (
                    <div key={t.id} className={`px-4 py-2.5 rounded-full text-xs font-extrabold shadow-lg border flex items-center gap-2 ${t.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}>
                        <span className="w-4 h-4 rounded-full bg-current text-white flex items-center justify-center text-[10px] font-black">✓</span>
                        <span>{t.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}