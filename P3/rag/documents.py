from dataclasses import dataclass
from io import BytesIO

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from rag.chunking import chunk_text

MAX_PDF_BYTES = 25 * 1024 * 1024
MAX_PDF_PAGES = 1000


class DocumentError(ValueError):
    """An uploaded document cannot be safely indexed."""


@dataclass(frozen=True)
class DocumentChunk:
    text: str
    source: str
    page: int
    chunk_index: int


@dataclass(frozen=True)
class ParsedDocument:
    source: str
    total_pages: int
    pages_with_text: int
    chunks: list[DocumentChunk]


def safe_source_name(filename: str) -> str:
    name = filename.replace("\\", "/").rsplit("/", maxsplit=1)[-1].strip()
    if not name or name in {".", ".."}:
        raise DocumentError("The uploaded PDF must have a valid file name.")
    return name


def parse_pdf(
    filename: str,
    content: bytes,
    chunk_size: int = 1200,
    overlap: int = 180,
) -> ParsedDocument:
    source = safe_source_name(filename)
    if not source.lower().endswith(".pdf"):
        raise DocumentError("Only PDF documents can be added.")
    if not content:
        raise DocumentError(f"{source} is empty.")
    if len(content) > MAX_PDF_BYTES:
        raise DocumentError(f"{source} exceeds the 25 MB upload limit.")
    if b"%PDF-" not in content[:1024]:
        raise DocumentError(f"{source} is not a valid PDF file.")

    try:
        reader = PdfReader(BytesIO(content), strict=False)
    except (PdfReadError, OSError, ValueError) as exc:
        raise DocumentError(f"Could not read {source}: {exc}") from exc

    if reader.is_encrypted:
        raise DocumentError(f"{source} is password-protected and cannot be indexed.")
    if len(reader.pages) > MAX_PDF_PAGES:
        raise DocumentError(f"{source} exceeds the {MAX_PDF_PAGES}-page limit.")

    chunks: list[DocumentChunk] = []
    pages_with_text = 0
    for page_number, page in enumerate(reader.pages, start=1):
        try:
            page_text = page.extract_text() or ""
        except (PdfReadError, OSError, ValueError) as exc:
            raise DocumentError(
                f"Could not extract text from page {page_number} of {source}: {exc}"
            ) from exc
        page_chunks = chunk_text(page_text, chunk_size=chunk_size, overlap=overlap)
        if page_chunks:
            pages_with_text += 1
        chunks.extend(
            DocumentChunk(
                text=text,
                source=source,
                page=page_number,
                chunk_index=chunk_index,
            )
            for chunk_index, text in enumerate(page_chunks, start=1)
        )

    return ParsedDocument(
        source=source,
        total_pages=len(reader.pages),
        pages_with_text=pages_with_text,
        chunks=chunks,
    )
