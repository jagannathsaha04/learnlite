# LearnLite - Fullstack Offline AI Tutor

LearnLite is now a fullstack app with:

- **Backend**: `app.py` (FastAPI + Ollama request layer)
- **Frontend**: `frontend/` (React + Tailwind + chat UI)
- **LLM runtime**: local Ollama model (`gemma:2b` by default)

Everything runs locally on your machine for offline demos.

## Features

1. **AI Question Answering**
   - Ask academic questions in natural language
   - Subject-aware tutoring for Science and Math
   - 3-5 step structured answers
2. **Multilingual Support**
   - English, Hindi, Bengali, Tamil
   - Output follows selected language
3. **Personalized Levels**
   - Beginner, Student, Advanced
4. **Subject Awareness**
   - Science -> conceptual explanation mode
   - Math -> solve with explicit intermediate steps
5. **Offline Functionality**
   - FastAPI + Ollama local inference
   - Works without internet
6. **Chat Interface**
   - Conversational Q&A UI
7. **Voice Output (Week 3)**
   - Browser speech synthesis reads responses
8. **Voice Input (Optional)**
   - Browser speech recognition for dictation
9. **Explain Simply Mode**
   - Additional simplification pass for complex topics
10. **Demo-Friendly Controls**
   - Live language switch
   - Live level switch
   - Offline-ready UI messaging

## Run the app

### 1) Install backend dependencies

```powershell
python -m pip install -r requirements.txt
```

### 2) Start Ollama and ensure model exists

```powershell
ollama list
ollama pull gemma:2b
```

### 3) Start backend

```powershell
python -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

### 4) Start frontend

```powershell
cd frontend
npm install
npm run dev
```

Open the URL shown by Vite (usually `http://127.0.0.1:5173`).

## API

- `GET /` -> backend health/offline status
- `POST /ask`
  - Query params:
    - `question` (required)
    - `level` = `beginner|intermediate|advanced`
    - `subject` = `general|Science|Math`
    - `language` = `English|Hindi|Bengali|Tamil`
    - `explain_simply` = `true|false`

## Project structure

- `app.py` - FastAPI backend and tutor prompt construction
- `requirements.txt` - Python dependencies
- `frontend/` - React + Tailwind client

