"""Exercise cfFilterPDFToPDF with synthetic PDFs; never submits a print job.

Copyright 2026 Tevinch. SPDX-License-Identifier: Apache-2.0
"""
import argparse
import json
import subprocess
import tempfile
import zlib
from pathlib import Path

from PIL import Image, ImageChops
from pypdf import PdfReader


def stream(data, attributes=b''):
    return b'<< /Length %d ' % len(data) + attributes + b' >>\nstream\n' + data + b'\nendstream'


def document(path, duplicate=True, conflicting=False):
    # Separate resource dictionaries reproduce the deferred resource-read path.
    # The first page paints the same red image three times; page 2 paints it twice.
    refs = [b'/Img 9 0 R', b'/Img 9 0 R']
    if duplicate:
        refs = [refs[0] + b' /Img 9 0 R /Img 9 0 R', refs[1] + b' /Img 9 0 R']
    if conflicting:
        refs = [b'/Img 9 0 R /Img 10 0 R', b'/Img 9 0 R']
    content = [b'q 20 0 0 20 10 170 cm /Img Do Q\nq 20 0 0 20 40 170 cm /Img Do Q\nq 20 0 0 20 70 170 cm /Img Do Q\n',
               b'q 20 0 0 20 10 120 cm /Img Do Q\nq 20 0 0 20 40 120 cm /Img Do Q\n']
    image_attributes = b'/Type /XObject /Subtype /Image /Width 20 /Height 20 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode'
    objects = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources 5 0 R /Contents 4 0 R >>',
        stream(content[0]), b'<< /XObject << ' + refs[0] + b' >> >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources 8 0 R /Contents 7 0 R >>',
        stream(content[1]), b'<< /XObject << ' + refs[1] + b' >> >>',
        stream(zlib.compress(bytes([255, 0, 0]) * 400), image_attributes),
        stream(zlib.compress(bytes([0, 0, 255]) * 400), image_attributes),
    ]
    data = bytearray(b'%PDF-1.4\n%\xb5\xed\xae\xfb\n')
    offsets = []
    for index, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data.extend(b'%d 0 obj\n' % index + obj + b'\nendobj\n')
    xref = len(data)
    data.extend(b'xref\n0 %d\n0000000000 65535 f \n' % (len(objects) + 1))
    for offset in offsets:
        data.extend(b'%010d 00000 n \n' % offset)
    data.extend(b'trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objects) + 1, xref))
    path.write_bytes(data)


def check(driver, renderer, work):
    def run(source, name, options):
        target = work / (name + '.pdf')
        result = subprocess.run([str(driver), str(source), str(target), options], capture_output=True, text=True, timeout=30)
        return target, result

    def render(pdf, name):
        subprocess.run([renderer, '-r', '72', '-png', str(pdf), str(work / name)], capture_output=True, check=True, timeout=30)
        return [Image.open(p).convert('RGB') for p in sorted(work.glob(name + '-*.png'))]

    def equal(actual, expected, case):
        assert len(actual) == len(expected), f'{case}: incorrect rendered page count'
        for a, b in zip(actual, expected):
            assert a.size == b.size and ImageChops.difference(a, b).getbbox() is None, f'{case}: page image changed'

    clean, duplicate, conflict = [work / (name + '.pdf') for name in ('clean', 'duplicate', 'conflict')]
    document(clean, duplicate=False)
    document(duplicate)
    document(conflict, conflicting=True)
    expected = render(clean, 'input')
    assert len(expected) == 2
    for x in (20, 50, 80):
        assert expected[0].getpixel((x, 20)) == (255, 0, 0)
    for x in (20, 50):
        assert expected[1].getpixel((x, 70)) == (255, 0, 0)
    assert expected[1].getpixel((80, 70)) == (255, 255, 255)
    cases = [
        ('copy', 'print-scaling=none', 2),
        ('page-two', 'page-ranges=2 print-scaling=none', 1),
        ('fit', 'media=A4 print-scaling=fit', 2),
        ('two-up', 'number-up=2 media=A4', 1),
    ]
    results = []
    for name, options, pages in cases:
        control, result = run(clean, name + '-control', options)
        assert result.returncode == 0, result.stderr
        target, result = run(duplicate, name, options)
        assert result.returncode == 0, f'{name}: filter exited {result.returncode}'
        assert len(PdfReader(target).pages) == pages, f'{name}: missing PDF pages'
        assert 'filter-log-2 [callback-context]:' in result.stderr and 'duplicate dictionary key' in result.stderr, f'{name}: warning callback was not invoked'
        assert 'filter-log-3' not in result.stderr, f'{name}: warning reported as error'
        actual = render(target, name + '-render')
        reference = render(control, name + '-control-render')
        equal(actual, reference, name)
        assert all(any(r > 220 and g < 35 and b < 35 for r, g, b in im.get_flattened_data()) for im in reference), f'{name}: blank control image'
        if name == 'copy':
            equal(actual, expected, name)
        elif name == 'page-two':
            equal(actual, [expected[1]], name)
        results.append(dict(case=name, pages=pages, pixelEqual=True, warningDelivered=True))
    target, result = run(conflict, 'conflict-output', 'print-scaling=none')
    assert result.returncode == 0 and len(PdfReader(target).pages) == 2
    assert 'filter-log-2 [callback-context]:' in result.stderr
    # Explicit compatibility boundary: PDFio keeps the first (red) image.
    # This is not QPDF's last-value selection (blue).
    equal(render(target, 'conflict-render'), expected, 'first-value recovery')
    target, result = run(duplicate, 'on-error', 'print-scaling=none job-error-sheet={job-error-sheet-when=on-error}')
    assert result.returncode == 0 and len(PdfReader(target).pages) == 2, 'A warning must not add an on-error report page'
    equal(render(target, 'on-error-render'), expected, 'on-error setting')
    target, result = run(duplicate, 'always', 'print-scaling=none job-error-sheet={job-error-sheet-when=always}')
    assert result.returncode == 0 and len(PdfReader(target).pages) == 3, 'Always must retain its requested report page'
    report_text = PdfReader(target).pages[2].extract_text()
    assert 'No Errors' in report_text and 'Warnings:' in report_text and 'duplicate dictionary key' in report_text and 'Input Document 1' in report_text, 'Report page must classify and identify the warning'
    invalid = work / 'invalid.pdf'
    invalid.write_bytes(b'not a PDF\n')
    _, result = run(invalid, 'invalid-output', 'print-scaling=none')
    assert result.returncode != 0 and 'filter-log-3 [callback-context]:' in result.stderr, 'Invalid header must fail and reach the error callback'
    print(json.dumps(dict(cases=results, conflictingValues='PDFio first value retained', errorSheetSettingsPreserved=True, invalidHeaderRejected=True), indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--driver', required=True, type=Path)
    parser.add_argument('--pdftoppm', default='pdftoppm')
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='pdf-warning-check-') as directory:
        check(args.driver.resolve(), args.pdftoppm, Path(directory))


if __name__ == '__main__':
    main()
