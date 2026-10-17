import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, FileUp } from 'lucide-react';
import { ImportPreview, sqlite } from '../db/sqlite';
import { disk } from '../db/disk';
import { consistency, settings } from '../core/services';
import { shortDate } from '../core/date';
import { useToast } from './components';
import { fireworks } from './fx';

/**
 * Bring data over from the Angular LifeOS (Settings → Export gives a `.sqlite`)
 * or from a previous backup of this app. The file is inspected in a throwaway
 * database first, so you see what's inside before anything is replaced.
 */
export function ImportPanel({ onDone, hasData }: { onDone?: () => void; hasData: boolean }) {
  const toast = useToast();
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; preview: ImportPreview } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(f: File | undefined) {
    if (!f) return;
    setError('');
    setFile(null);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      setFile({ name: f.name, bytes, preview: sqlite.inspectBytes(bytes) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function confirm() {
    if (!file) return;
    setBusy(true);
    try {
      await disk.backup();
      await sqlite.importBytes(file.bytes);
      void disk.refreshInfo();
      settings.apply();
      consistency.recompute();
      fireworks();
      toast('Data imported');
      setFile(null);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const p = file?.preview;
  return (
    <div className="import">
      {!file && (
        <label
          className={`dropzone ${drag ? 'drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void pick(e.dataTransfer.files[0]); }}
        >
          <motion.span className="drop-icon" animate={drag ? { scale: 1.2, y: -4 } : { scale: 1, y: 0 }}><FileUp size={30} /></motion.span>
          <strong>Drop your <code>lifeos.sqlite</code> here</strong>
          <span className="muted">or click to choose a file · .sqlite / .db</span>
          <input type="file" hidden accept=".sqlite,.db,.sqlite3,application/x-sqlite3" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      )}

      {error && <p className="error">{error}</p>}

      {p && (
        <motion.div className="import-preview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p><strong>{file!.name}</strong> contains:</p>
          <div className="preview-grid">
            <span><b>{p.areas}</b> life areas</span>
            <span><b>{p.goals}</b> monthly goals</span>
            <span><b>{p.processes}</b> processes</span>
            <span><b>{p.executions}</b> check-ins</span>
            <span><b>{p.days}</b> scored days</span>
            <span><b>{p.reflections}</b> reflections</span>
          </div>
          {p.firstDate && <p className="muted">From {shortDate(p.firstDate)} {p.firstDate.slice(0, 4)} to {shortDate(p.lastDate!)} {p.lastDate!.slice(0, 4)} · schema v{p.schemaVersion}</p>}
          {hasData && <p className="warn"><AlertTriangle size={16} /> This replaces everything currently in the app. The current data is copied to <code>data/backups</code> first.</p>}
          <div className="row gap end">
            <button className="btn ghost" onClick={() => setFile(null)}>Cancel</button>
            <button className="btn primary" disabled={busy} onClick={confirm}>{busy ? 'Importing…' : 'Import'}</button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function exportDatabase(): void {
  const bytes = sqlite.exportBytes();
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/x-sqlite3' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `lifeos-${new Date().toISOString().slice(0, 10)}.sqlite`;
  a.click();
  URL.revokeObjectURL(url);
}
