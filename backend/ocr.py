from pathlib import Path
import sys
import easyocr

reader = easyocr.Reader(["en"], gpu=False)

def recognize_image_path(path: str):
	p = Path(path)
	if not p.exists():
		raise FileNotFoundError(f"Image file not found: {p}")
	return reader.readtext(str(p), detail=0)

def extract_text_from_result(result):
	return "\n".join(t.strip() for t in (result or []) if t and str(t).strip())


if __name__ == "__main__":
	if len(sys.argv) != 2:
		print("Usage: python ocr.py <image_path>")
		sys.exit(1)
	image_path = sys.argv[1]
	res = recognize_image_path(image_path)
	print(extract_text_from_result(res))