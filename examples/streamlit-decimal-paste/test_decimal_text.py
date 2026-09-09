"""Run with: python -m unittest discover -s . -p 'test_*.py' -v"""

from decimal import Decimal, getcontext
import unittest

from decimal_text import parse_decimal_text


class DecimalTextTests(unittest.TestCase):
    def test_decimal_comma_is_not_silently_removed(self):
        self.assertEqual(parse_decimal_text('23,4', decimal_mark=','), Decimal('23.4'))

    def test_declared_grouping_preserves_exact_fractional_scale(self):
        fixtures = [
            ('1.234,50', ',', '.', '1234.50'),
            ('1,234.50', '.', ',', '1234.50'),
            ('12 345,67', ',', ' ', '12345.67'),
            ('1\u00a0234,50', ',', '\u00a0', '1234.50'),
            ('1\u202f234,50', ',', '\u202f', '1234.50'),
            ('1234567,00', ',', '.', '1234567.00'),
        ]
        for raw, decimal_mark, group_mark, expected in fixtures:
            with self.subTest(raw=raw):
                result = parse_decimal_text(raw, decimal_mark=decimal_mark, group_mark=group_mark)
                self.assertEqual(result.as_tuple(), Decimal(expected).as_tuple())

    def test_signs_edge_spaces_and_zero_scale(self):
        for raw, expected in [(' +0012,00 ', '12.00'), ('-0,00', '-0.00'),
                              ('\u00a0-23,40\u202f', '-23.40'), ('123', '123')]:
            with self.subTest(raw=raw):
                value = parse_decimal_text(raw, decimal_mark=',')
                self.assertEqual(value.as_tuple(), Decimal(expected).as_tuple())

    def test_ambiguous_text_follows_the_explicit_format(self):
        self.assertEqual(parse_decimal_text('1,234', decimal_mark=','), Decimal('1.234'))
        self.assertEqual(parse_decimal_text('1,234', decimal_mark='.', group_mark=','), Decimal('1234'))

    def test_grouping_is_rejected_unless_configured(self):
        for raw in ['1.234,5', '1 234,5', '1\u00a0234,5', '1\u202f234,5']:
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):
                    parse_decimal_text(raw, decimal_mark=',')

    def test_malformed_groups_are_not_silently_deleted(self):
        for raw in ['12.34,5', '1234.567,8', '.123,4', '1..234,5', '1.234.,5',
                    '1.234,5.6', '1.234,56,7', '1.234 567,8']:
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):
                    parse_decimal_text(raw, decimal_mark=',', group_mark='.')

    def test_only_the_documented_plain_decimal_grammar_is_accepted(self):
        invalid = ['', ' ', '+', '-', ',5', '1,', 'NaN', 'Infinity', '1e3',
                   '1_234', '25%', '$12', '(12)', '１２,３', '١٢,٣',
                   '\t23,4', '23,4\n', '2\n3,4', '++12', '--12', '"23,4"']
        for raw in invalid:
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):
                    parse_decimal_text(raw, decimal_mark=',')

    def test_non_string_inputs_are_not_coerced(self):
        for raw in [None, True, 23.4, 12, Decimal('23.4'), ['23,4']]:
            with self.subTest(raw=raw):
                with self.assertRaises(TypeError):
                    parse_decimal_text(raw, decimal_mark=',')

    def test_invalid_or_identical_marks_are_rejected(self):
        for decimal_mark, group_mark in [('', None), (';', None), (None, None),
                                        ([], None), (',', ','), ('.', '.'),
                                        (',', '\t'), (',', '_'), (',', []), (',', 'xx')]:
            with self.subTest(decimal_mark=decimal_mark, group_mark=group_mark):
                with self.assertRaises(ValueError):
                    parse_decimal_text('123', decimal_mark=decimal_mark, group_mark=group_mark)

    def test_long_values_do_not_go_through_binary_float_or_context_rounding(self):
        original_precision = getcontext().prec
        raw = '123456789012345678901234567890,12345678901234567890'
        value = parse_decimal_text(raw, decimal_mark=',')
        self.assertEqual(str(value), '123456789012345678901234567890.12345678901234567890')
        self.assertEqual(getcontext().prec, original_precision)

    def test_character_bound_is_checked_before_whitespace_removal(self):
        self.assertEqual(parse_decimal_text('9' * 256, decimal_mark='.'), Decimal('9' * 256))
        for raw in ['9' * 257, ' ' * 256 + '1']:
            with self.subTest(length=len(raw)):
                with self.assertRaises(ValueError):
                    parse_decimal_text(raw, decimal_mark='.')

    def test_error_message_does_not_echo_source_values(self):
        raw = 'private-example-23,4'
        with self.assertRaises(ValueError) as caught:
            parse_decimal_text(raw, decimal_mark=',')
        self.assertNotIn(raw, str(caught.exception))


if __name__ == '__main__':
    unittest.main()
