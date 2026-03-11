import { useState, useCallback, useEffect, useRef } from "react";

// ── FONTS ────────────────────────────────────────────────────────────────────
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap";

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "tpm", label: "Technical Program Management", emoji: "🗂️", color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE" },
  { id: "incident", label: "Incident Management", emoji: "🚨", color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" },
  { id: "privacy", label: "User Privacy", emoji: "🔒", color: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE" },
  { id: "llms", label: "LLMs & AI", emoji: "🤖", color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
];

const DEFAULT_QUESTIONS = {
  tpm: [
    { id: "tpm1", tier: "warm", type: "behavioral", question: "Tell me about a time you drove a cross-functional program with multiple competing priorities.", answer: null, customAnswer: null },
    { id: "tpm2", tier: "mid", type: "behavioral", question: "Describe a program that failed or significantly slipped. What did you do and what did you learn?", answer: null, customAnswer: null },
    { id: "tpm3", tier: "warm", type: "situational", question: "An engineering team tells you a key dependency will be 6 weeks late. You have a launch date locked. What do you do?", answer: null, customAnswer: null },
    { id: "tpm4", tier: "final", type: "behavioral", question: "How do you manage stakeholders who have conflicting priorities for your program?", answer: null, customAnswer: null },
    { id: "tpm5", tier: "mid", type: "situational", question: "You're handed a program with no clear owner, unclear scope, and a deadline in 10 weeks. What are your first 30 days?", answer: null, customAnswer: null },
  ],
  incident: [
    { id: "inc1", tier: "warm", type: "behavioral", question: "Walk me through a major incident you managed end-to-end.", answer: null, customAnswer: null },
    { id: "inc2", tier: "mid", type: "situational", question: "Your on-call engineer is overwhelmed and the incident is spreading. What do you do as the TPM?", answer: null, customAnswer: null },
    { id: "inc3", tier: "final", type: "behavioral", question: "Describe how you ran a post-mortem and what changed as a result.", answer: null, customAnswer: null },
    { id: "inc4", tier: "warm", type: "situational", question: "How do you communicate during an active P0 incident to leadership asking for constant updates?", answer: null, customAnswer: null },
  ],
  privacy: [
    { id: "priv1", tier: "warm", type: "behavioral", question: "Tell me about a time you had to balance product velocity with user privacy requirements.", answer: null, customAnswer: null },
    { id: "priv2", tier: "mid", type: "situational", question: "A new ML feature requires logging more user data than currently collected. Privacy hasn't been consulted. What do you do?", answer: null, customAnswer: null },
    { id: "priv3", tier: "final", type: "behavioral", question: "How have you operationalized GDPR or CCPA requirements inside a program you managed?", answer: null, customAnswer: null },
  ],
  llms: [
    { id: "llm1", tier: "warm", type: "behavioral", question: "How have you incorporated LLMs or AI tools into a program or workflow you managed?", answer: null, customAnswer: null },
    { id: "llm2", tier: "mid", type: "situational", question: "You're asked to manage a program delivering an LLM-powered feature. What risks do you put on your radar from Day 1?", answer: null, customAnswer: null },
    { id: "llm3", tier: "final", type: "concept", question: "How would you explain the difference between RAG and fine-tuning to a non-technical stakeholder?", answer: null, customAnswer: null },
    { id: "llm4", tier: "mid", type: "situational", question: "Your LLM feature is hallucinating ~5% of the time in prod. The PM wants to ship. What do you do?", answer: null, customAnswer: null },
  ],
};

const ASK_THEM = {
  tpm: ["What does success look like for a TPM in their first 90 days here?", "How does the TPM org interact with SWE and PM orgs day-to-day?", "What's the biggest program failure this team has had in the last year?", "How are OKRs set for programs that span multiple teams?", "What does escalation culture look like here?"],
  incident: ["How mature is the incident management process here?", "Who holds the pager for a P0?", "How does the TPM role show up during a live incident vs. post-incident review?", "What's the last major incident that changed how you build or monitor systems?"],
  privacy: ["How early does Privacy review get pulled into the product development cycle?", "Is there a Privacy champion model on engineering teams?", "How did this team handle GDPR or CCPA compliance?", "What's your philosophy on data minimization vs. data collection for ML features?"],
  llms: ["What's the current AI/LLM strategy — building internal models, fine-tuning, or API-first?", "How do you think about responsible AI and hallucination risk?", "What's the evaluation framework for LLM features?", "How does the TPM role interact with ML engineers and researchers?"],
};

const TIER_META = { warm: { label: "Warm-Up", color: "#15803D" }, mid: { label: "Mid-Loop", color: "#B45309" }, final: { label: "Final Round", color: "#B91C1C" } };
const RATING_OPTIONS = [
  { value: "nailed", label: "✓ Nailed it", color: "#15803D", bg: "#F0FDF4", border: "#86EFAC" },
  { value: "almost", label: "↗ Almost", color: "#B45309", bg: "#FFFBEB", border: "#FCD34D" },
  { value: "reps", label: "↺ Need reps", color: "#B91C1C", bg: "#FEF2F2", border: "#FCA5A5" },
];

// ── CLAUDE API ────────────────────────────────────────────────────────────────
async function callClaude(prompt, systemPrompt = "") {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt || "You are an expert interview coach specializing in Google TPM interviews. Be specific, practical, and use STAR format where appropriate.",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await response.json();
  return data.content?.[0]?.text || "";
}

// ── GOOGLE DRIVE ──────────────────────────────────────────────────────────────
async function saveToGoogleDrive(data, tool_call) {
  // Placeholder: in production this would use the Google Drive MCP
  // For now we use the persistent storage API
  try {
    await window.storage.set("tpm_coach_data", JSON.stringify(data));
  } catch (e) { console.warn("Storage save failed", e); }
}

async function loadFromGoogleDrive() {
  try {
    const result = await window.storage.get("tpm_coach_data");
    return result ? JSON.parse(result.value) : null;
  } catch (e) { return null; }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }

function getNextQuestion(questions, ratings) {
  const reps = questions.filter(q => ratings[q.id] === "reps");
  const unseen = questions.filter(q => !ratings[q.id]);
  const almost = questions.filter(q => ratings[q.id] === "almost");
  const pool = reps.length ? reps : unseen.length ? unseen : almost.length ? almost : questions;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getTotalXP(ratings) {
  return Object.values(ratings).reduce((a, r) => a + (r === "nailed" ? 30 : r === "almost" ? 10 : r === "reps" ? 5 : 0), 0);
}

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────
function Tag({ children, color, bg, border }) {
  return <span style={{ fontSize: 10.5, fontWeight: 600, color, background: bg, border: `1px solid ${border || color + "30"}`, padding: "2px 8px", borderRadius: 20, fontFamily: "DM Mono, monospace", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{children}</span>;
}

function Btn({ children, onClick, variant = "primary", color, small, full, disabled, style: extra = {} }) {
  const base = { border: "none", borderRadius: 10, fontFamily: "DM Sans, sans-serif", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "all 0.15s", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 };
  const sizes = small ? { fontSize: 12.5, padding: "7px 13px" } : { fontSize: 14, padding: "11px 18px" };
  const variants = {
    primary: { background: color || "#111827", color: "#fff" },
    secondary: { background: "#F3F4F6", color: "#374151", border: "1.5px solid #E5E7EB" },
    ghost: { background: "transparent", color: color || "#374151", border: `1.5px solid ${color ? color + "40" : "#E5E7EB"}` },
    danger: { background: "#FEF2F2", color: "#B91C1C", border: "1.5px solid #FECACA" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...sizes, ...variants[variant], width: full ? "100%" : "auto", ...extra }}>{children}</button>;
}

function ProgressBar({ pct, color }) {
  return (
    <div style={{ height: 5, background: "#F3F4F6", borderRadius: 5, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 5, transition: "width 0.6s ease" }} />
    </div>
  );
}

function ProgressRing({ pct, color, size = 48 }) {
  const r = 19, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="#F3F4F6" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round" transform="rotate(-90 22 22)"
        style={{ transition: "stroke-dashoffset 0.7s ease" }} />
      <text x="22" y="26.5" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={color} fontFamily="DM Mono, monospace">{pct}%</text>
    </svg>
  );
}

function StarCard({ label, short, color, content }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: color + "15", border: `1.5px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color, fontFamily: "DM Mono, monospace" }}>{short}</span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "DM Mono, monospace", marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.65 }}>{content}</div>
      </div>
    </div>
  );
}

function StarAnswer({ answer }) {
  if (!answer) return null;
  if (typeof answer === "string") return <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.7, background: "#F9FAFB", borderRadius: 10, padding: "14px 16px", border: "1px solid #E5E7EB" }}>{answer}</div>;
  const parts = [
    { key: "situation", label: "Situation", short: "S", color: "#1D4ED8" },
    { key: "task", label: "Task", short: "T", color: "#6D28D9" },
    { key: "action", label: "Action", short: "A", color: "#065F46" },
    { key: "result", label: "Result", short: "R", color: "#B45309" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {parts.filter(p => answer[p.key]).map(p => <StarCard key={p.key} {...p} content={answer[p.key]} />)}
    </div>
  );
}

function Spinner({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="40" strokeLinecap="round" />
    </svg>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 520, maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{title}</div>
          <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 16, color: "#6B7280" }}>×</button>
        </div>
        <div style={{ padding: "20px" }}>{children}</div>
      </div>
    </div>
  );
}

// ── PROFILE SETUP ─────────────────────────────────────────────────────────────
function ProfileSetup({ profile, onSave }) {
  const [name, setName] = useState(profile?.name || "");
  const [role, setRole] = useState(profile?.role || "");
  const [linkedin, setLinkedin] = useState(profile?.linkedin || "");
  const [resumeText, setResumeText] = useState(profile?.resumeText || "");
  const [saving, setSaving] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setResumeText(ev.target.result);
    reader.readAsText(file);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ name, role, linkedin, resumeText });
    setSaving(false);
  };

  const label = { fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5, display: "block", fontFamily: "DM Mono, monospace", letterSpacing: "0.05em" };
  const input = { width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontFamily: "DM Sans, sans-serif", color: "#111827", background: "#FAFAFA", boxSizing: "border-box", outline: "none" };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.12em", fontFamily: "DM Mono, monospace", marginBottom: 6 }}>YOUR PROFILE</div>
        <div style={{ fontSize: 26, fontWeight: 400, color: "#0F172A", fontFamily: "Instrument Serif, Georgia, serif", lineHeight: 1.2, marginBottom: 6 }}>Let's personalize your prep</div>
        <div style={{ fontSize: 14, color: "#6B7280" }}>Your info is used to generate answers tailored to your background. Saved to Google Drive.</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>YOUR NAME</label>
            <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alex Kim" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>TARGET ROLE</label>
            <input style={input} value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Senior TPM, Google" />
          </div>
        </div>

        <div>
          <label style={label}>LINKEDIN URL</label>
          <input style={input} value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/yourprofile" />
          <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 4 }}>Paste your LinkedIn About section below if you want richer answer generation</div>
        </div>

        <div>
          <label style={label}>RESUME — PASTE TEXT OR UPLOAD FILE</label>
          <textarea style={{ ...input, minHeight: 140, resize: "vertical", lineHeight: 1.6 }}
            value={resumeText} onChange={e => setResumeText(e.target.value)}
            placeholder="Paste your resume text here, or upload a file below..." />
          <div style={{ marginTop: 8 }}>
            <input type="file" accept=".txt,.pdf" onChange={handleFile} style={{ fontSize: 12.5, color: "#6B7280" }} />
          </div>
        </div>

        <Btn onClick={handleSave} disabled={saving || !name} full>
          {saving ? <><Spinner /> Saving...</> : "Save Profile →"}
        </Btn>
      </div>
    </div>
  );
}

// ── QUESTION CARD ─────────────────────────────────────────────────────────────
function QuestionCard({ question, catColor, rating, onRate, onEdit, onDelete, onGenerateAnswer, profile, isJobPrep = false }) {
  const [revealed, setRevealed] = useState(false);
  const [editingQ, setEditingQ] = useState(false);
  const [editingA, setEditingA] = useState(false);
  const [qText, setQText] = useState(question.question);
  const [aText, setAText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showAskThem, setShowAskThem] = useState(false);

  const displayAnswer = question.customAnswer || question.answer;

  const handleGenerateAnswer = async () => {
    setGenerating(true);
    setRevealed(true);
    const answer = await onGenerateAnswer(question);
    setGenerating(false);
  };

  const handleSaveQ = () => { onEdit(question.id, { question: qText }); setEditingQ(false); };
  const handleSaveA = () => { onEdit(question.id, { customAnswer: aText }); setEditingA(false); };

  const startEditA = () => {
    const raw = question.customAnswer || question.answer;
    if (typeof raw === "object" && raw !== null) {
      setAText(JSON.stringify(raw, null, 2));
    } else {
      setAText(raw || "");
    }
    setEditingA(true);
  };

  const ratingOpt = RATING_OPTIONS.find(r => r.value === rating);
  const tierMeta = TIER_META[question.tier];

  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
      {/* Header row */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {tierMeta && <Tag color={tierMeta.color} bg={tierMeta.color + "12"} border={tierMeta.color + "30"}>{tierMeta.label.toUpperCase()}</Tag>}
        <Tag color="#6B7280" bg="#F9FAFB" border="#E5E7EB">
          {question.type === "behavioral" ? "🧠 Behavioral" : question.type === "situational" ? "💡 Situational" : question.type === "concept" ? "📖 Concept" : "⭐ Custom"}
        </Tag>
        {ratingOpt && <Tag color={ratingOpt.color} bg={ratingOpt.bg} border={ratingOpt.border}>{ratingOpt.label}</Tag>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={() => setEditingQ(!editingQ)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#9CA3AF", padding: "2px 4px" }} title="Edit question">✎</button>
          <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#FCA5A5", padding: "2px 4px" }} title="Delete">×</button>
        </div>
      </div>

      <div style={{ padding: "18px 16px" }}>
        {editingQ ? (
          <div style={{ marginBottom: 14 }}>
            <textarea value={qText} onChange={e => setQText(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #2563EB", borderRadius: 10, fontSize: 14, fontFamily: "DM Sans, sans-serif", resize: "vertical", minHeight: 80, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Btn small onClick={handleSaveQ} color="#2563EB" variant="ghost">Save</Btn>
              <Btn small onClick={() => setEditingQ(false)} variant="secondary">Cancel</Btn>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 15.5, fontWeight: 500, color: "#111827", lineHeight: 1.6, fontFamily: "Instrument Serif, Georgia, serif", marginBottom: 16 }}>
            {question.question}
          </div>
        )}

        {!revealed && !displayAnswer && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn onClick={() => { setRevealed(true); if (!displayAnswer && !question.answer) handleGenerateAnswer(); }} color={catColor} style={{ flex: 1 }}>
              {profile?.resumeText ? "Generate My Answer →" : "Show Model Answer →"}
            </Btn>
          </div>
        )}

        {(revealed || displayAnswer) && (
          <div>
            {generating ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", color: "#6B7280", padding: "16px 0" }}>
                <Spinner /> <span style={{ fontSize: 13.5 }}>Crafting your STAR answer...</span>
              </div>
            ) : (
              <div>
                {editingA ? (
                  <div>
                    <textarea value={aText} onChange={e => setAText(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #2563EB", borderRadius: 10, fontSize: 13, fontFamily: "DM Mono, monospace", resize: "vertical", minHeight: 160, boxSizing: "border-box", lineHeight: 1.6 }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <Btn small onClick={handleSaveA} color="#2563EB" variant="ghost">Save</Btn>
                      <Btn small onClick={() => setEditingA(false)} variant="secondary">Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  <div>
                    <StarAnswer answer={displayAnswer} />
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <Btn small onClick={startEditA} variant="ghost" color="#6B7280">✎ Edit answer</Btn>
                      {profile?.resumeText && <Btn small onClick={handleGenerateAnswer} variant="ghost" color="#2563EB">↺ Regenerate</Btn>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!generating && !editingA && (
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #F3F4F6" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.1em", marginBottom: 8, fontFamily: "DM Mono, monospace" }}>HOW DID YOU DO?</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {RATING_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => onRate(question.id, opt.value)}
                      style={{ flex: 1, padding: "9px 6px", borderRadius: 10, border: `1.5px solid ${rating === opt.value ? opt.color : opt.border}`, background: rating === opt.value ? opt.bg : "#FAFAFA", color: rating === opt.value ? opt.color : "#9CA3AF", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s", fontFamily: "DM Sans, sans-serif" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── CORE PREP TAB ─────────────────────────────────────────────────────────────
function CorePrepTab({ questions, ratings, profile, onRate, onEditQuestion, onDeleteQuestion, onAddQuestion, onGenerateAnswer }) {
  const [activeCat, setActiveCat] = useState(null);
  const [showAskThem, setShowAskThem] = useState(false);
  const [addingQ, setAddingQ] = useState(false);
  const [newQ, setNewQ] = useState("");
  const [newTier, setNewTier] = useState("warm");
  const [newType, setNewType] = useState("behavioral");
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceQ, setPracticeQ] = useState(null);
  const [practiceKey, setPracticeKey] = useState(0);

  const cat = CATEGORIES.find(c => c.id === activeCat);
  const catQs = activeCat ? (questions[activeCat] || []) : [];
  const nailed = catQs.filter(q => ratings[q.id] === "nailed").length;
  const pct = catQs.length ? Math.round((nailed / catQs.length) * 100) : 0;
  const needReps = catQs.filter(q => ratings[q.id] === "reps").length;

  const handleAddQ = () => {
    if (!newQ.trim()) return;
    onAddQuestion(activeCat, { id: uid(), tier: newTier, type: newType, question: newQ.trim(), answer: null, customAnswer: null });
    setNewQ(""); setAddingQ(false);
  };

  const startPractice = () => {
    setPracticeQ(getNextQuestion(catQs, ratings));
    setPracticeKey(k => k + 1);
    setPracticeMode(true);
  };

  const nextPractice = () => {
    setPracticeQ(getNextQuestion(catQs, ratings));
    setPracticeKey(k => k + 1);
  };

  if (!activeCat) {
    const totalXP = getTotalXP(ratings);
    const totalNailed = Object.values(ratings).filter(r => r === "nailed").length;
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.12em", fontFamily: "DM Mono, monospace", marginBottom: 6 }}>CORE PREP</div>
          <div style={{ fontSize: 26, fontWeight: 400, color: "#0F172A", fontFamily: "Instrument Serif, Georgia, serif", lineHeight: 1.2 }}>Your foundation, always ready.</div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          {[{ val: totalXP, label: "XP", color: "#1D4ED8" }, { val: totalNailed, label: "Nailed", color: "#15803D" }, { val: Object.values(ratings).filter(r => r === "reps").length, label: "Need Reps", color: "#B91C1C" }].map(({ val, label, color }) => (
            <div key={label} style={{ flex: 1, background: "#fff", borderRadius: 14, padding: "14px 10px", textAlign: "center", border: "1.5px solid #E5E7EB", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "DM Mono, monospace" }}>{val}</div>
              <div style={{ fontSize: 10.5, color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.06em", marginTop: 2 }}>{label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.12em", marginBottom: 12, fontFamily: "DM Mono, monospace" }}>CATEGORIES</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CATEGORIES.map(cat => {
            const qs = questions[cat.id] || [];
            const nailed = qs.filter(q => ratings[q.id] === "nailed").length;
            const pct = qs.length ? Math.round((nailed / qs.length) * 100) : 0;
            const reps = qs.filter(q => ratings[q.id] === "reps").length;
            return (
              <div key={cat.id} style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB", padding: "16px", boxShadow: "0 1px 8px rgba(0,0,0,0.04)", cursor: "pointer" }} onClick={() => setActiveCat(cat.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{cat.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{cat.label}</div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}>{qs.length} questions · {nailed} nailed</div>
                    {reps > 0 && <div style={{ fontSize: 11, color: "#B91C1C", fontWeight: 700, marginTop: 2 }}>⚡ {reps} need reps</div>}
                  </div>
                  <ProgressRing pct={pct} color={cat.color} />
                </div>
                <ProgressBar pct={pct} color={cat.color} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={() => { setActiveCat(null); setPracticeMode(false); }} style={{ width: 36, height: 36, borderRadius: 10, background: "#F9FAFB", border: "1.5px solid #E5E7EB", fontSize: 15, cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{cat.emoji} {cat.label}</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>{nailed}/{catQs.length} nailed · {needReps} need reps</div>
        </div>
        <ProgressRing pct={pct} color={cat.color} />
      </div>
      <ProgressBar pct={pct} color={cat.color} />
      <div style={{ height: 16 }} />

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button onClick={() => setPracticeMode(false)} style={{ flex: 1, padding: "9px", borderRadius: 10, border: `1.5px solid ${!practiceMode ? cat.color : "#E5E7EB"}`, background: !practiceMode ? cat.color + "10" : "#F9FAFB", color: !practiceMode ? cat.color : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>All Questions</button>
        <button onClick={startPractice} style={{ flex: 1, padding: "9px", borderRadius: 10, border: `1.5px solid ${practiceMode ? cat.color : "#E5E7EB"}`, background: practiceMode ? cat.color : "#F9FAFB", color: practiceMode ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>⚡ Practice Mode</button>
        <button onClick={() => setShowAskThem(s => !s)} style={{ padding: "9px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", background: showAskThem ? "#F0FDF4" : "#F9FAFB", color: showAskThem ? "#15803D" : "#6B7280", fontSize: 14, cursor: "pointer" }} title="Questions to ask them">🎤</button>
      </div>

      {showAskThem && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #E5E7EB", padding: "16px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 12, fontFamily: "DM Mono, monospace", letterSpacing: "0.05em" }}>🎤 QUESTIONS TO ASK THEM</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(ASK_THEM[activeCat] || []).map((q, i) => (
              <div key={i} style={{ display: "flex", gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: cat.color, background: cat.bg, borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                <p style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.6, margin: 0 }}>{q}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {practiceMode && practiceQ ? (
        <div>
          <div key={practiceKey}>
            <QuestionCard question={practiceQ} catColor={cat.color} rating={ratings[practiceQ.id]} onRate={onRate}
              onEdit={(id, updates) => onEditQuestion(activeCat, id, updates)}
              onDelete={() => { onDeleteQuestion(activeCat, practiceQ.id); nextPractice(); }}
              onGenerateAnswer={(q) => onGenerateAnswer(activeCat, q)} profile={profile} />
          </div>
          <div style={{ marginTop: 12 }}>
            <Btn full onClick={nextPractice} style={{ background: "#111827", color: "#fff" }}>Next Question →</Btn>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {catQs.map(q => (
              <QuestionCard key={q.id} question={q} catColor={cat.color} rating={ratings[q.id]} onRate={onRate}
                onEdit={(id, updates) => onEditQuestion(activeCat, id, updates)}
                onDelete={() => onDeleteQuestion(activeCat, q.id)}
                onGenerateAnswer={(q) => onGenerateAnswer(activeCat, q)} profile={profile} />
            ))}
          </div>

          {addingQ ? (
            <div style={{ background: "#fff", borderRadius: 16, border: "1.5px dashed #2563EB", padding: 16, marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10, fontFamily: "DM Mono, monospace" }}>ADD QUESTION</div>
              <textarea value={newQ} onChange={e => setNewQ(e.target.value)} placeholder="Enter your question..."
                style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontFamily: "DM Sans, sans-serif", resize: "vertical", minHeight: 80, boxSizing: "border-box", marginBottom: 10 }} />
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <select value={newTier} onChange={e => setNewTier(e.target.value)} style={{ flex: 1, padding: "8px 10px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>
                  <option value="warm">Warm-Up</option><option value="mid">Mid-Loop</option><option value="final">Final Round</option>
                </select>
                <select value={newType} onChange={e => setNewType(e.target.value)} style={{ flex: 1, padding: "8px 10px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>
                  <option value="behavioral">Behavioral</option><option value="situational">Situational</option><option value="concept">Concept</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={handleAddQ} color={cat.color} variant="ghost" small>Add Question</Btn>
                <Btn onClick={() => setAddingQ(false)} variant="secondary" small>Cancel</Btn>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingQ(true)} style={{ width: "100%", marginTop: 12, padding: "12px", background: "none", border: "1.5px dashed #D1D5DB", borderRadius: 12, fontSize: 13.5, color: "#9CA3AF", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
              + Add a question
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── JOB PREP TAB ──────────────────────────────────────────────────────────────
function JobPrepTab({ jobs, profile, ratings, onRate, onEditQuestion, onDeleteQuestion, onAddQuestion, onGenerateAnswer, onAddJob, onDeleteJob }) {
  const [activeJob, setActiveJob] = useState(null);
  const [addingJob, setAddingJob] = useState(false);
  const [jobName, setJobName] = useState("");
  const [jdText, setJdText] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [addingQ, setAddingQ] = useState(false);
  const [newQ, setNewQ] = useState("");
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceQ, setPracticeQ] = useState(null);
  const [practiceKey, setPracticeKey] = useState(0);

  const job = jobs.find(j => j.id === activeJob);
  const jobQs = job?.questions || [];
  const nailed = jobQs.filter(q => ratings[q.id] === "nailed").length;
  const pct = jobQs.length ? Math.round((nailed / jobQs.length) * 100) : 0;

  const handleGenerateJob = async () => {
    if (!jobName.trim()) return;
    setGenerating(true);
    const context = jdText || `Job URL: ${jdUrl}`;
    const resumeContext = profile?.resumeText ? `\n\nCandidate resume:\n${profile.resumeText.slice(0, 2000)}` : "";
    const prompt = `You are an expert interview coach. Generate 10 tailored interview questions for this TPM role.

Job Details: ${context}${resumeContext}

Return ONLY a JSON array of objects with this exact structure (no markdown, no preamble):
[
  {
    "question": "...",
    "theme": "...",
    "tier": "warm|mid|final",
    "type": "behavioral|situational|concept"
  }
]

Focus on questions specific to this role. Mix behavioral, situational, and concept questions.`;

    try {
      const raw = await callClaude(prompt);
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const questions = parsed.map(q => ({ id: uid(), ...q, answer: null, customAnswer: null }));
      onAddJob({ id: uid(), name: jobName.trim(), jd: context, questions, createdAt: Date.now() });
      setAddingJob(false); setJobName(""); setJdText(""); setJdUrl("");
    } catch (e) {
      alert("Couldn't parse questions. Try again.");
    }
    setGenerating(false);
  };

  const startPractice = () => {
    setPracticeQ(getNextQuestion(jobQs, ratings));
    setPracticeKey(k => k + 1);
    setPracticeMode(true);
  };

  if (!activeJob && !addingJob) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.12em", fontFamily: "DM Mono, monospace", marginBottom: 6 }}>JOB PREP</div>
          <div style={{ fontSize: 26, fontWeight: 400, color: "#0F172A", fontFamily: "Instrument Serif, Georgia, serif", lineHeight: 1.2 }}>Prep for a specific role.</div>
          <div style={{ fontSize: 14, color: "#6B7280", marginTop: 6 }}>Paste a job description and get tailored questions with answers based on your resume.</div>
        </div>

        {jobs.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 16, border: "1.5px dashed #D1D5DB", padding: "32px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🎯</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 6 }}>No job listings yet</div>
            <div style={{ fontSize: 13.5, color: "#6B7280", marginBottom: 18 }}>Add a job listing to generate tailored interview questions</div>
            <Btn onClick={() => setAddingJob(true)}>+ Add Job Listing</Btn>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {jobs.map(job => {
                const qs = job.questions || [];
                const nailed = qs.filter(q => ratings[q.id] === "nailed").length;
                const pct = qs.length ? Math.round((nailed / qs.length) * 100) : 0;
                return (
                  <div key={job.id} style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB", padding: "16px", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "#F0F9FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎯</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{job.name}</div>
                        <div style={{ fontSize: 12, color: "#6B7280" }}>{qs.length} questions · {nailed} nailed</div>
                      </div>
                      <ProgressRing pct={pct} color="#1D4ED8" />
                    </div>
                    <ProgressBar pct={pct} color="#1D4ED8" />
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <Btn onClick={() => setActiveJob(job.id)} color="#1D4ED8" style={{ flex: 1 }}>Practice →</Btn>
                      <Btn onClick={() => onDeleteJob(job.id)} variant="danger" small>Delete</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setAddingJob(true)} style={{ width: "100%", marginTop: 12, padding: "12px", background: "none", border: "1.5px dashed #D1D5DB", borderRadius: 12, fontSize: 13.5, color: "#9CA3AF", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
              + Add another job
            </button>
          </div>
        )}
      </div>
    );
  }

  if (addingJob) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button onClick={() => setAddingJob(false)} style={{ width: 36, height: 36, borderRadius: 10, background: "#F9FAFB", border: "1.5px solid #E5E7EB", fontSize: 15, cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>Add Job Listing</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5, fontFamily: "DM Mono, monospace", letterSpacing: "0.05em" }}>JOB NAME *</label>
            <input value={jobName} onChange={e => setJobName(e.target.value)} placeholder="e.g. Google TPM L6 — Ads Platform"
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5, fontFamily: "DM Mono, monospace", letterSpacing: "0.05em" }}>JOB LISTING URL (optional)</label>
            <input value={jdUrl} onChange={e => setJdUrl(e.target.value)} placeholder="https://careers.google.com/..."
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5, fontFamily: "DM Mono, monospace", letterSpacing: "0.05em" }}>JOB DESCRIPTION — PASTE TEXT</label>
            <textarea value={jdText} onChange={e => setJdText(e.target.value)} placeholder="Paste the full job description here for best results..."
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13.5, fontFamily: "DM Sans, sans-serif", resize: "vertical", minHeight: 160, boxSizing: "border-box", lineHeight: 1.6 }} />
          </div>
          {!profile?.resumeText && (
            <div style={{ background: "#FFFBEB", borderRadius: 10, padding: "12px 14px", border: "1px solid #FDE68A", fontSize: 13, color: "#92400E" }}>
              💡 Add your resume in Profile to get answers personalized to your background.
            </div>
          )}
          <Btn onClick={handleGenerateJob} disabled={generating || !jobName.trim() || (!jdText.trim() && !jdUrl.trim())} full>
            {generating ? <><Spinner /> Generating questions...</> : "Generate Questions →"}
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={() => { setActiveJob(null); setPracticeMode(false); }} style={{ width: 36, height: 36, borderRadius: 10, background: "#F9FAFB", border: "1.5px solid #E5E7EB", fontSize: 15, cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{job.name}</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>{nailed}/{jobQs.length} nailed · {pct}%</div>
        </div>
        <ProgressRing pct={pct} color="#1D4ED8" />
      </div>
      <ProgressBar pct={pct} color="#1D4ED8" />
      <div style={{ height: 16 }} />

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button onClick={() => setPracticeMode(false)} style={{ flex: 1, padding: "9px", borderRadius: 10, border: `1.5px solid ${!practiceMode ? "#1D4ED8" : "#E5E7EB"}`, background: !practiceMode ? "#EFF6FF" : "#F9FAFB", color: !practiceMode ? "#1D4ED8" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>All Questions</button>
        <button onClick={startPractice} style={{ flex: 1, padding: "9px", borderRadius: 10, border: `1.5px solid ${practiceMode ? "#1D4ED8" : "#E5E7EB"}`, background: practiceMode ? "#1D4ED8" : "#F9FAFB", color: practiceMode ? "#fff" : "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>⚡ Practice Mode</button>
      </div>

      {practiceMode && practiceQ ? (
        <div>
          <div key={practiceKey}>
            <QuestionCard question={practiceQ} catColor="#1D4ED8" rating={ratings[practiceQ.id]} onRate={onRate}
              onEdit={(id, updates) => onEditQuestion(job.id, id, updates, true)}
              onDelete={() => { onDeleteQuestion(job.id, practiceQ.id, true); setPracticeQ(getNextQuestion(jobQs.filter(q => q.id !== practiceQ.id), ratings)); setPracticeKey(k => k + 1); }}
              onGenerateAnswer={(q) => onGenerateAnswer(job.id, q, true)} profile={profile} isJobPrep />
          </div>
          <div style={{ marginTop: 12 }}>
            <Btn full onClick={() => { setPracticeQ(getNextQuestion(jobQs, ratings)); setPracticeKey(k => k + 1); }} style={{ background: "#111827", color: "#fff" }}>Next Question →</Btn>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {jobQs.map(q => (
              <QuestionCard key={q.id} question={q} catColor="#1D4ED8" rating={ratings[q.id]} onRate={onRate}
                onEdit={(id, updates) => onEditQuestion(job.id, id, updates, true)}
                onDelete={() => onDeleteQuestion(job.id, q.id, true)}
                onGenerateAnswer={(q) => onGenerateAnswer(job.id, q, true)} profile={profile} isJobPrep />
            ))}
          </div>
          {addingQ ? (
            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px dashed #1D4ED8", padding: 16, marginTop: 12 }}>
              <textarea value={newQ} onChange={e => setNewQ(e.target.value)} placeholder="Enter your custom question..."
                style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontFamily: "DM Sans, sans-serif", resize: "vertical", minHeight: 80, boxSizing: "border-box", marginBottom: 10 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <Btn small onClick={() => { if (newQ.trim()) { onAddQuestion(job.id, { id: uid(), tier: "mid", type: "custom", question: newQ.trim(), answer: null, customAnswer: null }, true); setNewQ(""); setAddingQ(false); } }} color="#1D4ED8" variant="ghost">Add</Btn>
                <Btn small onClick={() => setAddingQ(false)} variant="secondary">Cancel</Btn>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingQ(true)} style={{ width: "100%", marginTop: 12, padding: "12px", background: "none", border: "1.5px dashed #D1D5DB", borderRadius: 12, fontSize: 13.5, color: "#9CA3AF", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>+ Add a question</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── MOCK INTERVIEW TAB ────────────────────────────────────────────────────────
function MockInterviewTab() {
  return (
    <div style={{ textAlign: "center", paddingTop: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎙️</div>
      <div style={{ fontSize: 22, fontWeight: 400, color: "#0F172A", fontFamily: "Instrument Serif, Georgia, serif", marginBottom: 10 }}>Mock Interview Mode</div>
      <div style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.7, maxWidth: 320, margin: "0 auto 24px" }}>
        Answer questions verbally, get a transcript, and receive AI feedback on your STAR coverage. Coming in Phase 2.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 280, margin: "0 auto" }}>
        {["🎯 Quick Mode — one question, instant feedback", "📋 Full Sim — complete interview with end report", "🔊 Audio playback + transcript side by side", "✅ STAR coverage scoring per answer"].map((f, i) => (
          <div key={i} style={{ background: "#F9FAFB", borderRadius: 10, padding: "11px 14px", fontSize: 13.5, color: "#374151", textAlign: "left", border: "1px solid #E5E7EB" }}>{f}</div>
        ))}
      </div>
      <div style={{ marginTop: 24, fontSize: 12, color: "#D1D5DB", fontFamily: "DM Mono, monospace" }}>PHASE 2</div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("core");
  const [profile, setProfile] = useState(null);
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [jobs, setJobs] = useState([]);
  const [ratings, setRatings] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Load from storage
  useEffect(() => {
    loadFromGoogleDrive().then(data => {
      if (data) {
        if (data.profile) setProfile(data.profile);
        if (data.questions) setQuestions(data.questions);
        if (data.jobs) setJobs(data.jobs);
        if (data.ratings) setRatings(data.ratings);
      }
      setLoaded(true);
    });
  }, []);

  // Save to storage on changes
  useEffect(() => {
    if (!loaded) return;
    saveToGoogleDrive({ profile, questions, jobs, ratings });
  }, [profile, questions, jobs, ratings, loaded]);

  const handleSaveProfile = useCallback(async (p) => {
    setProfile(p);
    setShowProfile(false);
  }, []);

  const handleRate = useCallback((qId, val) => {
    setRatings(prev => ({ ...prev, [qId]: val }));
  }, []);

  const handleEditQuestion = useCallback((catOrJobId, qId, updates, isJob = false) => {
    if (isJob) {
      setJobs(prev => prev.map(j => j.id === catOrJobId ? { ...j, questions: j.questions.map(q => q.id === qId ? { ...q, ...updates } : q) } : j));
    } else {
      setQuestions(prev => ({ ...prev, [catOrJobId]: prev[catOrJobId].map(q => q.id === qId ? { ...q, ...updates } : q) }));
    }
  }, []);

  const handleDeleteQuestion = useCallback((catOrJobId, qId, isJob = false) => {
    if (isJob) {
      setJobs(prev => prev.map(j => j.id === catOrJobId ? { ...j, questions: j.questions.filter(q => q.id !== qId) } : j));
    } else {
      setQuestions(prev => ({ ...prev, [catOrJobId]: prev[catOrJobId].filter(q => q.id !== qId) }));
    }
  }, []);

  const handleAddQuestion = useCallback((catOrJobId, question, isJob = false) => {
    if (isJob) {
      setJobs(prev => prev.map(j => j.id === catOrJobId ? { ...j, questions: [...j.questions, question] } : j));
    } else {
      setQuestions(prev => ({ ...prev, [catOrJobId]: [...prev[catOrJobId], question] }));
    }
  }, []);

  const handleGenerateAnswer = useCallback(async (catOrJobId, question, isJob = false) => {
    const resumeSnippet = profile?.resumeText ? `\n\nCandidate resume (use this to personalize the answer):\n${profile.resumeText.slice(0, 2000)}` : "";
    const nameCtx = profile?.name ? `\nCandidate name: ${profile.name}` : "";
    const prompt = `Generate a strong STAR-format interview answer for a Google TPM interview.

Question: "${question.question}"
Type: ${question.type}${nameCtx}${resumeSnippet}

Return ONLY a JSON object (no markdown, no preamble):
{
  "situation": "...",
  "task": "...",
  "action": "...",
  "result": "..."
}

Each section should be 2-3 sentences. Be specific, use metrics where possible, and sound natural spoken aloud.${profile?.resumeText ? " Use the candidate's actual experience from their resume." : " Provide a strong model answer."}`;

    try {
      const raw = await callClaude(prompt);
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      handleEditQuestion(catOrJobId, question.id, { answer: parsed }, isJob);
      return parsed;
    } catch (e) {
      const fallback = "I wasn't able to generate a structured answer right now. Try again or write your own answer using the edit button.";
      handleEditQuestion(catOrJobId, question.id, { answer: fallback }, isJob);
      return fallback;
    }
  }, [profile, handleEditQuestion]);

  const TABS = [
    { id: "core", label: "Core Prep", icon: "📚" },
    { id: "job", label: "Job Prep", icon: "🎯" },
    { id: "mock", label: "Mock", icon: "🎙️" },
  ];

  if (!loaded) {
    return (
      <div style={{ fontFamily: "DM Sans, sans-serif", minHeight: "100vh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <link href={FONT_LINK} rel="stylesheet" />
        <div style={{ textAlign: "center", color: "#6B7280" }}><Spinner size={24} /><div style={{ marginTop: 12, fontSize: 14 }}>Loading your prep data...</div></div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "DM Sans, -apple-system, sans-serif", minHeight: "100vh", background: "#F8FAFC" }}>
      <link href={FONT_LINK} rel="stylesheet" />

      {/* Top nav */}
      <div style={{ background: "#fff", borderBottom: "1px solid #F3F4F6", padding: "0 16px", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", alignItems: "center", gap: 4, height: 52 }}>
          <div style={{ flex: 1, display: "flex", gap: 2 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ flex: 1, padding: "8px 4px", border: "none", background: "none", cursor: "pointer", fontSize: 12.5, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? "#111827" : "#9CA3AF", borderBottom: `2px solid ${tab === t.id ? "#111827" : "transparent"}`, transition: "all 0.15s", fontFamily: "DM Sans, sans-serif" }}>
                <span style={{ marginRight: 4 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowProfile(true)}
            style={{ width: 34, height: 34, borderRadius: "50%", background: profile ? "#111827" : "#F3F4F6", border: "2px solid #E5E7EB", cursor: "pointer", fontSize: 14, color: profile ? "#fff" : "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            title={profile ? profile.name : "Set up profile"}>
            {profile ? profile.name.charAt(0).toUpperCase() : "👤"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px 80px" }}>
        {!profile && tab !== "mock" && (
          <div style={{ background: "#FFFBEB", borderRadius: 14, padding: "14px 16px", marginBottom: 20, border: "1.5px solid #FDE68A", display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 20 }}>💡</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#92400E" }}>Add your resume for personalized answers</div>
              <div style={{ fontSize: 12, color: "#B45309", marginTop: 2 }}>Takes 2 min — AI will tailor every answer to your actual experience</div>
            </div>
            <Btn small onClick={() => setShowProfile(true)} color="#B45309" variant="ghost">Set up →</Btn>
          </div>
        )}

        {tab === "core" && <CorePrepTab questions={questions} ratings={ratings} profile={profile} onRate={handleRate} onEditQuestion={handleEditQuestion} onDeleteQuestion={handleDeleteQuestion} onAddQuestion={handleAddQuestion} onGenerateAnswer={handleGenerateAnswer} />}
        {tab === "job" && <JobPrepTab jobs={jobs} profile={profile} ratings={ratings} onRate={handleRate} onEditQuestion={handleEditQuestion} onDeleteQuestion={handleDeleteQuestion} onAddQuestion={handleAddQuestion} onGenerateAnswer={handleGenerateAnswer} onAddJob={j => setJobs(prev => [...prev, j])} onDeleteJob={id => setJobs(prev => prev.filter(j => j.id !== id))} />}
        {tab === "mock" && <MockInterviewTab />}
      </div>

      {showProfile && (
        <Modal title={profile ? "Edit Profile" : "Set Up Profile"} onClose={() => setShowProfile(false)}>
          <ProfileSetup profile={profile} onSave={handleSaveProfile} />
        </Modal>
      )}
    </div>
  );
}
