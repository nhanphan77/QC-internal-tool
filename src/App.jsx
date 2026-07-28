import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const GOOGLE_CLIENT_ID = "149310433677-gdnr36hn4fj7q79naud36a0f5kgbiqr1.apps.googleusercontent.com";
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
    const [scopesList, setScopesList] = useState([...DEFAULT_SCOPES]);
    const [checkedScopesMap, setCheckedScopesMap] = useState({});
    const [newScopeInput, setNewScopeInput] = useState('');

    const [jiraStatuses, setJiraStatuses] = useState([]);
    const [checkedJiraB, setCheckedJiraB] = useState({});
    const [checkedJiraUnverified, setCheckedJiraUnverified] = useState({});
    const [checkedJiraPending, setCheckedJiraPending] = useState({});

    const [outputReport, setOutputReport] = useState('');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isAccordionOpen, setIsAccordionOpen] = useState(true);
    const [toasts, setToasts] = useState([]);

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
                if (state.chkCustomNote) setChkCustomNote(state.chkCustomNote);
                if (Array.isArray(state.customNotes)) setCustomNotesData(state.customNotes);
                if (state.chkWebapp) setChkWebapp(state.chkWebapp);
                if (state.chkApptek) setChkApptek(state.chkApptek);
                if (state.linkShared) setLinkShared(state.linkShared);
                if (Array.isArray(state.scopesList)) setScopesList(state.scopesList);
                if (state.checkedScopes) setCheckedScopesMap(state.checkedScopes);
                if (Array.isArray(state.jiraStatusesList)) setJiraStatuses(state.jiraStatusesList);
                if (state.checkedJiraStatuses_B) setCheckedJiraB(state.checkedJiraStatuses_B);
                if (state.checkedJiraStatuses_Unverified) setCheckedJiraUnverified(state.checkedJiraStatuses_Unverified);
                if (state.checkedJiraStatuses_Pending) setCheckedJiraPending(state.checkedJiraStatuses_Pending);
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
                    setJiraCloudId(data.cloud_id);
                    localStorage.setItem('jira_access_token', data.access_token);
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
            sheetName, sheetTabName, dateReport, versionGame, dateGame,
            versionApp, dateApp, qcNames, chkCustomNote, customNotes: customNotesData,
            chkWebapp, chkApptek, linkShared, scopesList, checkedScopes: checkedScopesMap,
            jiraStatusesList: jiraStatuses, checkedJiraStatuses_B: checkedJiraB,
            checkedJiraStatuses_Unverified: checkedJiraUnverified,
            checkedJiraStatuses_Pending: checkedJiraPending
        };
        localStorage.setItem('last_session_state', JSON.stringify(config));
    }, [
        sheetName, sheetTabName, dateReport, versionGame, dateGame, versionApp, dateApp,
        qcNames, chkCustomNote, customNotesData, chkWebapp, chkApptek, linkShared,
        scopesList, checkedScopesMap, jiraStatuses, checkedJiraB, checkedJiraUnverified, checkedJiraPending
    ]);

    // Tự động Sync Statuses khi dừng gõ Project Key (Debounce 700ms)
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

    const handleJiraDisconnect = () => {
        localStorage.removeItem('jira_access_token');
        localStorage.removeItem('jira_cloud_id');
        setJiraToken(null);
        setJiraCloudId(null);
        showToast("Disconnected Jira.", 'success');
    };

    const fetchJiraStatuses = async (projectKey, isAuto = false) => {
        if (!jiraToken || !jiraCloudId) {
            if (!isAuto) initiateJiraSSO();
            return;
        }
        if (!projectKey) {
            if (!isAuto) showToast("Please enter a Project Key before loading statuses.", 'error');
            return;
        }
        if (!isAuto) showToast('Fetching Jira statuses...', 'loading');
        try {
            const targetUrl = `https://api.atlassian.com/ex/jira/${jiraCloudId}/rest/api/2/project/${projectKey}/statuses`;
            const res = await fetch(targetUrl, {
                headers: { 'Authorization': 'Bearer ' + jiraToken, 'Accept': 'application/json' }
            });
            if (!res.ok) throw new Error("Project not found or access denied.");
            const data = await res.json();
            const statusSet = new Set();
            data.forEach(issueType => {
                issueType.statuses.forEach(status => {
                    statusSet.add(status.name.toUpperCase());
                });
            });
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
            if (!isAuto) {
                hideLoadingToast();
                showToast("Loaded Jira statuses successfully!", 'success');
            }
        } catch (err) {
            if (!isAuto) {
                hideLoadingToast();
                showToast("Failed to load Jira statuses: " + err.message, 'error');
            }
        }
    };

    // Helper Select / Deselect All
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

    const statusPillList = jiraStatuses.length > 0 ? jiraStatuses : ['TODO', 'IN PROGRESS', 'FIXEDDONE'];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-6 pb-32">
            <header className="max-w-[1600px] mx-auto mb-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shadow-sm">
                        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Report Devtool Pro Dashboard</h1>
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
                        <span className="text-indigo-600 font-mono">[01]</span> Project Details
                    </h2>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-600">Project Key</label>
                        <div className="flex gap-2.5">
                            <input type="text" value={sheetName} onChange={e => setSheetName(e.target.value)} placeholder="9707" className="flex-1 h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                            <button type="button" onClick={() => fetchJiraStatuses(sheetName.trim())} className="px-4 h-10 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5">
                                <span>↻ Sync Statuses</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600">Sheet Tab Name</label>
                            <input type="text" value={sheetTabName} onChange={e => setSheetTabName(e.target.value)} placeholder="Sheet Tab Name" className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600">Report Date</label>
                            <input type="date" value={dateReport} onChange={e => setDateReport(e.target.value)} className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-600">QC Team</label>
                        <div className="relative">
                            <input type="text" value={qcNames} onChange={e => setQcNames(e.target.value)} placeholder="Victor, Anna..." className="w-full h-10 pl-9 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden mt-1">
                        <button type="button" onClick={() => setIsAccordionOpen(!isAccordionOpen)} className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all">
                            <span>Advanced Jira Status Mapping</span>
                            <span className="text-slate-400">{isAccordionOpen ? '▲' : '▼'}</span>
                        </button>

                        {isAccordionOpen && (
                            <div className="p-3 border-t border-slate-200 grid grid-cols-3 gap-3 bg-white">
                                {/* Column B */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Section B</span>
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

                                {/* Column Unverified */}
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

                                {/* Column Pending */}
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
                        <span className="text-indigo-600 font-mono">[02]</span> Environments & Links
                    </h2>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600">Game Version</label>
                            <input type="text" value={versionGame} onChange={e => setVersionGame(e.target.value)} placeholder="1.0.0" className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600">Version Date</label>
                            <input type="date" value={dateGame} onChange={e => setDateGame(e.target.value)} className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600">App Version</label>
                            <input type="text" value={versionApp} onChange={e => setVersionApp(e.target.value)} placeholder="3.41.790" className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600">App Date</label>
                            <input type="date" value={dateApp} onChange={e => setDateApp(e.target.value)} className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700">Configurations</label>
                        <span className="text-[11px] font-semibold text-slate-500">Env Configurations</span>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setChkWebapp(!chkWebapp)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${chkWebapp ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'}`}>Webapp</button>
                            <button type="button" onClick={() => setChkApptek(!chkApptek)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${chkApptek ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'}`}>App</button>
                            <button type="button" onClick={() => { const next = !chkCustomNote; setChkCustomNote(next); if (next && customNotesData.length === 0) setCustomNotesData(['']); }} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${chkCustomNote ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'}`}>Custom Notes</button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-1 border-t border-slate-200">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-700">Custom Notes</label>
                            <button type="button" onClick={() => setCustomNotesData(prev => [...prev, ''])} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">+ Add Note Line</button>
                        </div>
                        {chkCustomNote && customNotesData.map((note, idx) => (
                            <div key={idx} className="flex gap-2">
                                <input type="text" value={note} onChange={e => {
                                    const next = [...customNotesData];
                                    next[idx] = e.target.value;
                                    setCustomNotesData(next);
                                }} placeholder="Add note Line..." className="flex-1 h-9 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                                <button type="button" onClick={() => setCustomNotesData(prev => prev.filter((_, i) => i !== idx))} className="px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all">✕</button>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-1.5 mt-1">
                        <label className="text-xs font-bold text-slate-600">Server / Link Detail</label>
                        <input type="text" value={linkShared} onChange={e => setLinkShared(e.target.value)} placeholder="Internal server number (e.g. 8) or URL..." className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                    </div>
                </section>

                <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-sm font-bold text-slate-900 tracking-wide flex items-center gap-1.5">
                            <span className="text-indigo-600 font-mono">[03]</span> Scope of Testing
                        </h2>
                        <div className="flex gap-1.5 text-xs">
                            <button type="button" onClick={() => toggleAllScopes(true)} className="px-2.5 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-lg transition-all">Select All</button>
                            <button type="button" onClick={() => toggleAllScopes(false)} className="px-2.5 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium rounded-lg transition-all">Deselect All</button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2.5 min-h-[220px] content-start">
                        {scopesList.map(scope => {
                            const isChecked = checkedScopesMap[scope] === undefined ? true : checkedScopesMap[scope];
                            return (
                                <button key={scope} type="button" onClick={() => setCheckedScopesMap(p => ({ ...p, [scope]: !isChecked }))} className={`px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 ${isChecked ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                    <span className="text-xs font-black">{isChecked ? '✓' : ''}</span>
                                    <span>{scope}</span>
                                    {!DEFAULT_SCOPES.includes(scope) && (
                                        <span onClick={(e) => {
                                            e.stopPropagation();
                                            setScopesList(prev => prev.filter(s => s !== scope));
                                            setCheckedScopesMap(prev => { const next = { ...prev }; delete next[scope]; return next; });
                                        }} className="text-rose-500 hover:text-rose-700 ml-1 font-bold">✕</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex gap-2.5 mt-auto pt-2">
                        <input type="text" value={newScopeInput} onChange={e => setNewScopeInput(e.target.value)} placeholder="Add custom scope..." className="flex-1 h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white" />
                        <button type="button" onClick={() => {
                            const val = newScopeInput.trim();
                            if (val && !scopesList.includes(val)) {
                                setScopesList(prev => [...prev, val]);
                                setCheckedScopesMap(prev => ({ ...prev, [val]: true }));
                                setNewScopeInput('');
                            }
                        }} className="px-5 h-10 bg-slate-800 hover:bg-slate-900 text-white border border-slate-800 rounded-xl text-xs font-bold transition-all">+ Add</button>
                    </div>
                </section>
            </main>

            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 border border-slate-200 backdrop-blur-xl px-4 py-2 rounded-full shadow-lg flex items-center gap-3 z-50">
                <button onClick={() => showToast('Generate Clicked', 'info')} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-full shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2">
                    <span>✨ Generate Report</span>
                </button>
                <button disabled={!outputReport} onClick={() => { navigator.clipboard.writeText(outputReport); showToast('Copied!', 'success'); }} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold text-xs rounded-full border border-slate-300 transition-all flex items-center gap-1.5">
                    <span>📋 Copy Report</span>
                </button>
                <button disabled={!outputReport} onClick={() => setIsPreviewOpen(true)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold text-xs rounded-full border border-slate-300 transition-all flex items-center gap-1.5">
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
                            <button onClick={() => { navigator.clipboard.writeText(outputReport); showToast('Copied!', 'success'); }} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all">📋 Copy to Clipboard</button>
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