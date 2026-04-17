import { useState, useRef, useEffect } from "react";
import "./App.css";

const MIN_RECORDING_MS = 1500;
const API = "http://127.0.0.1:8000";

const CATEGORIES = [
  { id: "Software Engineer", label: "Software Engineer", icon: "💻" },
  { id: "Product Manager",   label: "Product Manager",   icon: "📋" },
  { id: "Marketing",         label: "Marketing",         icon: "📣" },
  { id: "UX/UI Designer",    label: "UX/UI Designer",    icon: "🎨" },
  { id: "Data Scientist",    label: "Data Scientist",    icon: "📊" },
  { id: "Custom",            label: "Custom Role",       icon: "✏️"  },
];

const STAGES     = ["HR", "Technical", "Culture", "Final"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];

// ── Audio hook ────────────────────────────────────────────────────────────────
function useAudio() {
  const audioContext = useRef(null);
  const currentAudio = useRef(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const unlock = () => {
    if (!audioContext.current)
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.current.state === "suspended") audioContext.current.resume();
  };

  const play = (base64String) => {
    if (!soundEnabled) return;
    stop();
    try {
      const raw = atob(base64String);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const ctx = audioContext.current;
      if (!ctx) return;
      ctx.decodeAudioData(bytes.buffer, (decoded) => {
        const source = ctx.createBufferSource();
        source.buffer = decoded;
        source.connect(ctx.destination);
        source.start(0);
        currentAudio.current = source;
        setIsPlaying(true);
        source.onended = () => { currentAudio.current = null; setIsPlaying(false); };
      }, (err) => console.error("Decode error:", err));
    } catch (err) { console.error("Audio error:", err); }
  };

  const stop = () => {
    if (currentAudio.current) {
      try { currentAudio.current.stop(); } catch (_) {}
      currentAudio.current = null;
    }
    setIsPlaying(false);
  };

  const toggle = () => { if (soundEnabled) stop(); setSoundEnabled(p => !p); };
  return { soundEnabled, isPlaying, unlock, play, stop, toggle };
}

// ── Recording hook ────────────────────────────────────────────────────────────
function useRecording({ onAudioReady, unlockFn }) {
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const startTime = useRef(null);
  const [isRecording, setIsRecording] = useState(false);

  const start = async () => {
    unlockFn();
    startTime.current = Date.now();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream);
    audioChunks.current = [];
    mediaRecorder.current.onstop = () => {
      const blob = new Blob(audioChunks.current, { type: "audio/webm;codecs=opus" });
      if (blob.size > 1000) onAudioReady(blob);
    };
    mediaRecorder.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.current.push(e.data); };
    mediaRecorder.current.start(100);
    setIsRecording(true);
  };

  const stop = () => {
    const elapsed = Date.now() - startTime.current;
    const remaining = MIN_RECORDING_MS - elapsed;
    const doStop = () => {
      if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
        mediaRecorder.current.stop();
        mediaRecorder.current.stream.getTracks().forEach(t => t.stop());
      }
    };
    setIsRecording(false);
    remaining > 0 ? setTimeout(doStop, remaining) : doStop();
  };

  const forceStop = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(t => t.stop());
    }
    setIsRecording(false);
  };

  return { isRecording, start, stop, forceStop };
}

// ── Shared components ─────────────────────────────────────────────────────────
function StopAudioBtn({ audio }) {
  if (!audio.isPlaying) return null;
  return (
    <button className="stop-audio-btn" onClick={audio.stop} title="Stop AI voice">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
      Stop Audio
    </button>
  );
}

function SoundBtn({ audio }) {
  return (
    <button className={`sound-btn ${audio.soundEnabled ? "sound-on" : "sound-off"}`} onClick={audio.toggle}>
      {audio.soundEnabled
        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
      }
      <span>{audio.soundEnabled ? "Sound On" : "Muted"}</span>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [mode, setMode] = useState("practice");
  const audio = useAudio();

  const switchMode = (newMode) => { audio.stop(); setMode(newMode); };

  return (
    <div className="app-root">
      <div className="bg-blob blob-1" />
      <div className="bg-blob blob-2" />
      <div className="app-shell">

        {/* ── SIDEBAR ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-dot" />
            <span className="logo-text">Spazer<span className="logo-accent">AI</span></span>
          </div>
          <nav className="sidebar-nav">
            <button className={`nav-item ${mode === "practice" ? "active" : ""}`} onClick={() => switchMode("practice")}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
              </svg>
              <span>Practice</span>
            </button>
            <button className={`nav-item ${mode === "interview" ? "active" : ""}`} onClick={() => switchMode("interview")}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
              </svg>
              <span>Interview</span>
            </button>
            <button className={`nav-item ${mode === "community" ? "active" : ""}`} onClick={() => switchMode("community")}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>Community</span>
            </button>
          </nav>
          <div className="sidebar-footer">
            <div className="sidebar-version">v1.0</div>
          </div>
        </aside>

        {/* ── MAIN PANEL ── */}
        <main className="main-panel">
          {mode === "practice"   && <PracticeMode audio={audio} />}
          {mode === "interview"  && <InterviewMode audio={audio} />}
          {mode === "community"  && <CommunityMode />}
        </main>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PRACTICE MODE
// ══════════════════════════════════════════════════════════════════════════════
function PracticeMode({ audio }) {
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ripple, setRipple] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isProcessing]);

  const rec = useRecording({ unlockFn: audio.unlock, onAudioReady: sendAudio });

  async function sendAudio(blob) {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append("file", blob, "audio.webm");
    try {
      const res = await fetch(`${API}/upload-audio?mode=practice`, { method: "POST", body: formData });
      const data = await res.json();
      setMessages(prev => [...prev,
        { sender: "You", text: data.transcription },
        { sender: "AI",  text: data.ia_response  },
      ]);
      if (data.audio_base64) audio.play(data.audio_base64);
    } catch (err) { console.error(err); }
    finally { setIsProcessing(false); }
  }

  const reset = async () => {
    rec.forceStop(); audio.stop();
    await fetch(`${API}/reset`, { method: "POST" });
    setMessages([]);
  };

  return (
    <div className="panel-inner">
      <div className="panel-header">
        <div className="panel-title-group">
          <h2 className="panel-title">Free Practice</h2>
          <span className="panel-sub">Speak freely — your AI tutor will help you improve</span>
        </div>
        <div className="panel-actions">
          <StopAudioBtn audio={audio} />
          <SoundBtn audio={audio} />
          <button className="reset-btn" onClick={reset}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
            New Chat
          </button>
        </div>
      </div>
      <div className="chat-body">
        {messages.length === 0 && !isProcessing && (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
            </div>
            <p className="empty-title">Start speaking</p>
            <p className="empty-sub">Talk about anything — your tutor will correct and guide you</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`bubble-row ${msg.sender === "You" ? "row-user" : "row-ai"}`}>
            <div className={`bubble ${msg.sender === "You" ? "bubble-user" : "bubble-ai"}`}>
              <span className="bubble-sender">{msg.sender === "You" ? "You" : "Tutor"}</span>
              <p>{msg.text}</p>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="bubble-row row-ai">
            <div className="bubble bubble-ai bubble-thinking">
              <span className="bubble-sender">Tutor</span>
              <div className="thinking-dots"><span /><span /><span /></div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="chat-footer">
        <button className={`mic-btn ${rec.isRecording ? "mic-active" : ""} ${isProcessing ? "mic-disabled" : ""} ${ripple ? "mic-ripple" : ""}`}
          onClick={() => { setRipple(true); setTimeout(() => setRipple(false), 600); if (rec.isRecording) rec.stop(); else rec.start(); }}
          disabled={isProcessing}>
          <span className="mic-ring" />
          <span className="mic-icon">
            {isProcessing
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
            }
          </span>
          <span className="mic-label">{rec.isRecording ? "Recording… click to stop" : isProcessing ? "Processing…" : "Click to speak"}</span>
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// INTERVIEW MODE
// ══════════════════════════════════════════════════════════════════════════════
function InterviewMode({ audio }) {
  const [screen, setScreen] = useState("setup");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [customInfo, setCustomInfo] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isFetchingFeedback, setIsFetchingFeedback] = useState(false);
  const [ripple, setRipple] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isProcessing]);

  const rec = useRecording({ unlockFn: audio.unlock, onAudioReady: sendAudio });

  const handleStart = async () => {
    if (!selectedCategory) return;
    audio.unlock(); setIsStarting(true);
    try {
      const res = await fetch(`${API}/start-interview`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: selectedCategory, custom_info: customInfo }),
      });
      const data = await res.json();
      setMessages([{ sender: "AI", text: data.message }]);
      setScreen("live");
      if (data.audio_base64) audio.play(data.audio_base64);
    } catch (err) { console.error(err); }
    finally { setIsStarting(false); }
  };

  async function sendAudio(blob) {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append("file", blob, "audio.webm");
    try {
      const res = await fetch(`${API}/upload-audio?mode=interview`, { method: "POST", body: formData });
      const data = await res.json();
      setMessages(prev => [...prev,
        { sender: "You", text: data.transcription },
        { sender: "AI",  text: data.ia_response  },
      ]);
      if (data.audio_base64) audio.play(data.audio_base64);
    } catch (err) { console.error(err); }
    finally { setIsProcessing(false); }
  }

  const handleEndInterview = async () => {
    rec.forceStop(); audio.stop();
    setIsFetchingFeedback(true); setScreen("feedback");
    try {
      const res = await fetch(`${API}/feedback`, { method: "POST" });
      const data = await res.json();
      setFeedback(data.feedback);
      if (data.audio_base64) audio.play(data.audio_base64);
    } catch (err) { setFeedback("Could not load feedback."); }
    finally { setIsFetchingFeedback(false); }
  };

  const handleRestart = async () => {
    audio.stop();
    await fetch(`${API}/reset-interview`, { method: "POST" });
    setMessages([]); setFeedback(""); setSelectedCategory(null); setCustomInfo(""); setScreen("setup");
  };

  if (screen === "setup") return (
    <div className="panel-inner">
      <div className="panel-header">
        <div className="panel-title-group">
          <h2 className="panel-title">Job Interview</h2>
          <span className="panel-sub">Choose a role and practice with an AI interviewer</span>
        </div>
      </div>
      <div className="setup-body">
        <div className="category-grid">
          {CATEGORIES.map(cat => (
            <button key={cat.id} className={`category-card ${selectedCategory === cat.id ? "selected" : ""}`} onClick={() => setSelectedCategory(cat.id)}>
              <span className="cat-icon">{cat.icon}</span>
              <span className="cat-label">{cat.label}</span>
              {selectedCategory === cat.id && <span className="cat-check">✓</span>}
            </button>
          ))}
        </div>
        {selectedCategory && (
          <div className="custom-box">
            <label className="custom-label">{selectedCategory === "Custom" ? "Describe the role:" : "Add extra context (optional):"}</label>
            <textarea className="custom-textarea" rows={3}
              placeholder={selectedCategory === "Custom" ? "e.g. Junior iOS Developer at a fintech startup..." : "e.g. Senior position, focus on leadership..."}
              value={customInfo} onChange={e => setCustomInfo(e.target.value)} />
          </div>
        )}
        <button className={`start-btn ${!selectedCategory ? "disabled" : ""}`} onClick={handleStart} disabled={!selectedCategory || isStarting}>
          {isStarting ? <><span className="btn-spinner" /> Preparing...</> : <><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start Interview</>}
        </button>
      </div>
    </div>
  );

  if (screen === "live") return (
    <div className="panel-inner">
      <div className="panel-header">
        <div className="panel-title-group">
          <h2 className="panel-title">Interview — {selectedCategory}</h2>
          <span className="panel-sub">Answer out loud. The interviewer is listening.</span>
        </div>
        <div className="panel-actions">
          <StopAudioBtn audio={audio} />
          <SoundBtn audio={audio} />
          <button className="end-btn" onClick={handleEndInterview}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            End Interview
          </button>
        </div>
      </div>
      <div className="chat-body">
        {messages.map((msg, i) => (
          <div key={i} className={`bubble-row ${msg.sender === "You" ? "row-user" : "row-ai"}`}>
            <div className={`bubble ${msg.sender === "You" ? "bubble-user" : "bubble-ai"}`}>
              <span className="bubble-sender">{msg.sender === "You" ? "You" : "Interviewer"}</span>
              <p>{msg.text}</p>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="bubble-row row-ai">
            <div className="bubble bubble-ai bubble-thinking">
              <span className="bubble-sender">Interviewer</span>
              <div className="thinking-dots"><span /><span /><span /></div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="chat-footer">
        <button className={`mic-btn ${rec.isRecording ? "mic-active" : ""} ${isProcessing ? "mic-disabled" : ""} ${ripple ? "mic-ripple" : ""}`}
          onClick={() => { setRipple(true); setTimeout(() => setRipple(false), 600); if (rec.isRecording) rec.stop(); else rec.start(); }}
          disabled={isProcessing}>
          <span className="mic-ring" />
          <span className="mic-icon">
            {isProcessing
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
            }
          </span>
          <span className="mic-label">{rec.isRecording ? "Recording… click to stop" : isProcessing ? "Processing…" : "Click to answer"}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="panel-inner">
      <div className="panel-header">
        <div className="panel-title-group">
          <h2 className="panel-title">Performance Review</h2>
          <span className="panel-sub">{selectedCategory} interview</span>
        </div>
        <div className="panel-actions">
          <StopAudioBtn audio={audio} />
          <button className="reset-btn" onClick={handleRestart}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
            New Interview
          </button>
        </div>
      </div>
      <div className="feedback-body">
        {isFetchingFeedback ? (
          <div className="feedback-loading">
            <div className="thinking-dots large"><span /><span /><span /></div>
            <p>Analyzing your performance…</p>
          </div>
        ) : (
          <>
            <div className="feedback-header-icon">🏆</div>
            <h3 className="feedback-title">Interview Complete</h3>
            <p className="feedback-sub">Here's your honest performance review</p>
            <div className="feedback-card">
              {feedback.split('\n').filter(l => l.trim()).map((line, i) => (
                <p key={i} className={line.match(/^\d+\)/) ? "feedback-section" : "feedback-line"}>{line}</p>
              ))}
            </div>
            <button className="start-btn" onClick={handleRestart}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
              Practice Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMMUNITY MODE
// ══════════════════════════════════════════════════════════════════════════════
function CommunityMode() {
  const [view, setView] = useState("browse");
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [isLoadingInterviews, setIsLoadingInterviews] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  // ── Novo formato que bate com InterviewSubmit do backend ──
  const [form, setForm] = useState({
    company_name: "",
    role: "",
    difficulty: "Medium",
    submitted_by: "anonymous",
    stages: [
      { stage_type: "Technical", description: "", questions: ["", "", ""] }
    ],
  });

  // Load companies on mount
  useEffect(() => {
    fetch(`${API}/companies`)
      .then(r => r.json())
      .then(d => setCompanies(d.companies || []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const loadInterviews = async (company, role) => {
    setSelectedCompany(company); setSelectedRole(role);
    setIsLoadingInterviews(true); setView("detail");
    try {
      const res = await fetch(`${API}/interviews?company=${encodeURIComponent(company)}&role=${encodeURIComponent(role)}`);
      const data = await res.json();
      setInterviews(data.interviews || []);
    } catch (err) { console.error(err); }
    finally { setIsLoadingInterviews(false); }
  };

  // ── Stage helpers ──
  const updateStageField = (si, field, val) =>
    setForm(f => { const s = [...f.stages]; s[si] = { ...s[si], [field]: val }; return { ...f, stages: s }; });

  const updateQuestion = (si, qi, val) =>
    setForm(f => { const s = [...f.stages]; s[si].questions[qi] = val; return { ...f, stages: s }; });

  const addQuestion = (si) =>
    setForm(f => { const s = [...f.stages]; s[si].questions.push(""); return { ...f, stages: s }; });

  const removeQuestion = (si, qi) =>
    setForm(f => { const s = [...f.stages]; s[si].questions = s[si].questions.filter((_, i) => i !== qi); return { ...f, stages: s }; });

  // ── Submit ──
  const handleSubmit = async () => {
    const payload = {
      ...form,
      company_name: form.company_name.trim(),
      role: form.role.trim(),
      stages: form.stages.map(s => ({
        ...s,
        questions: s.questions.filter(q => q.trim().length > 5)
      })).filter(s => s.questions.length > 0)
    };

    if (!payload.company_name || !payload.role || payload.stages.length === 0) return;

    setIsSubmitting(true); setSubmitResult(null);
    try {
      const res = await fetch(`${API}/submit-interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setSubmitResult(data);
      if (data.status === "approved") {
        setForm({
          company_name: "", role: "", difficulty: "Medium", submitted_by: "anonymous",
          stages: [{ stage_type: "Technical", description: "", questions: ["", "", ""] }]
        });
      }
    } catch (err) {
      console.error(err);
      setSubmitResult({ status: "error", message: "Connection error." });
    } finally { setIsSubmitting(false); }
  };

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const difficultyColor = (d) => d === "Easy" ? "diff-easy" : d === "Medium" ? "diff-medium" : "diff-hard";
  const stageColor = (s) => s === "HR" ? "stage-hr" : s === "Technical" ? "stage-tech" : s === "Culture" ? "stage-culture" : "stage-final";

  // ── Browse view ──
  if (view === "browse") return (
    <div className="panel-inner">
      <div className="panel-header">
        <div className="panel-title-group">
          <h2 className="panel-title">Community Database</h2>
          <span className="panel-sub">Real interview questions shared by the community</span>
        </div>
        <button className="submit-btn" onClick={() => setView("submit")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Contribute
        </button>
      </div>
      <div className="community-body">
        <div className="search-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="search-input" placeholder="Search company…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="community-loading">
            <div className="thinking-dots"><span /><span /><span /></div>
            <p>Loading companies…</p>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <p className="empty-title">No companies found</p>
            <p className="empty-sub">Be the first to contribute interview questions!</p>
          </div>
        ) : (
          <div className="company-list">
            {filteredCompanies.map(company => (
              <div key={company.name} className="company-card">
                <div className="company-card-header">
                  <div className="company-avatar">{company.name[0]}</div>
                  <div>
                    <div className="company-name">{company.name}</div>
                    <div className="company-roles-count">{company.roles.length} role{company.roles.length !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                <div className="company-roles">
                  {company.roles.map(role => (
                    <button key={role} className="role-chip" onClick={() => loadInterviews(company.name, role)}>
                      {role}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Detail view ──
  if (view === "detail") return (
    <div className="panel-inner">
      <div className="panel-header">
        <div className="panel-title-group">
          <h2 className="panel-title">{selectedCompany}</h2>
          <span className="panel-sub">{selectedRole} interviews</span>
        </div>
        <div className="panel-actions">
          <button className="reset-btn" onClick={() => setView("browse")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <button className="submit-btn" onClick={() => setView("submit")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Contribute
          </button>
        </div>
      </div>
      <div className="community-body">
        {isLoadingInterviews ? (
          <div className="community-loading">
            <div className="thinking-dots"><span /><span /><span /></div>
            <p>Loading questions…</p>
          </div>
        ) : interviews.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No questions yet</p>
            <p className="empty-sub">Be the first to share your interview experience!</p>
          </div>
        ) : (
          <div className="interview-list">
            {interviews.map((iv, i) => (
              <div key={iv.id || i} className="interview-card">
                <div className="interview-card-header">
                  <span className={`badge ${stageColor(iv.stage)}`}>{iv.stage}</span>
                  <span className={`badge ${difficultyColor(iv.difficulty)}`}>{iv.difficulty}</span>
                  <span className="interview-meta">by {iv.submitted_by} · {new Date(iv.created_at).toLocaleDateString()}</span>
                </div>
                <ul className="question-list">
                  {iv.questions.map((q, qi) => (
                    <li key={qi} className="question-item">
                      <span className="question-num">{qi + 1}</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Submit view ──
  return (
    <div className="panel-inner">
      <div className="panel-header">
        <div className="panel-title-group">
          <h2 className="panel-title">Contribute</h2>
          <span className="panel-sub">Share real questions from your interview experience</span>
        </div>
        <button className="reset-btn" onClick={() => { setView("browse"); setSubmitResult(null); }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
      </div>

      <div className="community-body">
        {submitResult ? (
          <div className={`submit-result ${submitResult.status}`}>
            <div className="submit-result-icon">{submitResult.status === "approved" ? "✅" : "❌"}</div>
            <h3>{submitResult.status === "approved" ? "Thank you!" : "Not approved"}</h3>
            <p>{submitResult.status === "approved"
              ? "Your questions were reviewed and added to the database!"
              : submitResult.reason || "Your submission didn't meet our guidelines."}</p>
            <button className="start-btn" style={{ marginTop: 16 }} onClick={() => setSubmitResult(null)}>
              Submit another
            </button>
          </div>
        ) : (
          <div className="submit-form">

            {/* Company + Role */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Company *</label>
                <input className="form-input" placeholder="e.g. Google"
                  value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <input className="form-input" placeholder="e.g. Software Engineer"
                  value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
              </div>
            </div>

            {/* Difficulty */}
            <div className="form-group">
              <label className="form-label">Overall Difficulty</label>
              <div className="pill-group">
                {DIFFICULTIES.map(d => (
                  <button key={d} className={`pill ${form.difficulty === d ? "pill-active" : ""}`}
                    onClick={() => setForm(f => ({ ...f, difficulty: d }))}>{d}</button>
                ))}
              </div>
            </div>

            {/* Stage block */}
            {form.stages.map((stage, si) => (
              <div key={si} className="stage-block">
                <div className="form-group">
                  <label className="form-label">Interview Stage</label>
                  <div className="pill-group">
                    {STAGES.map(s => (
                      <button key={s} className={`pill ${stage.stage_type === s ? "pill-active" : ""}`}
                        onClick={() => updateStageField(si, "stage_type", s)}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Questions * <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(at least 1)</span></label>
                  {stage.questions.map((q, qi) => (
                    <div key={qi} className="question-input-row">
                      <span className="question-input-num">{qi + 1}</span>
                      <input className="form-input" placeholder={`Question ${qi + 1}…`}
                        value={q} onChange={e => updateQuestion(si, qi, e.target.value)} />
                      {stage.questions.length > 1 && (
                        <button className="question-remove" onClick={() => removeQuestion(si, qi)}>×</button>
                      )}
                    </div>
                  ))}
                  <button className="add-question-btn" onClick={() => addQuestion(si)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add question
                  </button>
                </div>
              </div>
            ))}

            {/* Your name */}
            <div className="form-group">
              <label className="form-label">Your name (optional)</label>
              <input className="form-input" placeholder="anonymous"
                value={form.submitted_by} onChange={e => setForm(f => ({ ...f, submitted_by: e.target.value || "anonymous" }))} />
            </div>

            <button className="start-btn"
              onClick={handleSubmit}
              disabled={isSubmitting || !form.company_name || !form.role || form.stages.every(s => s.questions.every(q => q.trim().length < 5))}>
              {isSubmitting
                ? <><span className="btn-spinner" /> Reviewing with AI…</>
                : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg> Submit for Review</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}