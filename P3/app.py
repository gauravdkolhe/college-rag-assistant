from __future__ import annotations

import os
from pathlib import Path

import httpx
import streamlit as st
from dotenv import load_dotenv
from google import genai
from google.genai.errors import APIError
from qdrant_client import QdrantClient

from rag.documents import DocumentError, parse_pdf
from rag.embeddings import create_embedding_functions
from rag.qdrant_store import QdrantCollection
from rag.service import DEFAULT_MAX_COSINE_DISTANCE, RagService

PROJECT_DIR = Path(__file__).resolve().parent
load_dotenv(PROJECT_DIR / ".env")

DOCUMENTS_DIR = PROJECT_DIR / "documents"
DEFAULT_CHAT_MODEL = "gemini-2.5-flash"
DEFAULT_CLAUDE_MODEL = "claude-3-5-sonnet-20241022"
DEFAULT_EMBEDDING_MODEL = "voyage-4-lite"
COLLECTION_NAME = "college_documents_voyage_4_lite"


def normalize_model_name(model: str) -> str:
    normalized = model.strip()
    if normalized.startswith("models/"):
        normalized = normalized.removeprefix("models/")
    return normalized


def get_setting(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    if value:
        return value

    try:
        value = st.secrets.get(name)
    except FileNotFoundError:
        value = None
    return value if isinstance(value, str) and value else default


st.set_page_config(
    page_title="College Document Q&A",
    page_icon="📚",
    layout="wide",
)


@st.cache_resource
def get_service(provider: str, chat_model: str) -> RagService:
    chat_model = normalize_model_name(chat_model)
    qdrant_url = get_setting("QDRANT_URL")
    qdrant_api_key = get_setting("QDRANT_API_KEY")
    if not qdrant_url or not qdrant_api_key:
        raise ValueError("QDRANT_URL and QDRANT_API_KEY must be configured.")
    collection = QdrantCollection(
        QdrantClient(url=qdrant_url, api_key=qdrant_api_key),
        COLLECTION_NAME,
    )
    voyage_api_key = get_setting("VOYAGE_API_KEY")
    if not voyage_api_key:
        raise ValueError("VOYAGE_API_KEY must be configured.")
    
    document_embedder, query_embedder = create_embedding_functions(
        voyage_api_key,
        model=get_setting("VOYAGE_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL)
        or DEFAULT_EMBEDDING_MODEL,
    )

    if provider == "Anthropic Claude":
        claude_api_key = get_setting("ANTHROPIC_API_KEY")
        if not claude_api_key:
            raise ValueError("ANTHROPIC_API_KEY must be configured.")
        import anthropic
        client = anthropic.Anthropic(api_key=claude_api_key)
        selected_provider = "anthropic"
    else:
        gemini_api_key = get_setting("GEMINI_API_KEY")
        if not gemini_api_key:
            raise ValueError("GEMINI_API_KEY must be configured.")
        client = genai.Client(api_key=gemini_api_key)
        selected_provider = "gemini"

    return RagService(
        client=client,
        collection=collection,
        chat_model=chat_model,
        embedder=document_embedder,
        query_embedder=query_embedder,
        provider=selected_provider,
    )


def show_connection_help(
    error: Exception,
    *,
    chat_model: str,
) -> None:
    details = str(error)
    if isinstance(error, APIError) and error.code == 429:
        st.error("The Gemini API quota for this key or project has been exceeded.")
        st.markdown(
            "Check the project's [Gemini API usage and billing]"
            "(https://ai.google.dev/gemini-api/docs/billing) and verify that "
            "the selected model is available to your account."
        )
        with st.expander("Gemini API error details"):
            st.code(details)
        return

    if isinstance(error, APIError) and error.code in {400, 403}:
        st.error(
            f"Gemini could not use model `{chat_model}` with the configured API key."
        )
        st.markdown(
            "Check that `GEMINI_API_KEY` is valid, the Gemini API is enabled for "
            "its Google project, and the model name is available."
        )
        with st.expander("Gemini API error details"):
            st.code(details)
        return

    st.error(f"Model or embedding request failed: {details}")
    st.caption(
        "Check GEMINI_API_KEY, GEMINI_MODEL, VOYAGE_API_KEY, and Qdrant "
        "settings in Streamlit secrets or .env."
    )


def index_documents_folder(
    service: RagService,
    *,
    reindex: bool = False,
) -> tuple[list[tuple[str, int]], list[tuple[str, str]]]:
    if not DOCUMENTS_DIR.is_dir():
        return [], [(str(DOCUMENTS_DIR), "The documents folder does not exist.")]

    indexed_sources = service.list_sources()
    indexed: list[tuple[str, int]] = []
    errors: list[tuple[str, str]] = []
    for path in sorted(DOCUMENTS_DIR.glob("*.pdf"), key=lambda item: item.name.casefold()):
        if not reindex and path.name in indexed_sources:
            continue
        try:
            document = parse_pdf(path.name, path.read_bytes())
            indexed.append((path.name, service.index_document(document)))
        except (
            DocumentError,
            ValueError,
            RuntimeError,
            OSError,
            httpx.HTTPError,
        ) as exc:
            errors.append((path.name, str(exc)))
    return indexed, errors


st.title("College Document Q&A Assistant")
st.write(
    "Ask questions about your college PDFs. Answers are generated by a hosted "
    "Gemini model and grounded in passages retrieved from your documents."
)

with st.sidebar:
    st.header("LLM Provider & Model")
    provider = st.selectbox("Select LLM Provider", ["Google Gemini", "Anthropic Claude"])
    
    if provider == "Anthropic Claude":
        configured_claude_model = get_setting("ANTHROPIC_MODEL", DEFAULT_CLAUDE_MODEL)
        chat_model = st.text_input(
            "Claude Model",
            value=configured_claude_model or DEFAULT_CLAUDE_MODEL,
            help="Choose Claude model e.g., claude-3-5-sonnet-20241022 or claude-3-haiku-20240307",
        )
        has_key = bool(get_setting("ANTHROPIC_API_KEY"))
        st.caption(f"Anthropic API key: {'✅ configured' if has_key else '⚠️ missing'}")
    else:
        configured_chat_model = get_setting("GEMINI_MODEL", DEFAULT_CHAT_MODEL)
        chat_model = st.text_input(
            "Gemini Model",
            value=configured_chat_model or DEFAULT_CHAT_MODEL,
            help="Choose a Gemini model enabled for your Google AI Studio API key.",
        )
        has_key = bool(get_setting("GEMINI_API_KEY"))
        st.caption(f"Gemini API key: {'✅ configured' if has_key else '⚠️ missing'}")

    st.text(f"Embeddings: {get_setting('VOYAGE_EMBEDDING_MODEL', DEFAULT_EMBEDDING_MODEL)}")
    top_k = st.slider("Passages to retrieve", min_value=1, max_value=8, value=4)
    max_distance = st.slider(
        "Retrieval distance cutoff",
        min_value=0.1,
        max_value=1.2,
        value=DEFAULT_MAX_COSINE_DISTANCE,
        step=0.05,
        help=(
            "Cosine distance threshold. Lower values require closer matches and "
            "increase safe refusals. Calibrate against your own documents."
        ),
    )
    st.caption("A smaller distance means a closer semantic match.")

try:
    service = get_service(provider, chat_model.strip())
except (OSError, ValueError) as exc:
    st.error(f"Could not initialize the RAG service: {exc}")
    st.stop()

st.subheader("1. Documents")
st.caption(f"PDFs in `{DOCUMENTS_DIR.name}/` are indexed automatically.")
if not st.session_state.get("documents_folder_checked", False):
    folder_indexed, folder_errors = index_documents_folder(service)
    st.session_state["documents_folder_checked"] = True
else:
    folder_indexed, folder_errors = [], []
for source, chunk_count in folder_indexed:
    st.success(f"Indexed {source}: {chunk_count} passages.")
for source, message in folder_errors:
    st.error(f"{source}: {message}")
if st.button("Reindex PDFs in documents folder"):
    with st.spinner("Reindexing PDFs from the documents folder..."):
        folder_indexed, folder_errors = index_documents_folder(service, reindex=True)
    for source, chunk_count in folder_indexed:
        st.success(f"Reindexed {source}: {chunk_count} passages.")
    for source, message in folder_errors:
        st.error(f"{source}: {message}")

st.caption(
    "You can also add individual PDFs below. Extracted text and embeddings are "
    "stored locally."
)
st.caption(
    "Upload readable PDFs up to 25 MB each. Scanned/image-only PDFs require OCR "
    "before they can be searched."
)
uploads = st.file_uploader(
    "Choose one or more PDF files",
    type=["pdf"],
    accept_multiple_files=True,
    help="Documents are processed locally and their extracted text is stored locally.",
)
if st.button("Index uploaded PDFs", type="primary", disabled=not uploads):
    for upload in uploads or []:
        try:
            document = parse_pdf(upload.name, upload.getvalue())
            count = service.index_document(document)
            st.success(
                f"Indexed {upload.name}: {count} passages from "
                f"{document.pages_with_text}/{document.total_pages} text pages."
            )
        except (DocumentError, ValueError, RuntimeError) as exc:
            st.error(f"{upload.name}: {exc}")
        except (
            ConnectionError,
            TimeoutError,
            OSError,
            httpx.HTTPError,
        ) as exc:
            show_connection_help(exc, chat_model=chat_model)

sources = service.list_sources()
if sources:
    st.subheader("Indexed documents")
    for source, chunk_count in sorted(sources.items(), key=lambda item: item[0].casefold()):
        left, right = st.columns([5, 1])
        left.write(f"**{source}** · {chunk_count} passages")
        if right.button("Remove", key=f"remove-{source}"):
            service.remove_source(source)
            st.rerun()
else:
    st.info("No documents are indexed yet. Add PDFs above to get started.")

st.subheader("2. Ask a question")
with st.form("question-form"):
    question = st.text_input(
        "Your question",
        placeholder="For example: What attendance is required to sit semester exams?",
        max_chars=1000,
    )
    submitted = st.form_submit_button("Ask the documents", type="primary")

if submitted:
    if not question.strip():
        st.warning("Enter a question before submitting.")
    elif not sources:
        st.info("Index at least one document before asking a question.")
    elif provider == "Google Gemini" and not get_setting("GEMINI_API_KEY"):
        st.error(
            "Configure GEMINI_API_KEY in Streamlit secrets or the .env file, then restart the app."
        )
    elif provider == "Anthropic Claude" and not get_setting("ANTHROPIC_API_KEY"):
        st.error(
            "Configure ANTHROPIC_API_KEY in Streamlit secrets or the .env file, then restart the app."
        )
    else:
        try:
            answer = service.answer(
                question,
                top_k=top_k,
                max_distance=max_distance,
            )
            st.markdown("### Answer")
            st.write(answer.text)
            if answer.sources:
                st.markdown("### Sources")
                seen: set[tuple[str, int]] = set()
                for passage in answer.sources:
                    key = (passage.source, passage.page)
                    if key in seen:
                        continue
                    seen.add(key)
                    st.markdown(
                        f"- **{passage.source}**, page {passage.page} "
                        f"(cosine distance {passage.distance:.3f})"
                    )
                with st.expander("View retrieved passages"):
                    for passage in answer.sources:
                        st.markdown(
                            f"**{passage.source} · page {passage.page}**\n\n"
                            f"{passage.text}"
                        )
        except (
            ConnectionError,
            TimeoutError,
            OSError,
            httpx.HTTPError,
            APIError,
            RuntimeError,
        ) as exc:
            show_connection_help(exc, chat_model=chat_model)

st.divider()
st.caption(
    "Document text, vector index, and embeddings stay on this machine. The "
    "question and retrieved passages are sent to Gemini for answer "
    "generation. Verify important policies in the original college documents."
)
