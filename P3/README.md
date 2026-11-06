# College Document Q&A Assistant

A Retrieval-Augmented Generation (RAG) application for asking natural-language questions about college PDF documents. It extracts and chunks PDF text, creates Gemini embeddings, searches a Qdrant Cloud vector collection, and asks Gemini to answer only from retrieved excerpts. Retrieved document names and page numbers are shown with each answer; weak matches receive a safe refusal.

This project is implemented and managed as a **single-person project**. Jira is used only for planning and progress tracking; it is not connected to the application.

## Features

- PDF upload and text extraction with source filename and page retention.
- Automatic indexing of PDFs in `documents/`, plus optional PDF upload.
- Overlapping text chunks and Voyage AI `voyage-4-lite` semantic embeddings.
- Qdrant Cloud storage; re-indexing a same-named PDF replaces its previous passages.
- Grounded answers from Gemini (`gemini-3.8-flash` by default).
- Configurable retrieval distance threshold and top-passage count.
- Explicit refusal when no document is indexed or retrieved evidence is weak.
- Local source citations and document removal.
- No cloud database or Jira integration.

Scanned/image-only PDFs require OCR before upload. OCR is intentionally not bundled; use a trusted local OCR tool and review its output before indexing.

## Prerequisites

Choose one of these run methods:

- **Python:** Python 3.10+ and a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).
- **Docker:** Docker Engine/Desktop with Compose and a Gemini API key.

The chat model defaults to `gemini-3.8-flash`; set `GEMINI_MODEL` to another model available to your API key. Embeddings default to Voyage AI `voyage-4-lite`; set `VOYAGE_EMBEDDING_MODEL` to another supported model if needed. Qdrant Cloud is configured with `QDRANT_URL` and `QDRANT_API_KEY`. The local `.env` file is loaded automatically and is excluded from version control.

## Run with Python

From the `P3` directory:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Add your key from https://aistudio.google.com/apikey to GEMINI_API_KEY in .env
python -m streamlit run app.py
```

Open `http://localhost:8501`. On macOS/Linux, run `test -f .env || cp .env.example .env`, add your Google AI Studio key to `GEMINI_API_KEY`, then run `python -m streamlit run app.py`. Keep the key private and do not commit it.

The app automatically indexes PDFs from `documents/` on startup. It skips files already indexed; use **Reindex PDFs in documents folder** to pick up changes to an existing file. Use **Reindex PDFs in documents folder** after changing a source PDF.

## Deploy on Streamlit Community Cloud

1. Push this `P3` directory to a GitHub repository (or use it as the repository root).
2. In [Streamlit Community Cloud](https://share.streamlit.io/), create an app with:
   - **Main file path:** `P3/app.py` when `P3` is a subdirectory, otherwise `app.py`.
   - **Python version:** `3.12` (also recorded in `.python-version`; do not select Python 3.14).
3. Create a Qdrant Cloud cluster and copy its cluster URL and API key.
4. Add the following under **Advanced settings → Secrets**:

   ```toml
   GEMINI_API_KEY = "your_google_ai_studio_api_key"
   GEMINI_MODEL = "gemini-3.8-flash"
   VOYAGE_API_KEY = "your_voyage_api_key"
   VOYAGE_EMBEDDING_MODEL = "voyage-4-lite"
   QDRANT_URL = "https://your-cluster.qdrant.io"
   QDRANT_API_KEY = "your_qdrant_cloud_api_key"
   ```

The app reads Streamlit secrets in the cloud and `.env` locally. Qdrant stores vectors and metadata outside the ephemeral Streamlit process. The PDFs committed in `documents/` are indexed automatically after startup. Uploaded PDFs are not durable, so keep permanent source PDFs in `documents/`. Never commit `.env` or `secrets.toml`.

## Run with Docker Compose

From the `P3` directory:

```powershell
docker compose up --build
```

Put `GEMINI_API_KEY`, `QDRANT_URL`, and `QDRANT_API_KEY` in `.env` before starting Compose. Compose builds the app, mounts `documents/` read-only, and exposes the UI at `http://localhost:8501`. Set `GEMINI_MODEL` to choose another model. Keep all keys private and do not commit them.

Stop the service with `Ctrl+C`, then `docker compose down`. Qdrant Cloud retains the vector index independently of the container.

## Use the application

1. Start the app; PDFs in `documents/` are indexed automatically.
2. Confirm each file's indexed passage count, or select **Reindex PDFs in documents folder** after changing them.
3. Ask a question using the document's wording or a paraphrase.
4. Check the cited source and page against the original PDF.
5. Adjust the retrieval distance cutoff if your own evaluation shows too many refusals or weak matches.

PDF text extraction stays in the app process. Embeddings use Voyage AI, answer generation uses Google's Gemini API, and vectors/metadata are stored in Qdrant Cloud. Do not index sensitive student records. Review the providers' data handling terms before using non-public documents.

## Evaluation

Start with [`evaluation/questions.csv`](./evaluation/questions.csv), which contains 50 direct, paraphrased, and unanswerable question prompts. Adapt it to the documents you have permission to use, fill in the expected source/answer for answerable questions, and verify the unanswerable cases are truly absent:

- Direct questions answerable from a known source.
- Paraphrased questions testing semantic retrieval.
- At least 10 unanswerable questions whose answers are absent from the indexed material.

For each answerable case, record the expected document, retrieved source, and whether retrieval was correct. Calculate retrieval accuracy as correct expected-source retrievals divided by answerable test questions. For answer quality, have a human rate correctness, relevance, groundedness, clarity, and completeness from 1–5. Calculate safe refusal rate as correct refusals divided by unanswerable questions. Store completed evaluation records locally (for example, under `evaluation/results/`, which is git-ignored); do not treat a model's self-assessment as ground truth.

The cosine-distance threshold is a practical retrieval guard, not a calibrated guarantee. Tune it against your own test set. Always verify important academic, examination, financial, and placement policies against their cited originals.

## Single-person Jira workflow

Use one Jira project, one assignee (the developer), and a simple sequential workflow such as **To Do → In Progress → Testing → Done**. Keep the specification's work grouped into these solo phases:

1. Requirements and permitted sample documents.
2. Gemini API setup and PDF extraction.
3. Chunking, embeddings, ChromaDB, retrieval, citations, and refusal behavior.
4. Streamlit interface and end-to-end checks.
5. Evaluation, documentation, and demonstration.

Create stories and defects as needed, but do not split work across team members or add collaboration-only review gates. Jira remains an independent project-management tool.

## Tests

Run the dependency-light unit tests with:

```powershell
python -m unittest discover -s tests -v
```

The tests cover chunk boundaries/overlap, safe PDF source-name handling, and RAG retrieval/answer behavior. The Gemini API call requires a valid API key and network access.

## Limitations

- This is a local deployment, not a public multi-user hosted service. Exposing Streamlit to the internet is not supported.
- PDF text extraction does not OCR image-only pages.
- Retrieval and answer quality depend on source PDF quality, model choice, and threshold calibration.
- Treat cited passages as evidence and verify consequential answers in the original college regulations.
