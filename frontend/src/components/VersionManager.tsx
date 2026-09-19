import { API_BASE } from "@/shared/apiHelper";
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

interface Version {
  id: string;
  version_number: number;
  change_description: string;
  change_type: 'manual' | 'autosave';
  created_at: string;
  overall_score?: number | null;
}

interface VersionManagerProps {
  /** The session being edited. Passed by the page because the route has no id. */
  sessionId?: string;
  /** Bumped by the save path whenever a new version is written. */
  currentVersion?: number;
}

export default function VersionManager({ sessionId: propSessionId, currentVersion }: VersionManagerProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  // Save/restore outcomes used to be console-only, so a no-op looked exactly
  // like a success. One line in the open dropdown tells them apart.
  const [notice, setNotice] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const eventCountRef = useRef(0);
  const AUTO_SAVE_THRESHOLD = 10;

  const { id: routeSessionId } = useParams<{ id: string }>();

  // This app has ONE route ("/"), so useParams().id is always undefined here.
  // Reading the session from the URL alone meant loadVersions was never called
  // and this dropdown could not show a single version. The session arrives as a
  // prop from the page that owns it; the route param stays only as a fallback.
  const activeSessionId =
    propSessionId || (routeSessionId && routeSessionId !== 'new' ? routeSessionId : null);

  // Load versions for the session being edited, and reload when a Save writes a
  // new one (currentVersion changes) so the history stays running on screen.
  useEffect(() => {
    setSessionId(activeSessionId);
    if (activeSessionId) {
      loadVersions(activeSessionId);
    } else {
      setVersions([]);
    }
  }, [activeSessionId, currentVersion]);

  const loadVersions = (sid: string) => {
    fetch(`${API_BASE}/prompt-sessions/${sid}/versions`)
      .then(r => r.json())
      .then(d => setVersions(d.versions || []))
      .catch((err) => console.error('[VersionManager] Failed to fetch versions:', err));
  };

  // AUTO-SAVE DISABLED — versions are now manual-only via Save Template button
  // Event listener: increment counter on textarea input (left column) and chat sends
  // DISABLED: useEffect(() => { ... trig gerAutosave ... }, [sessionId]);
  // DISABLED: const triggerAutosave = async () => { ... };


  const handleManualSave = async () => {
    if (!sessionId || !saveName.trim()) return;
    try {
      // Snapshot what the ROW holds instead of scraping <textarea> values.
      // Joining those DOM values with "\n" wrote plain text into
      // left_column_content, which every other code path reads as JSON
      // {"sections":[...]} — a second writer silently corrupting the column, and
      // the restore path below then split that text back apart on "\n".
      // The stored value is already in the canonical shape.
      const current = await fetch(`${API_BASE}/prompt-sessions/${sessionId}`)
        .then(r => r.json())
        .then(d => d.session || d);
      const r = await fetch(`${API_BASE}/prompt-sessions/${sessionId}/versions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          change_description: saveName,
          left_column_content: current.left_column_content || '',
          compiled_output: current.compiled_output || '',
        }),
      });
      const d = await r.json();
      // API returns {"version": {...}} not {"success": true}
      if (d.version) {
        setSaveName('');
        setShowSaveInput(false);
        setNotice(null);
        loadVersions(sessionId);
      } else {
        const why = d.error || d.detail || `HTTP ${r.status}`;
        console.error('[VersionManager] Version not saved:', why, d);
        setNotice({ kind: 'error', text: `Version not saved: ${why}` });
      }
    } catch (e) {
      // Used to be an empty catch: a failed version write looked identical to a
      // successful one, and the input just sat there.
      console.error('[VersionManager] Version save failed:', e);
      setNotice({
        kind: 'error',
        text: `Version not saved: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  };

  // Selecting a version opens it in the right column Trace tab
  const handleSelectVersion = (v: Version) => {
    window.dispatchEvent(new CustomEvent('version-selected', { detail: v }));
    setShowDropdown(false);
  };

  // Restore rewrites the row server-side (restore_version also records a new
  // "restore" version), then puts the restored content back on screen through
  // the app's own section event.
  const handleRestore = async (e: React.MouseEvent, version: Version) => {
    e.stopPropagation();
    if (!sessionId) return;
    setNotice(null);
    try {
      const r = await fetch(`${API_BASE}/prompt-sessions/${sessionId}/versions/${version.version_number}/restore`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      });
      const d = await r.json();
      if (!r.ok || !d.version) {
        // With the 10-version cap a listed entry can already be gone by the time
        // it is clicked. Say so on screen and refresh the list — silently
        // console.error-ing made a dead version look like a working button.
        const why = d.error || d.detail || `HTTP ${r.status}`;
        console.error('[VersionManager] Restore failed:', why, d);
        setNotice({ kind: 'error', text: `Could not restore v${version.version_number}: ${why}` });
        loadVersions(sessionId);
        return;
      }

      // The left column is stored as JSON {"sections":[...]}. This used to be
      // split on "\n" and poked straight into <textarea> values, which is the
      // format of no writer in the app — so a restore inserted garbage into the
      // editor. Use the same event the rest of the app uses to load sections.
      let applied = 0;
      try {
        const parsed = JSON.parse(d.version.left_column_content || '{}');
        const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
        sections.forEach((s: { section?: string; role?: string; content?: string }) => {
          const name = s.section || s.role;
          if (!name) return;
          window.dispatchEvent(new CustomEvent('load-section-content', {
            detail: { target: name, content: s.content || '', sessionId },
          }));
          applied++;
        });
      } catch {
        console.warn(
          '[VersionManager] Restored version holds no JSON sections — the left ' +
          'column was not changed on screen. The database row was updated.'
        );
      }
      console.log(`[VersionManager] Restored v${version.version_number}: ${applied} sections applied`);

      // Restore compiled output to the middle column. `!= null` and not a truthy
      // check: a version whose output was cleared must clear it on screen too.
      if (d.version.compiled_output != null) {
        window.dispatchEvent(new CustomEvent('restore-output', {
          detail: { content: d.version.compiled_output }
        }));
      }

      loadVersions(sessionId);
      setShowDropdown(false);
    } catch (err) {
      // Was an empty catch: a failed restore looked exactly like a good one.
      console.error('[VersionManager] Restore request failed:', err);
      setNotice({
        kind: 'error',
        text: `Could not restore v${version.version_number}: ${err instanceof Error ? err.message : String(err)}`,
      });
      loadVersions(sessionId);
    }
  };

  const latestVersion = versions.find(v => v.change_type === 'manual') || versions[0];
  const displayLabel = latestVersion ? `v${latestVersion.version_number}` : 'Editing Version —';
  const autoSaveCount = versions.filter(v => v.change_type === 'autosave').length;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="px-3 py-0.5 rounded-full border text-xs font-medium text-gray-700 border-gray-400 bg-transparent cursor-pointer hover:border-gray-500 transition-colors"
      >
        {displayLabel}
        {autoSaveCount > 0 && <span className="ml-1 text-green-600">●</span>}
      </button>
      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 w-72 max-h-[400px] overflow-y-auto">
          <div className="p-2 border-b border-gray-100">
            <div className="text-xs text-gray-400 mb-1">Manual save only · full history kept</div>
            {!showSaveInput ? (
              <button
                onClick={() => setShowSaveInput(true)}
                className="w-full text-left px-2 py-1 rounded text-xs font-medium bg-[#507274] text-white hover:bg-[#5e8486]"
              >
                + Save Version
              </button>
            ) : (
              <div className="flex gap-1">
                <input
                  type="text"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder="Version name…"
                  className="flex-1 px-2 py-1 rounded text-xs border border-gray-200"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleManualSave()}
                />
                <button onClick={handleManualSave} className="px-2 py-1 rounded text-xs bg-[#507274] text-white">Save</button>
                <button onClick={() => setShowSaveInput(false)} className="px-2 py-1 rounded text-xs bg-gray-200">✕</button>
              </div>
            )}
          </div>
          {notice && (
            <div className={`px-3 py-2 text-xs border-b ${notice.kind === 'error' ? 'text-red-600 bg-red-50 border-red-100' : 'text-gray-600 bg-gray-50 border-gray-100'}`}>
              {notice.text}
            </div>
          )}
          {versions.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">No versions yet. Saving the prompt records a version.</div>
          )}
          {versions.map(v => (
            <div
              key={v.id}
              onClick={() => handleSelectVersion(v)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-b-0 cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate">{v.change_description}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {v.overall_score != null && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-semibold">
                        {v.overall_score.toFixed(1)}
                      </span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${v.change_type === 'autosave' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                      {v.change_type === 'autosave' ? 'auto' : `v${v.version_number}`}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {new Date(v.created_at).toLocaleString()}
                </div>
              </div>
              <button
                onClick={(e) => handleRestore(e, v)}
                title="Restore this version to left column"
                className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[#507274] text-white hover:bg-[#5e8486] transition-colors"
              >
                ↩
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}