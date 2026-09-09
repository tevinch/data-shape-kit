using System;

namespace DataShapeKit;

/// <summary>Row boundaries for external text whose final CRLF is a terminator.</summary>
public static class ClipboardRows
{
    /// <summary>
    /// Consumes one final CRLF, then splits rows while retaining empty entries.
    /// Bare CR or LF endings remain data. This method does not parse TSV quoting.
    /// Supply the original external payload to each consumer; do not trim first.
    /// </summary>
    public static string[] SplitExternalText(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        var content = text.EndsWith("\r\n", StringComparison.Ordinal)
            ? text[..^2]
            : text;
        return content.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
    }
}
