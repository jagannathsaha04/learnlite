from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests

app = FastAPI(title="LearnLite - Week 2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = "http://localhost:11434/api/generate"

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


@app.get("/")
def home():
    return {"message": "LearnLite Week 2 Backend Running", "offline": True}


@app.post("/ask")
def ask_question(
    question: str,
    level: str = "intermediate",
    subject: str = "general",
    language: str = "English",
    explain_simply: bool = False,
):
    level_instr = LEVEL_INSTRUCTIONS.get(level, LEVEL_INSTRUCTIONS["intermediate"])
    language_instr = LANGUAGE_INSTRUCTIONS.get(language, "Answer in English.")
    subject_instr = SUBJECT_INSTRUCTIONS.get(
        subject, "Be accurate, friendly, and educational."
    )
    subject_ctx = (
        f"You are an expert {subject} teacher."
        if subject != "general"
        else "You are a helpful teacher."
    )
    simplify_instr = (
        "Additionally, simplify complex terms into very easy language and short sentences."
        if explain_simply
        else ""
    )

    prompt = f"""{subject_ctx}

{subject_instr}
{level_instr}
{simplify_instr}

Structure your answer as exactly 3-5 numbered steps.
Be concise and clear.
{language_instr}

Question: {question}
"""

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": "gemma:2b",
                "prompt": prompt,
                "stream": False,
            },
            timeout=60,
        )
        answer = response.json()["response"]
    except Exception as e:
        answer = f"Error contacting model: {str(e)}"

    return {
        "answer": answer,
        "language": language,
        "subject": subject,
        "level": level,
        "explain_simply": explain_simply,
        "offline": True,
    }
