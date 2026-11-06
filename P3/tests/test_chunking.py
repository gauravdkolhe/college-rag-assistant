import unittest

from rag.chunking import chunk_text


class ChunkTextTests(unittest.TestCase):
    def test_returns_empty_for_blank_text(self) -> None:
        self.assertEqual(chunk_text(" \n\t "), [])

    def test_chunks_overlap_and_cover_the_input(self) -> None:
        text = " ".join(f"word{i}" for i in range(30))
        chunks = chunk_text(text, chunk_size=40, overlap=10)

        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(chunk) <= 40 for chunk in chunks))
        self.assertTrue(all(chunk.strip() for chunk in chunks))
        self.assertTrue(all(left.split()[-1] in right for left, right in zip(chunks, chunks[1:])))

    def test_rejects_invalid_chunk_settings(self) -> None:
        with self.assertRaises(ValueError):
            chunk_text("text", chunk_size=0)
        with self.assertRaises(ValueError):
            chunk_text("text", chunk_size=10, overlap=10)


if __name__ == "__main__":
    unittest.main()
