# LearnLite (Gemma via Ollama) — Local Web App

A tiny local “LearnLite” web app:

- **Frontend**: `index.html` (a chat UI you open in your browser)
- **Backend**: `app.py` (FastAPI server)
- **LLM runtime**: **Ollama** (runs `gemma:2b` locally and exposes an HTTP API)

Everything runs on your computer.

---

## How it works (end-to-end)

1. You type a question in the browser UI (`index.html`).
2. The UI sends a request to the backend:
   - `POST http://127.0.0.1:8000/ask?question=...&mode=...&subject=...`
3. The backend (`app.py`) builds a tutor-style prompt based on:
   - **mode**: `normal` / `simple` / `advanced`
   - **subject**: optional context like “Mathematics”, “Science”, etc.
4. The backend calls Ollama’s local API:
   - `POST http://localhost:11434/api/generate`
   - with JSON like:
     - `model: "gemma:2b"`
     - `prompt: "<constructed prompt>"`
     - `stream: false`
5. Ollama generates the response using the local model and returns JSON.
6. The backend returns `{"answer": "<text>"}` to the browser.
7. The browser displays the answer as step-by-step “chips/steps”.

---

## Requirements

- **Python 3.10+** (recommended)
- **Ollama installed** and working
  - Quick check:
    - `ollama --version`
    - `ollama list`

### Python packages

The backend uses:

- `fastapi`
- `uvicorn`
- `requests`

Install them (from this folder):

```powershell
python -m pip install -r requirements.txt
```

Alternative:

```powershell
python -m pip install fastapi uvicorn requests
```

---

## Start the app

### 1) Start / verify Ollama

In a terminal:

```powershell
ollama --version
```

If `gemma:2b` isn’t downloaded yet, you can pull it ahead of time:

```powershell
ollama pull gemma:2b
```

Ollama serves a local API at:

- `http://localhost:11434`

### 2) Start the backend (FastAPI)

From `C:\Studies\Gemma4Good\files`:

```powershell
python -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

Quick health check in your browser:

- Open `http://127.0.0.1:8000/`
- You should see: `{"message":"LearnLite Backend Running"}`

### 3) Open the frontend

Open `index.html` in your browser (double-click it).

Then ask a question.

---

## Using the app

- **Mode buttons**:
  - **Normal**: clear explanation + examples (aimed at ~12-year-old level)
  - **Simple (age 8)**: simpler language + fun analogy
  - **Advanced**: more technical depth, equations if relevant
- **Subject dropdown**: adds light context like “The subject is Mathematics.”

---

## Troubleshooting

### “ollama is not recognized…”

That means your terminal session doesn’t see Ollama on `PATH`.

- Open a **new terminal** (most reliable), or refresh PATH in PowerShell:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

Then:

```powershell
ollama --version
```

If you need a guaranteed run:

```powershell
& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" --version
```

### Frontend says “Couldn’t reach the backend…”

- Make sure the backend is running on **127.0.0.1:8000**:
  - Start it with the uvicorn command above.
- If you changed the backend host/port, update `API` in `index.html`:
  - `const API = "http://127.0.0.1:8000";`

### Backend errors when calling the model

The backend calls:

- `http://localhost:11434/api/generate`

So ensure Ollama is running and reachable:

```powershell
ollama list
```

If the model is missing:

```powershell
ollama pull gemma:2b
```

### Port conflicts

- Backend uses **8000**
- Ollama uses **11434**

If either port is already in use, either stop the conflicting process or change ports and update the frontend `API` constant accordingly.

---

## Files

- `app.py`: FastAPI backend; builds a prompt and calls Ollama (`/api/generate`)
- `index.html`: single-file chat UI; calls backend `/ask`

