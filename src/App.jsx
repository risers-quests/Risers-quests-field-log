import { useState, useEffect, useMemo } from 'react';
import {
  Users, ClipboardList, FileText, Download, Plus, ChevronDown, ChevronRight,
  Flag, Check, Trash2, Loader2, AlertTriangle, Save,
} from 'lucide-react';

const STORAGE_KEY = 'data';
const MAX_KIDS = 12;

const WORLDS = ['Fantasy', 'Adventure', 'Mystery', 'Drama'];
const LEVELS = ['Wanderer', 'Seeker', 'Explorer', 'Pathfinder'];

const DAY_TAGS = {
  1: { label: 'Questioning', hint: 'Deep Dive + Brain Dump', options: ['Skimmed', 'Asked some', 'Followed real threads'] },
  2: { label: 'Skill checkpoint', hint: 'Blueprint + core-skill stage', options: ['Not yet', 'Partial', 'Showed full working'] },
  3: { label: 'Speaks Boldly', hint: 'What If + Leave a Door Open + Present', options: ['Silent', 'Spoke when asked', 'Spoke up unprompted'] },
};

const DIRECTION_OPTIONS = ['Following a path', 'Made some decisions', 'Set own direction'];
const STUCK_OPTIONS = ['No stuck point today', 'Gave up', 'Needed a nudge', 'Pushed through alone'];

const STATUS_META = {
  inProgress: { label: 'In Progress', cls: 'border-amber-500 text-amber-700 bg-amber-50' },
  completed: { label: 'Completed', cls: 'border-emerald-600 text-emerald-700 bg-emerald-50' },
  notCompleted: { label: 'Not Completed', cls: 'border-rose-500 text-rose-700 bg-rose-50' },
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyDayEntry() {
  return {
    direction: null,
    stuckPoint: null,
    dayTagValue: null,
    flag: false,
    nothingStoodOut: false,
    notes: { moment: '', stuckDetail: '', decision: '', flagNote: '' },
    savedAt: null,
  };
}

function newQuestRun(kidId, fields) {
  return {
    id: uid(),
    kidId,
    title: fields.title,
    world: fields.world,
    level: fields.level,
    coreSkill: fields.coreSkill,
    skillCheckpointDescription: fields.skillCheckpointDescription || '',
    status: 'inProgress',
    createdAt: new Date().toISOString(),
    days: { 1: emptyDayEntry(), 2: emptyDayEntry(), 3: emptyDayEntry() },
  };
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

function buildCSV(kids, questRuns) {
  const header = [
    'Riser', 'Quest', 'World', 'Level', 'Core Skill', 'Quest Status',
    'Day', 'Logged', 'Direction', 'Stuck-Point Response', 'Day Tag Label', 'Day Tag Value',
    'Flagged', 'Nothing Stood Out', 'Moment', 'Stuck Detail', 'Decision', 'Flag Note', 'Saved At',
  ];
  const rows = [header];
  questRuns.forEach((qr) => {
    const kid = kids.find((k) => k.id === qr.kidId);
    [1, 2, 3].forEach((day) => {
      const d = qr.days[day];
      rows.push([
        kid ? kid.name : 'Unknown',
        qr.title, qr.world, qr.level, qr.coreSkill,
        STATUS_META[qr.status]?.label || qr.status,
        day, d.savedAt ? 'Yes' : 'No',
        d.direction || '', d.stuckPoint || '',
        DAY_TAGS[day].label, d.dayTagValue || '',
        d.flag ? 'Yes' : 'No', d.nothingStoodOut ? 'Yes' : 'No',
        d.notes.moment, d.notes.stuckDetail, d.notes.decision, d.notes.flagNote,
        d.savedAt || '',
      ]);
    });
  });
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [kids, setKids] = useState([]);
  const [questRuns, setQuestRuns] = useState([]);
  const [tab, setTab] = useState('log');

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setKids(parsed.kids || []);
          setQuestRuns(parsed.questRuns || []);
        }
      } catch (e) {
        // no data saved yet — start empty
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function persist(newKids, newQuestRuns) {
    setKids(newKids);
    setQuestRuns(newQuestRuns);
    setSaving(true);
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify({ kids: newKids, questRuns: newQuestRuns }), false);
      setSaveError(false);
    } catch (e) {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="animate-spin" size={20} />
          <span className="font-mono text-sm">Loading field log...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header tab={tab} setTab={setTab} saving={saving} />
      <main className="max-w-3xl mx-auto px-4 pb-24 pt-4">
        {saveError && (
          <div className="mb-4 border border-rose-300 bg-rose-50 text-rose-700 text-sm px-3 py-2 rounded-sm flex items-center gap-2">
            <AlertTriangle size={16} /> Couldn't save just now. Your changes are kept on screen — try the action again in a moment.
          </div>
        )}
        {tab === 'roster' && <RosterTab kids={kids} questRuns={questRuns} persist={persist} />}
        {tab === 'log' && <LogTab kids={kids} questRuns={questRuns} persist={persist} />}
        {tab === 'reports' && <ReportsTab kids={kids} questRuns={questRuns} />}
        {tab === 'export' && <ExportTab kids={kids} questRuns={questRuns} persist={persist} />}
      </main>
    </div>
  );
}

function Header({ tab, setTab, saving }) {
  const tabs = [
    { id: 'roster', label: 'Risers', icon: Users },
    { id: 'log', label: 'Log', icon: ClipboardList },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'export', label: 'Export', icon: Download },
  ];
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-teal-700">Risers' Quests</p>
            <h1 className="text-xl font-semibold text-slate-900 -mt-0.5">Field Log</h1>
          </div>
          <div className="font-mono text-xs text-slate-400 flex items-center gap-1">
            {saving ? (<><Loader2 size={12} className="animate-spin" /> saving</>) : 'saved'}
          </div>
        </div>
        <nav className="flex gap-1 mt-3 -mb-px overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
                tab === id ? 'border-teal-700 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

function SectionHeading({ title, sub }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {sub && <span className="font-mono text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="border border-dashed border-slate-300 rounded-sm px-4 py-8 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

function RosterTab({ kids, questRuns, persist }) {
  const [name, setName] = useState('');

  function addKid() {
    const trimmed = name.trim();
    if (!trimmed || kids.length >= MAX_KIDS) return;
    persist([...kids, { id: uid(), name: trimmed }], questRuns);
    setName('');
  }

  function removeKid(id) {
    if (!window.confirm('Remove this Riser? Their quest log entries will be removed too.')) return;
    persist(kids.filter((k) => k.id !== id), questRuns.filter((q) => q.kidId !== id));
  }

  return (
    <div>
      <SectionHeading title="Risers" sub={`${kids.length} / ${MAX_KIDS}`} />
      <div className="flex gap-2 mb-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addKid()}
          placeholder="Riser's name"
          disabled={kids.length >= MAX_KIDS}
          className="flex-1 border border-slate-300 rounded-sm px-3 py-2 text-sm bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
        />
        <button
          onClick={addKid}
          disabled={kids.length >= MAX_KIDS || !name.trim()}
          className="px-3 py-2 bg-teal-700 text-white rounded-sm text-sm font-medium disabled:bg-slate-300 flex items-center gap-1"
        >
          <Plus size={16} /> Add
        </button>
      </div>
      {kids.length >= MAX_KIDS && (
        <p className="text-xs text-amber-700 mb-4 font-mono">Roster full — remove a Riser to add another.</p>
      )}
      <div className="space-y-2 mt-4">
        {kids.map((k) => {
          const count = questRuns.filter((q) => q.kidId === k.id).length;
          return (
            <div key={k.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-sm px-3 py-2.5">
              <div>
                <p className="font-medium text-slate-800">{k.name}</p>
                <p className="text-xs text-slate-400 font-mono">{count} quest{count !== 1 ? 's' : ''} logged</p>
              </div>
              <button onClick={() => removeKid(k.id)} className="text-slate-400 hover:text-rose-600 p-1">
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
        {kids.length === 0 && <EmptyState text={`No Risers yet. Add up to ${MAX_KIDS} above to start logging.`} />}
      </div>
    </div>
  );
}

function NewQuestForm({ onCreate, onCancel }) {
  const [title, setTitle] = useState('');
  const [world, setWorld] = useState(WORLDS[0]);
  const [level, setLevel] = useState(LEVELS[2]);
  const [coreSkill, setCoreSkill] = useState('');
  const [checkpointDesc, setCheckpointDesc] = useState('');

  function submit() {
    if (!title.trim() || !coreSkill.trim()) return;
    onCreate({
      title: title.trim(), world, level, coreSkill: coreSkill.trim(),
      skillCheckpointDescription: checkpointDesc.trim(),
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-sm p-4 mb-4 space-y-3">
      <p className="font-mono text-xs uppercase tracking-wide text-slate-400">New Quest</p>
      <input
        value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quest title"
        className="w-full border border-slate-300 rounded-sm px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <select value={world} onChange={(e) => setWorld(e.target.value)} className="border border-slate-300 rounded-sm px-2 py-2 text-sm bg-white">
          {WORLDS.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="border border-slate-300 rounded-sm px-2 py-2 text-sm bg-white">
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <input
        value={coreSkill} onChange={(e) => setCoreSkill(e.target.value)} placeholder="Core skill (e.g. Ratio and Proportion)"
        className="w-full border border-slate-300 rounded-sm px-3 py-2 text-sm"
      />
      <input
        value={checkpointDesc} onChange={(e) => setCheckpointDesc(e.target.value)}
        placeholder="What does the skill checkpoint look like? (optional, e.g. 'Showed full working')"
        className="w-full border border-slate-300 rounded-sm px-3 py-2 text-sm"
      />
      <div className="flex gap-2 justify-end">
        {onCancel && <button onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-500">Cancel</button>}
        <button onClick={submit} className="px-3 py-1.5 bg-teal-700 text-white rounded-sm text-sm font-medium">Start Quest</button>
      </div>
    </div>
  );
}

function TagGroup({ label, hint, options, value, onChange }) {
  return (
    <div>
      <p className="text-xs font-mono uppercase tracking-wide text-slate-500 mb-1.5">
        {label} {hint && <span className="normal-case text-slate-400">— {hint}</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1.5 rounded-sm text-sm border ${
              value === opt ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function NoteField({ label, value, onChange }) {
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full border border-slate-300 rounded-sm px-2.5 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-600"
      />
    </div>
  );
}

function StatusStamp({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[status];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`font-mono text-[11px] uppercase tracking-wider border-2 px-2 py-1 rounded-sm rotate-1 ${meta.cls}`}
      >
        {meta.label}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-sm shadow-sm z-10 w-36">
          {Object.entries(STATUS_META).map(([key, m]) => (
            <button
              key={key}
              onClick={() => { onChange(key); setOpen(false); }}
              className="block w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestEditor({ quest, day, onChangeDay, setStatus, saveDay, markDirty, markClean }) {
  const [entry, setEntry] = useState(quest.days[day]);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setEntry(quest.days[day]);
    setJustSaved(false);
  }, [quest.id, day]);

  function set(field, value) {
    setEntry((e) => ({ ...e, [field]: value }));
    markDirty();
  }
  function setNote(field, value) {
    setEntry((e) => ({ ...e, notes: { ...e.notes, [field]: value } }));
    markDirty();
  }

  function handleSave() {
    const savedEntry = { ...entry, savedAt: new Date().toISOString() };
    setEntry(savedEntry);
    saveDay(day, savedEntry);
    markClean();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  const dayTag = DAY_TAGS[day];

  return (
    <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3">
        <div>
          <p className="font-semibold text-slate-900">{quest.title}</p>
          <p className="text-xs text-slate-400 font-mono">{quest.world} · {quest.level} · {quest.coreSkill}</p>
        </div>
        <StatusStamp status={quest.status} onChange={setStatus} />
      </div>

      <div className="flex gap-1 px-4 mt-3 border-b border-slate-100">
        {[1, 2, 3].map((d) => (
          <button
            key={d}
            onClick={() => onChangeDay(d)}
            className={`px-3 py-2 text-sm font-mono border-b-2 flex items-center gap-1 ${
              day === d ? 'border-teal-700 text-teal-700' : 'border-transparent text-slate-400'
            }`}
          >
            Day {d} {quest.days[d].savedAt && <Check size={11} />}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-5">
        <TagGroup label="Direction" options={DIRECTION_OPTIONS} value={entry.direction} onChange={(v) => set('direction', v)} />
        <TagGroup label="Stuck-point response" options={STUCK_OPTIONS} value={entry.stuckPoint} onChange={(v) => set('stuckPoint', v)} />
        <TagGroup label={dayTag.label} hint={dayTag.hint} options={dayTag.options} value={entry.dayTagValue} onChange={(v) => set('dayTagValue', v)} />

        {quest.skillCheckpointDescription && day === 2 && (
          <p className="text-xs text-slate-400 -mt-3">For this quest: {quest.skillCheckpointDescription}</p>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={entry.flag} onChange={(e) => set('flag', e.target.checked)} className="accent-teal-700" />
          <Flag size={14} className={entry.flag ? 'text-amber-600' : 'text-slate-300'} /> Flag for follow-up
        </label>

        <div className="border-t border-slate-100 pt-4">
          <label className="flex items-center gap-2 text-sm text-slate-600 mb-3">
            <input type="checkbox" checked={entry.nothingStoodOut} onChange={(e) => set('nothingStoodOut', e.target.checked)} className="accent-teal-700" />
            Nothing stood out today
          </label>

          {!entry.nothingStoodOut && (
            <div className="space-y-3">
              <NoteField label="A specific moment worth telling a parent" value={entry.notes.moment} onChange={(v) => setNote('moment', v)} />
              <NoteField label="Where they got stuck, and what happened next" value={entry.notes.stuckDetail} onChange={(v) => setNote('stuckDetail', v)} />
              <NoteField label="A decision that shows their thinking" value={entry.notes.decision} onChange={(v) => setNote('decision', v)} />
              <NoteField label="Anything to flag" value={entry.notes.flagNote} onChange={(v) => setNote('flagNote', v)} />
              <p className="text-xs text-slate-400">Fill whichever apply — none are required.</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} className="px-4 py-2 bg-teal-700 text-white rounded-sm text-sm font-medium flex items-center gap-1.5">
            <Save size={15} /> Save Day {day}
          </button>
          {justSaved && <span className="text-xs text-emerald-600 font-mono">Saved</span>}
          {!justSaved && entry.savedAt && (
            <span className="text-xs text-slate-400 font-mono">Last saved {new Date(entry.savedAt).toLocaleString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function LogTab({ kids, questRuns, persist }) {
  const [selectedKidId, setSelectedKidId] = useState(kids[0]?.id || null);
  const [selectedQuestId, setSelectedQuestId] = useState(null);
  const [day, setDay] = useState(1);
  const [showNewQuest, setShowNewQuest] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!selectedKidId && kids.length) setSelectedKidId(kids[0].id);
  }, [kids]);

  const kidQuests = useMemo(
    () => questRuns.filter((q) => q.kidId === selectedKidId),
    [questRuns, selectedKidId]
  );

  useEffect(() => {
    setSelectedQuestId(kidQuests[0]?.id || null);
    setDay(1);
    setShowNewQuest(kidQuests.length === 0);
    setDirty(false);
    // eslint-disable-next-line
  }, [selectedKidId]);

  const activeQuest = kidQuests.find((q) => q.id === selectedQuestId) || null;

  function guarded(action) {
    if (dirty && !window.confirm('You have unsaved changes for this entry. Discard them?')) return;
    setDirty(false);
    action();
  }

  function createQuest(fields) {
    const qr = newQuestRun(selectedKidId, fields);
    persist(kids, [...questRuns, qr]);
    setSelectedQuestId(qr.id);
    setShowNewQuest(false);
    setDay(1);
  }

  function updateQuest(id, updater) {
    const next = questRuns.map((q) => (q.id === id ? updater(q) : q));
    persist(kids, next);
  }

  function setStatus(status) {
    updateQuest(activeQuest.id, (q) => ({ ...q, status }));
  }

  function saveDay(dayNum, entry) {
    updateQuest(activeQuest.id, (q) => ({ ...q, days: { ...q.days, [dayNum]: entry } }));
  }

  if (kids.length === 0) {
    return <EmptyState text="Add Risers in the Risers tab first." />;
  }

  return (
    <div>
      <SectionHeading title="Daily Log" />
      <div className="flex gap-2 flex-wrap mb-4">
        {kids.map((k) => (
          <button
            key={k.id}
            onClick={() => guarded(() => setSelectedKidId(k.id))}
            className={`px-3 py-1.5 rounded-sm text-sm border ${
              selectedKidId === k.id ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-slate-600 border-slate-300'
            }`}
          >
            {k.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        {kidQuests.map((q) => (
          <button
            key={q.id}
            onClick={() => guarded(() => { setSelectedQuestId(q.id); setShowNewQuest(false); setDay(1); })}
            className={`px-2.5 py-1 rounded-sm text-xs font-mono border ${
              selectedQuestId === q.id && !showNewQuest ? 'border-teal-700 text-teal-700 bg-teal-50' : 'border-slate-300 text-slate-500 bg-white'
            }`}
          >
            {q.title}
          </button>
        ))}
        <button
          onClick={() => guarded(() => setShowNewQuest(true))}
          className="px-2.5 py-1 rounded-sm text-xs font-mono border border-dashed border-slate-400 text-slate-500 flex items-center gap-1"
        >
          <Plus size={12} /> New quest
        </button>
      </div>

      {showNewQuest && (
        <NewQuestForm onCreate={createQuest} onCancel={kidQuests.length ? () => setShowNewQuest(false) : null} />
      )}

      {!showNewQuest && activeQuest && (
        <QuestEditor
          quest={activeQuest}
          day={day}
          onChangeDay={(d) => guarded(() => setDay(d))}
          setStatus={setStatus}
          saveDay={saveDay}
          markDirty={() => setDirty(true)}
          markClean={() => setDirty(false)}
        />
      )}
    </div>
  );
}

function Chip({ children, className = '' }) {
  return (
    <span className={`font-mono text-[11px] border border-slate-300 text-slate-600 px-1.5 py-0.5 rounded-sm ${className}`}>
      {children}
    </span>
  );
}

function DayReport({ day, entry }) {
  const dayTag = DAY_TAGS[day];
  if (!entry.savedAt) {
    return (
      <div>
        <p className="text-xs font-mono uppercase text-slate-400">Day {day}</p>
        <p className="text-sm text-slate-300 italic">Not logged</p>
      </div>
    );
  }
  const noteEntries = [
    ['Moment', entry.notes.moment],
    ['Stuck point', entry.notes.stuckDetail],
    ['Decision', entry.notes.decision],
    ['Flag note', entry.notes.flagNote],
  ].filter(([, v]) => v && v.trim());

  return (
    <div>
      <p className="text-xs font-mono uppercase text-slate-400 mb-1">Day {day}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {entry.direction && <Chip>{entry.direction}</Chip>}
        {entry.stuckPoint && <Chip>{entry.stuckPoint}</Chip>}
        {entry.dayTagValue && <Chip>{dayTag.label}: {entry.dayTagValue}</Chip>}
        {entry.flag && <Chip className="border-amber-500 text-amber-700">Flagged</Chip>}
      </div>
      {entry.nothingStoodOut && <p className="text-sm text-slate-400 italic">Nothing stood out today.</p>}
      {!entry.nothingStoodOut && noteEntries.length === 0 && <p className="text-sm text-slate-300 italic">No notes added.</p>}
      {!entry.nothingStoodOut && noteEntries.length > 0 && (
        <dl className="space-y-1.5">
          {noteEntries.map(([label, val]) => (
            <div key={label}>
              <dt className="text-xs text-slate-400">{label}</dt>
              <dd className="text-sm text-slate-700">{val}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function QuestReportCard({ quest }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[quest.status];
  return (
    <div className="bg-white border border-slate-200 rounded-sm">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div>
          <p className="font-medium text-slate-800">{quest.title}</p>
          <p className="text-xs text-slate-400 font-mono">{quest.world} · {quest.level} · {quest.coreSkill}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-[10px] uppercase tracking-wider border-2 px-1.5 py-0.5 rounded-sm rotate-1 ${meta.cls}`}>{meta.label}</span>
          {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-4">
          {[1, 2, 3].map((d) => <DayReport key={d} day={d} entry={quest.days[d]} />)}
        </div>
      )}
    </div>
  );
}

function OverviewTable({ kids, questRuns, selectedKidId, onSelect }) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm mb-4 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs font-mono uppercase text-slate-400">
            <th className="px-3 py-2">Riser</th>
            <th className="px-3 py-2 text-center">Done</th>
            <th className="px-3 py-2 text-center">Active</th>
            <th className="px-3 py-2 text-center">Not Done</th>
          </tr>
        </thead>
        <tbody>
          {kids.map((k) => {
            const qs = questRuns.filter((q) => q.kidId === k.id);
            const done = qs.filter((q) => q.status === 'completed').length;
            const active = qs.filter((q) => q.status === 'inProgress').length;
            const notDone = qs.filter((q) => q.status === 'notCompleted').length;
            return (
              <tr
                key={k.id}
                onClick={() => onSelect(k.id)}
                className={`border-t border-slate-100 cursor-pointer ${selectedKidId === k.id ? 'bg-teal-50' : ''}`}
              >
                <td className="px-3 py-2 font-medium">{k.name}</td>
                <td className="px-3 py-2 text-center font-mono text-emerald-700">{done}</td>
                <td className="px-3 py-2 text-center font-mono text-amber-700">{active}</td>
                <td className="px-3 py-2 text-center font-mono text-rose-700">{notDone}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KidReport({ kid, questRuns }) {
  if (questRuns.length === 0) return <EmptyState text={`No quests logged for ${kid.name} yet.`} />;
  return (
    <div className="space-y-2">
      {questRuns.map((q) => <QuestReportCard key={q.id} quest={q} />)}
    </div>
  );
}

function ReportsTab({ kids, questRuns }) {
  const [selectedKidId, setSelectedKidId] = useState(kids[0]?.id || null);
  useEffect(() => { if (!selectedKidId && kids.length) setSelectedKidId(kids[0].id); }, [kids]);

  if (kids.length === 0) return <EmptyState text="Add Risers in the Risers tab first." />;

  const selectedKid = kids.find((k) => k.id === selectedKidId);

  return (
    <div>
      <SectionHeading title="Reports" />
      <OverviewTable kids={kids} questRuns={questRuns} selectedKidId={selectedKidId} onSelect={setSelectedKidId} />
      {selectedKid && (
        <>
          <p className="text-sm font-medium text-slate-700 mb-2">{selectedKid.name}'s quests</p>
          <KidReport kid={selectedKid} questRuns={questRuns.filter((q) => q.kidId === selectedKidId)} />
        </>
      )}
    </div>
  );
}

function ExportTab({ kids, questRuns, persist }) {
  function exportCSV() {
    downloadFile(buildCSV(kids, questRuns), `risers-quests-field-log-${dateStamp()}.csv`, 'text/csv');
  }
  function exportJSON() {
    const json = JSON.stringify({ exportedAt: new Date().toISOString(), kids, questRuns }, null, 2);
    downloadFile(json, `risers-quests-field-log-${dateStamp()}.json`, 'application/json');
  }
  function clearAll() {
    if (!window.confirm('This deletes every Riser and quest log entry. This cannot be undone. Continue?')) return;
    persist([], []);
  }

  return (
    <div className="space-y-4">
      <SectionHeading title="Export" />
      <div className="bg-white border border-slate-200 rounded-sm p-4">
        <p className="text-sm text-slate-600 mb-3">
          Every Riser, quest, tag, and note — as a file you keep. CSV opens straight in Sheets or Excel.
          JSON keeps the full structure, useful if this feeds another tool later.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCSV} className="px-4 py-2 bg-teal-700 text-white rounded-sm text-sm font-medium flex items-center gap-1.5">
            <Download size={15} /> Export CSV
          </button>
          <button onClick={exportJSON} className="px-4 py-2 bg-slate-700 text-white rounded-sm text-sm font-medium flex items-center gap-1.5">
            <Download size={15} /> Export JSON
          </button>
        </div>
      </div>
      <div className="bg-white border border-rose-200 rounded-sm p-4">
        <p className="text-sm text-slate-600 mb-3">Clear everything stored in this tool. Export first if you want to keep a copy.</p>
        <button onClick={clearAll} className="px-4 py-2 border border-rose-400 text-rose-600 rounded-sm text-sm font-medium">
          Clear all data
        </button>
      </div>
    </div>
  );
}
