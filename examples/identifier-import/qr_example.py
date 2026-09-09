# Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
"""Small in-memory QR example; no printing, GUI or output files."""
from pathlib import Path
import tempfile

from identifier_import import ImportReport, read_csv_identifiers


def make_qr_previews(report: ImportReport):
    """Generate at most 100 small QR matrices after the caller reads the report."""
    if not isinstance(report, ImportReport):
        raise TypeError('Expected an import report')
    if report.rejected:
        raise ValueError('Review rejected rows before generating codes')
    if len(report.accepted) > 100:
        raise ValueError('This in-memory example supports at most 100 identifiers')
    if any(len(item.value.encode('utf-8')) > 1024 for item in report.accepted):
        raise ValueError('This example supports at most 1024 UTF-8 bytes per identifier')
    import qrcode

    previews = []
    for item in report.accepted:
        code = qrcode.QRCode()
        code.add_data(item.value, optimize=0)
        code.make(fit=True)
        previews.append(code)
    return previews


def main():
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / 'sample.csv'
        path.write_text('ID\n00123\n00007\nNA\nNULL\n', encoding='utf-8')
        report = read_csv_identifiers(path, 'ID')
        print(f'Accepted: {len(report.accepted)}; skipped: {len(report.skipped)}; rejected: {len(report.rejected)}')
        previews = make_qr_previews(report)
        for item, code in zip(report.accepted, previews):
            assert b''.join(chunk.data for chunk in code.data_list) == item.value.encode('utf-8')
        print(f'Generated {len(previews)} QR matrices in memory; original identifier bytes reached the encoder.')


if __name__ == '__main__':
    main()
