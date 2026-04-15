from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests

app = FastAPI(title="LearnLite Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = "http://localhost:11434/api/generate"

@app.get("/")
def home():
    return {"message": "LearnLite Backend Running"}

@app.post("/ask")
def ask_question(question: str, mode: str = "normal", subject: str = "general"):

    if mode == "simple":
        instruction = "Explain like I'm 8 years old. Use a fun analogy."
    elif mode == "advanced":
        instruction = "Explain with technical depth, equations if relevant."
    else:
        instruction = "Explain clearly with examples, suitable for a 12-year-old."

    subject_ctx = f"The subject is {subject}. " if subject != "general" else ""

    prompt = f"""You are a friendly, patient school teacher.
{subject_ctx}{instruction}

Give a step-by-step explanation with numbered points.
Keep it concise — 3 to 5 steps maximum.

Question: {question}
"""

    response = requests.post(OLLAMA_URL, json={
        "model": "gemma:2b",
        "prompt": prompt,
        "stream": False
    })

    return {"answer": response.json()["response"]}
