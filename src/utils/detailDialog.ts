/**
 * Shared formatting for CodeXR's native information dialogs (server details,
 * remote status, participants, bundled assets).
 *
 * VS Code renders a modal's `detail` as plain text, so readability comes from
 * aligned label columns and blank lines between groups.
 */

export type DetailRow = [label: string, value: string | undefined];

/**
 * Render label/value rows aligned in a column, one blank line between sections.
 * Rows without a value are dropped, as are sections left empty.
 */
export function formatDetailSections(sections: DetailRow[][]): string {
    const populated = sections
        .map((section) => section.filter((row): row is [string, string] => !!row[1]))
        .filter((section) => section.length > 0);

    const width = Math.max(
        0,
        ...populated.flatMap((section) => section.map(([label]) => label.length)),
    );

    return populated
        .map((section) => section
            .map(([label, value]) => `${label.padEnd(width)}   ${value}`)
            .join('\n'))
        .join('\n\n');
}

/** Format a duration as a compact human string (`2h 5m`, `40s`). */
export function formatDuration(milliseconds: number): string {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}
