using System.Text.Json;
using DataShapeKit;

// Each expected array is the set of rows that an external-text consumer may write.
// A blanket TrimEnd would lose intentional blank rows and trailing empty cells.
var cases = new (string Name, string Input, string[] Expected)[]
{
    ("two Excel rows", "1\r\n2\r\n", new[] { "1", "2" }),
    ("no final terminator", "1\r\n2", new[] { "1", "2" }),
    ("one intentional final blank row", "1\r\n\r\n", new[] { "1", "" }),
    ("two intentional final blank rows", "1\r\n\r\n\r\n", new[] { "1", "", "" }),
    ("LF-only final blank row", "1\n", new[] { "1", "" }),
    ("CR-only final blank row", "1\r", new[] { "1", "" }),
    ("leading blank row", "\r\n1\r\n", new[] { "", "1" }),
    ("one empty external cell", "\r\n", new[] { "" }),
    ("two empty external rows", "\r\n\r\n", new[] { "", "" }),
    ("empty string retains split semantics", "", new[] { "" }),
    ("trailing empty columns", "001\t\t\r\n", new[] { "001\t\t" }),
    ("whitespace values", " 1 \t \r\n", new[] { " 1 \t " }),
    ("mixed preceding row separators", "1\n2\r\n", new[] { "1", "2" }),
    ("empty row in the middle", "1\r\n\r\n2\r\n", new[] { "1", "", "2" }),
};

Func<string, string[]> split = ClipboardRows.SplitExternalText;
var failed = 0;
foreach (var test in cases)
{
    var actual = split(test.Input);
    if (!actual.SequenceEqual(test.Expected))
    {
        failed++;
        Console.Error.WriteLine($"FAIL {test.Name}: expected {JsonSerializer.Serialize(test.Expected)}, got {JsonSerializer.Serialize(actual)}");
    }
}

try
{
    split(null!);
    failed++;
    Console.Error.WriteLine("FAIL null input: expected ArgumentNullException");
}
catch (ArgumentNullException) { }
catch (Exception error)
{
    failed++;
    Console.Error.WriteLine($"FAIL null input: got {error.GetType().Name}");
}

Console.WriteLine($"{cases.Length + 1 - failed}/{cases.Length + 1} row-boundary cases passed.");
return failed == 0 ? 0 : 1;
