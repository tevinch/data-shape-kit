# Copyright (c) 2026 Tevinch. SPDX-License-Identifier: MIT
import importlib.util
from pathlib import Path
import tempfile
import unittest

from identifier_import import Identifier, ImportReport, RowNotice, read_csv_identifiers
from qr_example import make_qr_previews


@unittest.skipUnless(importlib.util.find_spec('qrcode'), 'Optional generation checks need qrcode')
class GenerationTests(unittest.TestCase):
    def test_imported_identifiers_reach_real_qr_encoder_unchanged(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'sample.csv'
            path.write_text('ID\n00123\n00007\nNA\nNULL\n 001 \n零件-００１\n', encoding='utf-8')
            report = read_csv_identifiers(path, 'ID')
            codes = make_qr_previews(report)
        expected = ['00123', '00007', 'NA', 'NULL', ' 001 ', '零件-００１']
        self.assertEqual(len(codes), len(expected))
        for code, value in zip(codes, expected):
            self.assertEqual(b''.join(chunk.data for chunk in code.data_list), value.encode('utf-8'))
            matrix = code.get_matrix()
            self.assertGreater(len(matrix), 20)
            self.assertTrue(all(len(row) == len(matrix) for row in matrix))

    def test_rejected_input_prevents_generation_of_a_partial_batch(self):
        report = ImportReport((Identifier(2, '001'),), (), (RowNotice(3, 'numeric'),))
        with self.assertRaisesRegex(ValueError, 'Review rejected'):
            make_qr_previews(report)

    def test_empty_result_generates_no_codes(self):
        self.assertEqual(make_qr_previews(ImportReport((), (RowNotice(2, 'empty'),), ())), [])

    def test_small_example_limits_are_explicit(self):
        for entries in [tuple(Identifier(i+2, '001') for i in range(101)), (Identifier(2, '零' * 342),)]:
            with self.subTest(count=len(entries)):
                with self.assertRaises(ValueError):
                    make_qr_previews(ImportReport(entries, (), ()))


if __name__ == '__main__':
    unittest.main()
