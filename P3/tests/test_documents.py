from io import BytesIO
import unittest

from pypdf import PdfWriter

from rag.documents import DocumentError, parse_pdf, safe_source_name


class SafeSourceNameTests(unittest.TestCase):
    def test_removes_path_components_on_windows_and_posix(self) -> None:
        self.assertEqual(safe_source_name(r"C:\private\handbook.pdf"), "handbook.pdf")
        self.assertEqual(safe_source_name("../../handbook.pdf"), "handbook.pdf")

    def test_rejects_empty_filename(self) -> None:
        with self.assertRaises(DocumentError):
            safe_source_name(" ..\\ ")

    def test_empty_pdf_pages_are_accepted_without_chunks(self) -> None:
        buffer = BytesIO()
        writer = PdfWriter()
        writer.add_blank_page(width=612, height=792)
        writer.write(buffer)

        document = parse_pdf("blank.pdf", buffer.getvalue())

        self.assertEqual(document.total_pages, 1)
        self.assertEqual(document.pages_with_text, 0)
        self.assertEqual(document.chunks, [])

    def test_rejects_content_that_is_not_a_pdf(self) -> None:
        with self.assertRaises(DocumentError):
            parse_pdf("handbook.pdf", b"not a pdf")


if __name__ == "__main__":
    unittest.main()
