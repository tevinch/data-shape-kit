import csv
import io
import unittest
from types import MappingProxyType

from missing_tokens import NormalizedCSV, normalize_missing_csv


def parse_csv(text: str, delimiter: str = ",") -> list[list[str]]:
    return list(csv.reader(io.StringIO(text, newline=""), delimiter=delimiter))


class NormalizeMissingCSVTests(unittest.TestCase):
    def test_replaces_declared_tokens_only_in_the_selected_column(self) -> None:
        source = (
            'profile_code,ph,note\n'
            '00060,NA,NA\n'
            'NA,6.5,"NA, literal"\n'
            '123456789012345678901234567890,NaN,NA\n'
            'keep,-9999,keep\n'
        )

        result = normalize_missing_csv(source, {"ph": ["NA", "NaN", "-9999"]})

        self.assertIsInstance(result, NormalizedCSV)
        self.assertEqual(
            parse_csv(result.text),
            [
                ["profile_code", "ph", "note"],
                ["00060", "", "NA"],
                ["NA", "6.5", "NA, literal"],
                ["123456789012345678901234567890", "", "NA"],
                ["keep", "", "keep"],
            ],
        )
        self.assertEqual(result.replacements, {"ph": 3})
        self.assertEqual(result.row_count, 4)

    def test_matching_is_exact_case_sensitive_and_whitespace_sensitive(self) -> None:
        source = "value\nNA\nna\n NA\nNA \nNAX\nXNA\n"

        result = normalize_missing_csv(source, {"value": ["NA"]})

        self.assertEqual(
            parse_csv(result.text),
            [["value"], [""], ["na"], [" NA"], ["NA "], ["NAX"], ["XNA"]],
        )
        self.assertEqual(result.replacements, {"value": 1})

    def test_preserves_quoted_embedded_crlf_quotes_unicode_and_other_fields(self) -> None:
        source = (
            'id,note,value\n'
            '0007,"line 1\r\nline 2",NA\n'
            '2,"said ""hello"" — café",ok\n'
        )

        result = normalize_missing_csv(source, {"value": ("NA",)})

        self.assertEqual(
            result.text,
            'id,note,value\r\n'
            '0007,"line 1\r\nline 2",\r\n'
            '2,"said ""hello"" — café",ok\r\n',
        )
        self.assertEqual(result.replacements, {"value": 1})
        self.assertEqual(result.row_count, 2)

    def test_replaces_quoted_and_unquoted_tokens_with_multiple_container_types(self) -> None:
        source = 'a,b,c,d\nNA,"NA",missing,x\nkeep,ok,,x\n'
        policy = {
            "a": ["NA"],
            "b": {"NA"},
            "c": frozenset({"missing"}),
            "d": (),
        }

        result = normalize_missing_csv(source, policy)

        self.assertEqual(
            parse_csv(result.text),
            [["a", "b", "c", "d"], ["", "", "", "x"], ["keep", "ok", "", "x"]],
        )
        self.assertEqual(result.replacements, {"a": 1, "b": 1, "c": 1, "d": 0})

    def test_empty_token_never_counts_an_already_empty_field(self) -> None:
        result = normalize_missing_csv("a,b\n,\n", {"a": [""], "b": [""]})

        self.assertEqual(result.text, "a,b\r\n,\r\n")
        self.assertEqual(result.replacements, {"a": 0, "b": 0})
        self.assertEqual(result.row_count, 1)

    def test_custom_semicolon_delimiter(self) -> None:
        result = normalize_missing_csv(
            'id;value;note\n0003;NA;"alpha; beta"\n',
            {"value": ["NA"]},
            delimiter=";",
        )

        self.assertEqual(result.text, 'id;value;note\r\n0003;;"alpha; beta"\r\n')

    def test_custom_tab_delimiter(self) -> None:
        result = normalize_missing_csv(
            "id\tvalue\tnote\n0004\tNA\tunchanged\n",
            {"value": ["NA"]},
            delimiter="\t",
        )

        self.assertEqual(result.text, "id\tvalue\tnote\r\n0004\t\tunchanged\r\n")

    def test_strips_exactly_one_initial_bom(self) -> None:
        result = normalize_missing_csv("\ufeffid,value\n1,NA\n", {"value": ["NA"]})
        double_bom = normalize_missing_csv("\ufeff\ufeffid,value\n1,ok\n", {})

        self.assertEqual(result.text, "id,value\r\n1,\r\n")
        self.assertEqual(double_bom.text, "\ufeffid,value\r\n1,ok\r\n")

    def test_header_only_input_is_valid(self) -> None:
        result = normalize_missing_csv("id,value", {"value": ["NA"]})

        self.assertEqual(result.text, "id,value\r\n")
        self.assertEqual(result.replacements, {"value": 0})
        self.assertEqual(result.row_count, 0)

    def test_empty_policy_canonicalizes_csv_without_changing_cells(self) -> None:
        source = 'id,note\n0005,"NA, literal"\n'

        result = normalize_missing_csv(source, MappingProxyType({}))

        self.assertEqual(result.text, 'id,note\r\n0005,"NA, literal"\r\n')
        self.assertEqual(result.replacements, {})
        self.assertEqual(result.row_count, 1)

    def test_does_not_mutate_policy_and_repeated_calls_are_independent(self) -> None:
        token_list = ["NA", "NaN"]
        token_set = {"-9999"}
        policy = {"a": token_list, "b": token_set}
        source = "a,b\nNA,-9999\n"

        first = normalize_missing_csv(source, policy)
        second = normalize_missing_csv(source, policy)

        self.assertEqual(token_list, ["NA", "NaN"])
        self.assertEqual(token_set, {"-9999"})
        self.assertEqual(policy, {"a": ["NA", "NaN"], "b": {"-9999"}})
        self.assertEqual(first, second)
        self.assertEqual(first.replacements, {"a": 1, "b": 1})

    def test_rejects_short_long_and_standalone_blank_records(self) -> None:
        invalid_sources = (
            "a,b\nonly-one\n",
            "a,b\n1,2,3\n",
            "a,b\n\n",
            "a,b\n1,NA\nshort\n",
        )

        for source in invalid_sources:
            with self.subTest(source=source):
                with self.assertRaises(ValueError):
                    normalize_missing_csv(source, {"b": ["NA"]})

    def test_preserves_a_correctly_sized_all_empty_record(self) -> None:
        result = normalize_missing_csv("a,b,c\n,,\n", {"b": [""]})

        self.assertEqual(result.text, "a,b,c\r\n,,\r\n")
        self.assertEqual(result.row_count, 1)
        self.assertEqual(result.replacements, {"b": 0})

    def test_rejects_missing_empty_and_duplicate_headers(self) -> None:
        invalid_sources = ("", "\n", ",b\n", "a,\n", "a,a\n")

        for source in invalid_sources:
            with self.subTest(source=source):
                with self.assertRaises(ValueError):
                    normalize_missing_csv(source, {})

    def test_header_matching_preserves_case_and_whitespace(self) -> None:
        source = " Name,name, \nNA,NA,NA\n"

        result = normalize_missing_csv(source, {" Name": ["NA"], " ": ["NA"]})

        self.assertEqual(
            parse_csv(result.text),
            [[" Name", "name", " "], ["", "NA", ""]],
        )
        self.assertEqual(result.replacements, {" Name": 1, " ": 1})

    def test_rejects_unknown_configured_columns(self) -> None:
        with self.assertRaises(ValueError):
            normalize_missing_csv("a,b\n1,2\n", {"missing": ["NA"]})

    def test_propagates_csv_error_for_malformed_quoted_input(self) -> None:
        with self.assertRaises(csv.Error):
            normalize_missing_csv('a,b\n"unterminated,value\n', {})

    def test_rejects_non_string_text(self) -> None:
        for value in (None, b"a,b\n", 7, ["a,b"]):
            with self.subTest(value=value):
                with self.assertRaises(TypeError):
                    normalize_missing_csv(value, {})  # type: ignore[arg-type]

    def test_validates_delimiter_type_and_value(self) -> None:
        for value in (None, b",", 1):
            with self.subTest(value=value):
                with self.assertRaises(TypeError):
                    normalize_missing_csv("a\n", {}, delimiter=value)  # type: ignore[arg-type]

        for value in ("", "::", '"', "\r", "\n", "\0"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    normalize_missing_csv("a\n", {}, delimiter=value)

    def test_rejects_non_mapping_policies(self) -> None:
        for value in (None, [], (("a", ["NA"]),), "policy", 7):
            with self.subTest(value=value):
                with self.assertRaises(TypeError):
                    normalize_missing_csv("a\n", value)  # type: ignore[arg-type]

    def test_validates_policy_keys(self) -> None:
        with self.assertRaises(TypeError):
            normalize_missing_csv("a\n", {1: ["NA"]})  # type: ignore[dict-item]
        with self.assertRaises(ValueError):
            normalize_missing_csv("a\n", {"": ["NA"]})

    def test_rejects_unsupported_token_containers(self) -> None:
        invalid_values = (
            "NA",
            b"NA",
            (token for token in ["NA"]),
            {"NA": True},
            7,
            None,
        )

        for value in invalid_values:
            with self.subTest(value=type(value).__name__):
                with self.assertRaises(TypeError):
                    normalize_missing_csv("a\n", {"a": value})  # type: ignore[dict-item]

    def test_rejects_non_string_token_members(self) -> None:
        for value in (["NA", 1], (None,), {b"NA"}, frozenset({3.5})):
            with self.subTest(value=value):
                with self.assertRaises(TypeError):
                    normalize_missing_csv("a\n", {"a": value})  # type: ignore[dict-item]


if __name__ == "__main__":
    unittest.main()
