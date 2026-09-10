"""Rebuild the invented two-page sample with Python and reportlab."""

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen.canvas import Canvas


def paragraph(canvas, top, label):
    canvas.setFillColor(HexColor("#58666f"))
    canvas.setFont("Helvetica", 9)
    canvas.drawString(48, top + 24, label)
    canvas.setFillColor(HexColor("#182c37"))
    x = 48
    for text, font in [
        ("A shared ", "Helvetica"),
        ("sentence", "Helvetica-Bold"),
        (" can cross", "Helvetica"),
    ]:
        canvas.setFont(font, 12)
        canvas.drawString(x, top, text)
        x += stringWidth(text, font, 12)
    canvas.setFont("Helvetica", 12)
    canvas.drawString(48, top - 20, "several small fragments")
    canvas.drawString(48, top - 40, "without losing a match.")


def build(destination):
    canvas = Canvas(str(destination), pagesize=(612, 792), invariant=1)
    canvas.setTitle("Text fragment highlight sample")
    canvas.setAuthor("Tevinch")
    canvas.setCreator("Text fragment sample")
    canvas.setSubject("Invented text for checking phrase highlights")
    for page in (1, 2):
        canvas.setFillColor(HexColor("#e9f1ed"))
        canvas.rect(0, 696, 612, 96, fill=1, stroke=0)
        canvas.setFillColor(HexColor("#173b30"))
        canvas.setFont("Helvetica-Bold", 23)
        canvas.drawString(48, 741, "Text fragments")
        canvas.setFont("Helvetica", 10)
        canvas.drawString(48, 719, "Invented text. Multiple font runs and explicit line endings.")
        paragraph(canvas, 642, "Paragraph 1")
        if page == 1:
            paragraph(canvas, 490, "Paragraph 2 - repeated wording")
        canvas.setFillColor(HexColor("#58666f"))
        canvas.setFont("Helvetica", 9)
        canvas.drawString(48, 354, "Literal punctuation sample")
        canvas.setFillColor(HexColor("#182c37"))
        canvas.setFont("Helvetica", 12)
        canvas.drawString(48, 330, "Invoice A+B (draft) & <review>")
        canvas.setStrokeColor(HexColor("#d4ddd8"))
        canvas.line(48, 64, 564, 64)
        canvas.setFillColor(HexColor("#58666f"))
        canvas.setFont("Helvetica", 9)
        canvas.drawString(48, 44, "Free sample data for the text fragment example")
        canvas.drawRightString(564, 44, f"Page {page} of 2")
        canvas.showPage()
    canvas.save()


if __name__ == "__main__":
    build(Path(__file__).with_name("sample.pdf"))
