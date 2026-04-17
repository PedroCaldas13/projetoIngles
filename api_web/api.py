import uvicorn
from fastapi import FastAPI, HTTPException, File, UploadFile, Query
from pydantic import BaseModel
from typing import List, Optional
from core.IntegradeAI import IntegradeAI
from core.transcription import Transcription
from fastapi.middleware.cors import CORSMiddleware
from database import (
    get_all_companies,
    get_interviews_by_company,
    get_interview_full,
    submit_interview,
    approve_interview,
    reject_interview,
)
from moderation import moderate_submission
from rag import build_interview_prompt, build_rag_context_text
import os, uuid, base64, subprocess
from gtts import gTTS
from fastapi import FastAPI, HTTPException, File, UploadFile, Query, Request

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

app = FastAPI(title="Spazer AI — English Tutor + Interview DB")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

transcritor  = Transcription()
practice_ai  = IntegradeAI()
interview_ai = IntegradeAI()


# ── Pydantic models ───────────────────────────────────────────────────────────

class Mensagem(BaseModel):
    texto: str

class StageSubmit(BaseModel):
    stage_type:  str
    description: Optional[str] = ""
    category:    Optional[str] = "general"
    questions:   List[str]

class InterviewSubmit(BaseModel):
    company_name:  str
    role:          str
    difficulty:    str
    submitted_by:  str
    stages:        List[StageSubmit]

class InterviewConfig(BaseModel):
    interview_id: Optional[str] = None
    category:     Optional[str] = None
    custom_info:  str = ""


# ── Prompts genéricos (fallback sem RAG) ─────────────────────────────────────

GENERIC_PROMPTS = {
    "Software Engineer": "You are a senior technical recruiter at a top tech company conducting a Software Engineer interview. Ask one technical or behavioral question at a time. Give brief feedback after each answer. Start by introducing yourself.",
    "Marketing":         "You are a marketing director conducting a Marketing Specialist interview. Ask one question at a time about strategy, campaigns, and analytics. Give brief feedback. Start by introducing yourself.",
    "Product Manager":   "You are a VP of Product conducting a Product Manager interview. Ask about product vision, prioritization, and metrics. Give brief feedback. Start by introducing yourself.",
    "UX/UI Designer":    "You are a Design Lead conducting a UX/UI Designer interview. Ask about process, tools, and user research. Give brief feedback. Start by introducing yourself.",
    "Data Scientist":    "You are a Head of Data Science conducting a Data Scientist interview. Ask about ML, statistics, and business impact. Give brief feedback. Start by introducing yourself.",
    "Custom":            "You are a professional recruiter conducting a job interview. Ask one relevant question at a time. Give brief feedback. Start by introducing yourself.",
}

FEEDBACK_PROMPT = (
    "The interview is now over. Provide a structured performance review. Include: "
    "1) Overall impression (2-3 sentences), "
    "2) Top 2 strengths, "
    "3) Top 2 areas for improvement, "
    "4) Score from 0-10 with justification. Be honest and constructive."
)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/")
def home():
    return {"status": "Online"}


# ══════════════════════════════════════════════════════════════════════════════
# COMMUNITY
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/companies")
def list_companies():
    return get_all_companies()


@app.get("/companies/{company_id}/interviews")
def list_interviews(company_id: str):
    return get_interviews_by_company(company_id)


@app.get("/interviews/{interview_id}")
def get_interview(interview_id: str):
    data = get_interview_full(interview_id)
    if not data:
        raise HTTPException(status_code=404, detail="Interview not found")
    return data


@app.post("/submit-interview")
def submit_new_interview(payload: InterviewSubmit):
    payload_dict = payload.model_dump()
    print(f"DEBUG: Submissão de '{payload.submitted_by}' — {payload.company_name} / {payload.role}")

    result = moderate_submission(payload_dict)
    print(f"DEBUG: Moderação → approved={result['approved']} reason='{result['reason']}'")

    if not result["approved"]:
        return {"status": "rejected", "reason": result["reason"]}

    saved = submit_interview(payload_dict)
    approve_interview(saved["interview_id"])

    return {
        "status":       "approved",
        "interview_id": saved["interview_id"],
        "message":      "Thank you! Your interview has been added to the database.",
    }


# ══════════════════════════════════════════════════════════════════════════════
# INTERVIEW
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/start-interview")
def start_interview(config: InterviewConfig):
    if config.interview_id:
        system_prompt = build_interview_prompt(config.interview_id)
        if not system_prompt:
            raise HTTPException(status_code=404, detail="Interview not found in database")
        if config.custom_info.strip():
            system_prompt += f"\nCandidate context: {config.custom_info}"
    else:
        base = GENERIC_PROMPTS.get(config.category or "Software Engineer", GENERIC_PROMPTS["Software Engineer"])
        system_prompt = base + (f" Candidate context: {config.custom_info}" if config.custom_info.strip() else "")

    interview_ai.system_prompt = system_prompt
    interview_ai.messages = [{"role": "system", "content": system_prompt}]

    first_message = interview_ai.predict("Begin the interview now.")
    print(f"DEBUG: Primeira mensagem → '{first_message[:80]}...'")

    return {
        "message":      first_message,
        "audio_base64": generate_tts(first_message),
    }


@app.post("/reset-interview")
def reset_interview():
    interview_ai.messages = [{"role": "system", "content": interview_ai.system_prompt}]
    return {"status": "ok"}


@app.post("/feedback")
def get_feedback():
    feedback = interview_ai.predict(FEEDBACK_PROMPT)
    return {"feedback": feedback, "audio_base64": generate_tts(feedback)}


# ══════════════════════════════════════════════════════════════════════════════
# PRACTICE
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/reset")
def reset_practice():
    practice_ai.system_prompt = (
        "You are a friendly English tutor. Respond concisely (max 2 sentences). "
        "If the student makes a mistake, correct it gently."
    )
    practice_ai.messages = [{"role": "system", "content": practice_ai.system_prompt}]
    return {"status": "ok"}


# ══════════════════════════════════════════════════════════════════════════════
# AUDIO
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/upload-audio")
async def upload_audio(
    file: UploadFile = File(...),
    mode: str = Query(default="practice")
):
    temp_webm  = f"temp_{uuid.uuid4()}.webm"
    temp_wav   = temp_webm.replace(".webm", ".wav")
    audio_path = None

    content = await file.read()
    print(f"DEBUG [{mode}]: {len(content)} bytes recebidos")

    with open(temp_webm, "wb") as f:
        f.write(content)

    try:
        subprocess.run(["ffmpeg", "-y", "-i", temp_webm, temp_wav], check=True, capture_output=True)

        user_text = transcritor.transcribe(temp_wav)
        print(f"DEBUG [{mode}]: transcrito → '{user_text}'")

        ai = practice_ai if mode == "practice" else interview_ai
        ai_text = ai.predict(user_text)
        print(f"DEBUG [{mode}]: resposta → '{ai_text[:80]}...'")

        audio_path   = f"response_{uuid.uuid4()}.mp3"
        audio_base64 = generate_tts(ai_text, out_path=audio_path)

        return {
            "transcription": user_text,
            "ia_response":   ai_text,
            "audio_base64":  audio_base64,
        }

    except Exception as e:
        print(f"❌ Erro [{mode}]: {e}")
        return {"error": str(e)}

    finally:
        for f in [temp_webm, temp_wav]:
            if os.path.exists(f): os.remove(f)
        if audio_path and os.path.exists(audio_path): os.remove(audio_path)


# ── Helper TTS ────────────────────────────────────────────────────────────────

def generate_tts(text: str, out_path: str = None) -> str:
    path = out_path or f"response_{uuid.uuid4()}.mp3"
    try:
        gTTS(text=text, lang="en").save(path)
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")
    finally:
        if os.path.exists(path): os.remove(path)


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)