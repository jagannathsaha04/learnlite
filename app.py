import json
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import requests

app = FastAPI(title="LearnLite - Week 2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = "http://localhost:11434/api/generate"
MAX_QUESTION_CHARS = 600
MAX_HISTORY_TURNS = 12
MAX_TURN_CHARS = 1200
OLLAMA_TIMEOUT_SEC = 60
OLLAMA_RETRIES = 2

LEVEL_INSTRUCTIONS = {
    "beginner": "Explain like I am 8 years old. Use a fun analogy or story. Keep it very simple.",
    "intermediate": "Explain clearly with examples, suitable for a 12-year-old student.",
    "advanced": "Give a deeper, technical explanation with relevant details and equations if needed.",
}

LANGUAGE_INSTRUCTIONS = {
    "English": "Answer in English.",
    "Hindi": "Answer entirely in Hindi (Devanagari script).",
    "Bengali": "Answer entirely in Bengali (Bangla script).",
    "Tamil": "Answer entirely in Tamil script.",
}

SUBJECT_INSTRUCTIONS = {
    "Science": "Focus on conceptual understanding using real-world analogies and simple examples.",
    "Math": "Solve step-by-step and show all intermediate calculations clearly.",
}

LevelLiteral = Literal["beginner", "intermediate", "advanced"]
LanguageLiteral = Literal["English", "Hindi", "Bengali", "Tamil"]
SubjectLiteral = Literal["general", "Science", "Math"]
RoleLiteral = Literal["user", "assistant"]


class ChatTurn(BaseModel):
    role: RoleLiteral
    content: str = Field(min_length=1, max_length=MAX_TURN_CHARS)


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=MAX_QUESTION_CHARS)
    level: LevelLiteral = "intermediate"
    subject: SubjectLiteral = "general"
    language: LanguageLiteral = "English"
    explain_simply: bool = False
    history: list[ChatTurn] = Field(default_factory=list, max_length=MAX_HISTORY_TURNS)


def build_prompt(payload: AskRequest) -> str:
    level_instr = LEVEL_INSTRUCTIONS.get(payload.level, LEVEL_INSTRUCTIONS["intermediate"])
    language_instr = LANGUAGE_INSTRUCTIONS.get(payload.language, "Answer in English.")
    subject_instr = SUBJECT_INSTRUCTIONS.get(
        payload.subject, "Be accurate, friendly, and educational."
    )
    subject_ctx = (
        f"You are an expert {payload.subject} teacher."
        if payload.subject != "general"
        else "You are a helpful teacher."
    )
    simplify_instr = (
        "Additionally, simplify complex terms into very easy language and short sentences."
        if payload.explain_simply
        else ""
    )
    history_lines = [
        f"{turn.role.title()}: {turn.content.strip()}" for turn in payload.history[-MAX_HISTORY_TURNS:]
    ]
    history_block = "\n".join(history_lines) if history_lines else "No prior context."

    return f"""{subject_ctx}

{subject_instr}
{level_instr}
{simplify_instr}

Conversation context (latest turns):
{history_block}

Structure your answer as exactly 3-5 numbered steps.
For math, use LaTeX between $$...$$ for formulas when helpful.
Be concise and clear.
{language_instr}

Question: {payload.question.strip()}
"""


def call_ollama_non_streaming(prompt: str) -> str:
    last_error = "Unknown model error"
    for _ in range(OLLAMA_RETRIES + 1):
        try:
            response = requests.post(
                OLLAMA_URL,
                json={
                    "model": "gemma:2b",
                    "prompt": prompt,
                    "stream": False,
                },
                timeout=OLLAMA_TIMEOUT_SEC,
            )
            response.raise_for_status()
            data = response.json()
            answer = data.get("response")
            if not isinstance(answer, str) or not answer.strip():
                raise ValueError("Malformed model response payload")
            return answer.strip()
        except Exception as exc:
            last_error = str(exc)
    raise RuntimeError(last_error)


def validate_and_build(payload: AskRequest) -> str:
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    if len(payload.question.strip()) > MAX_QUESTION_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Question too long. Max {MAX_QUESTION_CHARS} characters.",
        )
    return build_prompt(payload)


@app.get("/")
def home():
    return {
        "message": "LearnLite Week 2 Backend Running",
        "offline": True,
        "features": {
            "streaming": True,
            "memory": True,
            "latex": True,
            "persistence": "frontend-localstorage",
        },
    }


@app.post("/ask")
def ask_question(payload: AskRequest):
    prompt = validate_and_build(payload)
    try:
        answer = call_ollama_non_streaming(prompt)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Error contacting model after retries: {str(exc)}",
        ) from exc

    return {
        "answer": answer,
        "language": payload.language,
        "subject": payload.subject,
        "level": payload.level,
        "explain_simply": payload.explain_simply,
        "context_turns_used": len(payload.history[-MAX_HISTORY_TURNS:]),
        "offline": True,
    }


@app.post("/ask/stream")
def ask_question_stream(payload: AskRequest):
    prompt = validate_and_build(payload)

    def event_stream():
        try:
            with requests.post(
                OLLAMA_URL,
                json={
                    "model": "gemma:2b",
                    "prompt": prompt,
                    "stream": True,
                },
                stream=True,
                timeout=OLLAMA_TIMEOUT_SEC,
            ) as response:
                response.raise_for_status()
                for raw_line in response.iter_lines(decode_unicode=True):
                    if not raw_line:
                        continue
                    try:
                        chunk = json.loads(raw_line)
                    except json.JSONDecodeError:
                        continue

                    token = chunk.get("response", "")
                    if token:
                        yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
                    if chunk.get("done", False):
                        done_payload = {
                            "type": "done",
                            "language": payload.language,
                            "subject": payload.subject,
                            "level": payload.level,
                            "explain_simply": payload.explain_simply,
                            "context_turns_used": len(payload.history[-MAX_HISTORY_TURNS:]),
                        }
                        yield f"data: {json.dumps(done_payload)}\n\n"
                        return
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
