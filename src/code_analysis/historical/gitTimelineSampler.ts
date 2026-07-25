import { ComparisonSource } from './historicalComparisonModels';

/**
 * Shared Git timeline sampling.
 *
 * Both Git-backed analyses read the same reference vocabulary
 * (`GitRepositoryService`); this module is the other half of that shared base:
 * given a chronological timeline, it chooses which revisions are worth showing.
 * Project evolution uses it to pick the frames of its movie; any future Git
 * analysis that needs "a representative handful of revisions" should reuse it
 * instead of rolling its own.
 *
 * The selection answers one question: *what does this project's evolution look
 * like?* That means:
 *
 * 1. **Anchors.** The first revision and the current state of the branch are
 *    always included, so a movie starts at the beginning and always ends where
 *    the user is standing right now.
 * 2. **Even spacing in TIME, not in commit count.** Picking every Nth commit
 *    over-represents busy weeks and compresses quiet months, so the playback
 *    speed has nothing to do with how the project actually grew. Intermediate
 *    frames are placed at equally spaced instants between the first and last
 *    dates, and each one takes the best candidate near it.
 * 3. **Milestones win ties.** Within a slot's window, a merge or a tag is
 *    preferred over a plain commit: those are the points where work actually
 *    landed. Otherwise the closest revision in time wins.
 * 4. **No repeats, no waste.** Duplicates are dropped, and if that leaves room,
 *    the leftover slots go to the revisions that split the widest remaining time
 *    gaps — which is what maximises coverage.
 *
 * Undated timelines (or ones where every date is identical) degrade to even
 * spacing by position, the previous behaviour, so nothing breaks on repositories
 * git could not date.
 */

/** Date of a revision as a sortable number, or null when it has none. */
function revisionTime(source: ComparisonSource | undefined): number | null {
    if (!source || source.kind !== 'gitRef') {
        return null;
    }
    // Prefer the precise committer time (epoch seconds); the short date is
    // day-granular and ties every same-day revision.
    if (Number.isFinite(source.timestamp)) {
        return (source.timestamp as number) * 1000;
    }
    if (!source.date) {
        return null;
    }
    const parsed = Date.parse(source.date);
    return Number.isFinite(parsed) ? parsed : null;
}

function isMilestone(source: ComparisonSource | undefined): boolean {
    if (!source || source.kind !== 'gitRef') {
        return false;
    }
    return source.revisionType === 'merge' || source.refType === 'tag';
}

/** Even spacing by position — the fallback for timelines we cannot date. */
function sampleByPosition(sources: ComparisonSource[], maxFrames: number): ComparisonSource[] {
    const selected: ComparisonSource[] = [];
    const seen = new Set<string>();
    const last = sources.length - 1;
    const slots = Math.max(2, maxFrames);
    for (let index = 0; index < slots; index += 1) {
        const source = sources[Math.round((index / (slots - 1)) * last)];
        if (source && !seen.has(source.id)) {
            seen.add(source.id);
            selected.push(source);
        }
    }
    return selected;
}

/**
 * Fill remaining slots with the revisions that split the widest time gaps
 * between already-selected frames, so extra frames land where the movie would
 * otherwise jump the furthest.
 */
function fillWidestGaps(
    ordered: ComparisonSource[],
    selectedIds: Set<string>,
    limit: number,
): void {
    while (selectedIds.size < limit) {
        let bestIndex = -1;
        let bestGap = -1;
        for (let index = 0; index < ordered.length; index += 1) {
            const candidate = ordered[index];
            if (selectedIds.has(candidate.id)) {
                continue;
            }
            // Distance to the nearest already-selected neighbour, in time when
            // available and in positions otherwise.
            let previousSelected = index - 1;
            while (previousSelected >= 0 && !selectedIds.has(ordered[previousSelected].id)) {
                previousSelected -= 1;
            }
            let nextSelected = index + 1;
            while (nextSelected < ordered.length && !selectedIds.has(ordered[nextSelected].id)) {
                nextSelected += 1;
            }
            const previousTime = revisionTime(ordered[previousSelected]);
            const nextTime = revisionTime(ordered[nextSelected]);
            const gap = previousTime !== null && nextTime !== null
                ? nextTime - previousTime
                : nextSelected - previousSelected;
            if (gap > bestGap) {
                bestGap = gap;
                bestIndex = index;
            }
        }
        if (bestIndex < 0) {
            return;
        }
        selectedIds.add(ordered[bestIndex].id);
    }
}

/**
 * Pick up to `maxFrames` revisions from a chronologically ascending timeline.
 *
 * `endAnchor` is the revision the selection must finish on — the current state
 * of the branch (working copy when the tree is dirty, HEAD otherwise). It is
 * appended when it is not already part of the timeline.
 */
export function sampleTimeline(
    timeline: ComparisonSource[],
    maxFrames: number,
    endAnchor?: ComparisonSource | null,
): ComparisonSource[] {
    const ordered = timeline.slice();
    if (endAnchor && !ordered.some((source) => source.id === endAnchor.id)) {
        ordered.push(endAnchor);
    }
    const limit = Math.max(1, Math.floor(maxFrames));
    if (ordered.length <= limit) {
        return ordered;
    }

    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const firstTime = revisionTime(first);
    // The end anchor (working copy) carries no commit date: fall back to the
    // last dated revision so the time span is still meaningful.
    let lastTime = revisionTime(last);
    if (lastTime === null) {
        for (let index = ordered.length - 1; index >= 0 && lastTime === null; index -= 1) {
            lastTime = revisionTime(ordered[index]);
        }
    }

    if (firstTime === null || lastTime === null || lastTime <= firstTime) {
        const positional = sampleByPosition(ordered, limit);
        // Even in the fallback the movie must end on the current state.
        if (positional.length && positional[positional.length - 1].id !== last.id) {
            positional[positional.length - 1] = last;
        }
        return positional;
    }

    const selectedIds = new Set<string>([first.id, last.id]);
    const span = lastTime - firstTime;
    const innerSlots = limit - 2;

    for (let slot = 1; slot <= innerSlots; slot += 1) {
        const target = firstTime + ((span * slot) / (innerSlots + 1));
        const halfWindow = span / ((innerSlots + 1) * 2);
        let best: ComparisonSource | null = null;
        let bestScore = Number.POSITIVE_INFINITY;
        for (const candidate of ordered) {
            if (selectedIds.has(candidate.id)) {
                continue;
            }
            const time = revisionTime(candidate);
            if (time === null) {
                continue;
            }
            const distance = Math.abs(time - target);
            // Milestones inside the slot's window beat closer plain commits;
            // outside it, plain distance decides.
            const score = isMilestone(candidate) && distance <= halfWindow
                ? distance - halfWindow
                : distance;
            if (score < bestScore) {
                bestScore = score;
                best = candidate;
            }
        }
        if (best) {
            selectedIds.add(best.id);
        }
    }

    fillWidestGaps(ordered, selectedIds, limit);

    // Emit in timeline order, which keeps the anchors at both ends.
    return ordered.filter((source) => selectedIds.has(source.id));
}
