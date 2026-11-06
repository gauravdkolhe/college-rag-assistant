import unittest
from types import SimpleNamespace

from rag.documents import DocumentChunk, ParsedDocument
from rag.service import NOT_FOUND_ANSWER, RagService


class FakeCollection:
    def __init__(self) -> None:
        self.records: dict[str, dict[str, object]] = {}

    def count(self) -> int:
        return len(self.records)

    def delete(
        self, where: dict[str, str] | None = None, ids: list[str] | None = None
    ) -> None:
        if ids is not None:
            for key in ids:
                self.records.pop(key, None)
        if where is not None:
            self.records = {
                key: value
                for key, value in self.records.items()
                if value["metadata"]["source"] != where["source"]
            }

    def upsert(
        self,
        ids: list[str],
        documents: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict[str, object]],
    ) -> None:
        for key, text, embedding, metadata in zip(
            ids, documents, embeddings, metadatas
        ):
            self.records[key] = {
                "text": text,
                "embedding": embedding,
                "metadata": metadata,
                "distance": 0.2,
            }

    def get(
        self,
        where: dict[str, str] | None = None,
        include: list[str] | None = None,
    ) -> dict[str, object]:
        matched = [
            (key, value)
            for key, value in self.records.items()
            if where is None or value["metadata"]["source"] == where["source"]
        ]
        return {
            "ids": [key for key, _ in matched],
            "metadatas": [record["metadata"] for _, record in matched],
        }

    def query(
        self,
        query_embeddings: list[list[float]],
        n_results: int,
        include: list[str],
    ) -> dict[str, list[list[object]]]:
        records = list(self.records.values())[:n_results]
        return {
            "documents": [[record["text"] for record in records]],
            "metadatas": [[record["metadata"] for record in records]],
            "distances": [[record["distance"] for record in records]],
        }


class FakeClient:
    def __init__(self) -> None:
        self.chat_calls: list[dict[str, object]] = []
        self.fail_embedding = False
        self.models = self

    def embed_texts(self, input: list[str]) -> list[list[float]]:
        if self.fail_embedding:
            raise RuntimeError("embedding model unavailable")
        return [[1.0, 0.0] for _ in input]

    def generate_content(self, **kwargs: object) -> SimpleNamespace:
        self.chat_calls.append(kwargs)
        return SimpleNamespace(text="The requirement is stated in the handbook.")


class RagServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = FakeClient()
        self.collection = FakeCollection()
        self.service = RagService(
            client=self.client,
            collection=self.collection,
            chat_model="test-chat",
            embedder=self.client.embed_texts,
        )

    def test_indexing_preserves_document_and_page_metadata(self) -> None:
        document = ParsedDocument(
            source="handbook.pdf",
            total_pages=1,
            pages_with_text=1,
            chunks=[
                DocumentChunk(
                    text="Students need 75 percent attendance.",
                    source="handbook.pdf",
                    page=3,
                    chunk_index=1,
                )
            ],
        )

        self.assertEqual(self.service.index_document(document), 1)
        self.assertEqual(self.service.list_sources(), {"handbook.pdf": 1})
        indexed = next(iter(self.collection.records.values()))
        self.assertEqual(indexed["metadata"]["page"], 3)

    def test_reindexing_replaces_stale_chunks(self) -> None:
        initial = ParsedDocument(
            source="handbook.pdf",
            total_pages=1,
            pages_with_text=1,
            chunks=[
                DocumentChunk("First passage", "handbook.pdf", 1, 1),
                DocumentChunk("Second passage", "handbook.pdf", 1, 2),
            ],
        )
        updated = ParsedDocument(
            source="handbook.pdf",
            total_pages=1,
            pages_with_text=1,
            chunks=[DocumentChunk("Updated passage", "handbook.pdf", 1, 1)],
        )
        self.service.index_document(initial)
        self.service.index_document(updated)

        self.assertEqual(self.service.list_sources(), {"handbook.pdf": 1})
        self.assertEqual(
            next(iter(self.collection.records.values()))["text"],
            "Updated passage",
        )

    def test_embedding_failure_keeps_the_existing_index(self) -> None:
        initial = ParsedDocument(
            source="handbook.pdf",
            total_pages=1,
            pages_with_text=1,
            chunks=[DocumentChunk("Existing passage", "handbook.pdf", 1, 1)],
        )
        replacement = ParsedDocument(
            source="handbook.pdf",
            total_pages=1,
            pages_with_text=1,
            chunks=[DocumentChunk("Replacement passage", "handbook.pdf", 1, 1)],
        )
        self.service.index_document(initial)
        self.client.fail_embedding = True

        with self.assertRaisesRegex(RuntimeError, "model unavailable"):
            self.service.index_document(replacement)

        self.assertEqual(
            next(iter(self.collection.records.values()))["text"],
            "Existing passage",
        )

    def test_weak_retrieval_refuses_without_calling_the_llm(self) -> None:
        self.collection.records["weak-match"] = {
            "text": "The college has a library.",
            "metadata": {"source": "handbook.pdf", "page": 1},
            "distance": 0.9,
        }

        answer = self.service.answer("What is the hostel fee?")

        self.assertEqual(answer.text, NOT_FOUND_ANSWER)
        self.assertEqual(answer.sources, [])
        self.assertEqual(self.client.chat_calls, [])

    def test_supported_retrieval_calls_llm_and_returns_source(self) -> None:
        self.collection.records["attendance"] = {
            "text": "Maintain at least 75 percent attendance.",
            "metadata": {"source": "regulations.pdf", "page": 12},
            "distance": 0.2,
        }

        answer = self.service.answer("What attendance is required?")

        self.assertIn("requirement", answer.text)
        self.assertEqual(len(answer.sources), 1)
        self.assertEqual(answer.sources[0].source, "regulations.pdf")
        prompt = self.client.chat_calls[0]["contents"]
        self.assertIn("regulations.pdf, page 12", prompt)
        self.assertIn("75 percent attendance", prompt)


if __name__ == "__main__":
    unittest.main()
