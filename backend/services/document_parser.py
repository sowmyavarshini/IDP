"""
Document parsing service: extracts raw text from PDF, DOCX, images, and plain text.
"""
import io
import re
from pathlib import Path


def extract_text(file_bytes: bytes, filename: str) -> tuple[str, str]:
    """
    Returns (text, file_type).
    Supports: .pdf, .docx, .doc, .txt, .png, .jpg, .jpeg, .tiff, .bmp
    """
    suffix = Path(filename).suffix.lower()

    if suffix == ".pdf":
        return _extract_pdf(file_bytes), "pdf"
    elif suffix in (".docx", ".doc"):
        return _extract_docx(file_bytes), "docx"
    elif suffix in (".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".gif"):
        return _extract_image(file_bytes), "image"
    elif suffix in (".txt", ".text", ".csv"):
        return file_bytes.decode("utf-8", errors="replace"), "text"
    else:
        # Attempt UTF-8 decode for unknown types
        try:
            return file_bytes.decode("utf-8", errors="replace"), "text"
        except Exception:
            return "", "unknown"


def _extract_pdf(data: bytes) -> str:
    """
    1. Try extracting native text.
    2. If text is insufficient, treat as scanned PDF.
    3. Convert pages to images and run EasyOCR.
    """
    import traceback

    # ----------------------------------
    # Attempt 1: Native PDF text
    # ----------------------------------
    try:
        import pypdf

        reader = pypdf.PdfReader(io.BytesIO(data))

        parts = []

        for page in reader.pages:
            txt = page.extract_text()
            if txt:
                parts.append(txt)

        text = "\n".join(parts).strip()

        # Digital PDF
        if len(text) > 100:
            return text

    except Exception:
        pass

    # ----------------------------------
    # Attempt 2: OCR scanned PDF
    # ----------------------------------
    try:
        import fitz
        import easyocr
        import tempfile
        from PIL import Image

        reader = easyocr.Reader(["en"], gpu=False)

        doc = fitz.open(stream=data, filetype="pdf")

        all_text = []

        with tempfile.TemporaryDirectory() as tmpdir:

            for page_num in range(len(doc)):
                page = doc[page_num]

                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))

                img_path = Path(tmpdir) / f"page_{page_num}.png"

                pix.save(str(img_path))

                results = reader.readtext(
                    str(img_path),
                    detail=0
                )

                page_text = "\n".join(results)

                all_text.append(page_text)

        extracted = "\n".join(all_text).strip()

        if extracted:
            return extracted

    except Exception as e:
        return f"""
PDF OCR extraction failed

Error:
{str(e)}

Traceback:
{traceback.format_exc()}
"""

    return "[Could not extract text from PDF]"


def _extract_docx(data: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(data))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        # Also extract tables
        for table in doc.tables:
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_text:
                    paragraphs.append(row_text)
        return "\n".join(paragraphs)
    except Exception as e:
        return f"[Could not extract text from DOCX: {e}]"


def _extract_image(data: bytes) -> str:
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(data))
    except Exception as e:
        return f"[Could not open image: {e}]"

    try:
        import easyocr
        import tempfile

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir) / "ocr.png"
            img.save(tmp_path)
            reader = easyocr.Reader(["en"], gpu=False)
            texts = reader.readtext(str(tmp_path), detail=0)

        cleaned = "\n".join(t.strip() for t in (texts or []) if t and str(t).strip())
        if cleaned:
            return cleaned
        return "[Could not extract text from image: no text detected]"
    except Exception as e:
        return f"[EasyOCR image extraction failed: {e}]"


def clean_text(text: str) -> str:
    """Normalize whitespace and remove control characters."""
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    text = re.sub(r" +", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def truncate_for_llm(text: str, max_chars: int = 8000) -> str:
    """Keep only the first max_chars for LLM context."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n... [truncated]"
