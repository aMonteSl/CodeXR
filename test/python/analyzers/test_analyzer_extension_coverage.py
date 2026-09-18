"""Extension coverage of the class counter and the comment analyzer.

The per-language fixtures (``manual_test/``, ``npm run test:analysis``) exercise
every LANGUAGE once, through its primary extension. The two regex analyzers do
not dispatch on language, though: each is a hand-maintained chain over the file
EXTENSION, kept separately from ``utils/metric_language_contract.py``. When the
contract admits an extension that an analyzer has no arm for, nothing fails -
the file is analyzed and the metric silently reads zero.

This module feeds ONE snippet per contract language (a class-like declaration
plus a comment) to both analyzers under EVERY extension the contract lists for
that language, and pins the resulting partition: which extensions are counted
and which fall through. Because siblings share the same bytes, a zero next to a
counted sibling can only be a dispatch gap.

THE FALL-THROUGH SETS BELOW ARE KNOWN GAPS, PINNED, NOT ENDORSED. Closing one
changes user-visible metrics (classCount, commentLines and every ratio derived
from them) for files users already track, so it belongs to 1.3.0 and needs a
CHANGELOG entry. What 1.2.1 must guarantee is only that the table-driven
rewrite of ``analyze_classes`` and the comment-analyzer cleanup move nothing
across the partition by accident - in either direction.

WHAT THIS MODULE DOES NOT PROVE: that an extension still reaches the SAME arm.
Two counting arms look alike here unless one of them cannot see the other's
declaration, so a green run is not evidence that a rewrite kept every alias on
its own pattern list. That takes a golden of the full result per extension,
which has to land right before the table-driven rewrite. The one routing pinned
here is '.h', the only extension whose language the contract and the class
counter disagree about.

Deliberately NOT pinned: per-language counts (several arms double count, which
is a separate known issue), the ``warning`` key of the unsupported arm, and the
stderr debug lines.
"""

import contextlib
import importlib.util
import io
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
PYTHON_ROOT = PROJECT_ROOT / 'src' / 'code_analysis' / 'python'


def _load_private(name, module_path):
    # Loaded by path and never registered in sys.modules: the three modules are
    # stdlib-only, and other suites swap the backend modules in sys.modules for
    # a sandbox with a fake lizard. A private copy can neither leak into that
    # sandbox nor be evicted by it, whatever order discovery runs the suites in.
    spec = importlib.util.spec_from_file_location(name, module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


contract = _load_private(
    '_extension_coverage_contract', PYTHON_ROOT / 'utils' / 'metric_language_contract.py')
class_counter = _load_private(
    '_extension_coverage_class_counter', PYTHON_ROOT / 'tools' / 'class_counter_analyzer.py')
comment_analyzer = _load_private(
    '_extension_coverage_comment_analyzer', PYTHON_ROOT / 'tools' / 'python_comment_analyzer.py')


def _source(*lines):
    return '\n'.join(lines) + '\n'


# One snippet per contract language: a declaration the language's own arm counts,
# and a comment in the language's own syntax, each on a line of its own.
SNIPPETS = {
    'Python': _source('# a comment', 'class Sample:', '    pass'),
    'Ruby': _source('# a comment', 'class Sample', 'end'),
    'Java': _source('// a comment', 'public class Sample {', '}'),
    # 'struct Sample {' is counted by the C arm and by the C++ arm alike, which
    # matters because '.h' is a C extension in the contract but is routed to the
    # C++ arm of the class counter.
    'C': _source('/* a comment */', 'struct Sample {', '    int value;', '};'),
    'C++': _source('// a comment', 'class Sample {', 'public:', '    int value;', '};'),
    'C#': _source('// a comment', 'public class Sample', '{', '}'),
    'Erlang': _source('% a comment', '-module(sample).', '-record(point, {x, y}).'),
    'Fortran': _source(
        '! a comment', 'module sample', '  type :: point', '    real :: x',
        '  end type point', 'end module sample'),
    'GDScript': _source('# a comment', 'class_name Sample', 'extends Node'),
    'Go': _source('// a comment', 'package sample', '', 'type Sample struct {', '\tValue int', '}'),
    'JavaScript': _source('// a comment', 'class Sample {', '}'),
    'Kotlin': _source('// a comment', 'class Sample {', '}'),
    'Lua': _source('-- a comment', 'local Sample = {}'),
    'Objective-C': _source('// a comment', '@interface Sample : NSObject', '@end'),
    'PHP': _source('<?php', '// a comment', 'class Sample {', '}'),
    'Perl': _source('# a comment', 'package Sample;', '1;'),
    'Scala': _source('// a comment', 'class Sample {', '}'),
    'Solidity': _source('// a comment', 'contract Sample {', '}'),
    'Swift': _source('// a comment', 'class Sample {', '}'),
    'TypeScript': _source('// a comment', 'interface Shape {', '}', 'class Sample implements Shape {', '}'),
    'TTCN-3': _source(
        '// a comment', 'module Sample {', '    type record Point {', '        integer x',
        '    }', '}'),
    'Vue': _source(
        '<template>', '  <!-- a comment -->', '  <div></div>', '</template>',
        '<script>', '// a comment', 'class Sample {', '}', 'export default {}', '</script>'),
    'Zig': _source('// a comment', 'const Sample = struct {', '    value: i32,', '};'),
}

# KNOWN GAP, NOT ENDORSED: contract extensions that reach analyze_classes and
# match no arm, so a file full of classes reports classCount 0. Six are aliases
# of a language whose primary extension IS counted; Zig ('.zig') and TTCN-3
# ('.ttcn', '.ttcn3') have no arm at all.
CLASS_COUNTER_SILENT = frozenset({
    '.pyw', '.pyi',
    '.rbw',
    '.mjs', '.cjs',
    '.hxx',
    '.zig',
    '.ttcn', '.ttcn3',
})
CLASS_COUNTER_LANGUAGES_WITHOUT_AN_ARM = frozenset({'TTCN-3', 'Zig'})

# KNOWN GAP, NOT ENDORSED: contract extensions that reach analyze_comments and
# fall through, so commentLines reads 0 and those lines are reported as code.
COMMENT_ANALYZER_SILENT = frozenset({
    '.pyw', '.pyi',
    '.phtml', '.php3', '.php4', '.php5',
})
COMMENT_ANALYZER_LANGUAGES_WITHOUT_AN_ARM = frozenset()

# Extensions OUTSIDE the Python contract that still reach these analyzers in a
# live session: the TypeScript watcher gate (DIRECTORY_ANALYSIS_EXTENSIONS in
# src/code_analysis/engine/watchers/analysisFilePolicy.ts) is wider than the
# contract, and the re-analysis of a changed file
# (sumaryFiles/file_reanalysis_coordinator.py -> build_file_snapshot) applies no
# contract filter of its own. The arms below are therefore live, although no
# per-language fixture touches them and the contract does not list them.
# Aliases that no gate admits ('.hh', '.pod', '.t', '.st', '.phps') are left
# unpinned on purpose: removing those is a legitimate cleanup.
WATCHER_ONLY_SNIPPETS = {
    '.jsx': SNIPPETS['JavaScript'],
    '.rs': _source('// a comment', 'struct Sample {', '}'),
    '.r': _source('# a comment', 'value <- 1'),
}
WATCHER_ONLY_WITH_CLASSES = frozenset({'.jsx', '.rs'})
WATCHER_ONLY_WITH_COMMENTS = frozenset({'.jsx', '.r'})

# Every contract snippet in one file. Each arm of either analyzer finds something
# to count in it, whichever language the arm was written for, so under these
# bytes a zero can only mean "no arm at all", never "an arm that cannot see this
# language". Zig and TTCN-3 have no counted sibling extension to vouch for their
# own snippet, and the R snippet declares nothing class-like; this file is what
# vouches for those zeros, and what exposes a lookup table that sends a silent
# extension to SOME arm, even a wrong one.
POLYGLOT = ''.join(SNIPPETS.values())


def _probe(directory, cases):
    """Run both analyzers over ``cases`` and report which labels were counted.

    ``cases`` yields ``(label, file_extension, source)``. The label is what ends
    up in the returned sets; the file extension is what is written to disk.
    """
    with_classes = set()
    with_comments = set()

    for index, (label, file_extension, source) in enumerate(cases):
        # The index keeps names unique on case-insensitive file systems, where
        # 'sample.py' and 'sample.PY' would be one file.
        target = Path(directory) / f'sample_{index}{file_extension}'
        with open(target, 'w', encoding='utf-8', newline='\n') as handle:
            handle.write(source)

        # The comment analyzer narrates every call on stderr. That chatter is
        # not part of any contract; keep it out of the test report.
        with contextlib.redirect_stderr(io.StringIO()):
            class_result = class_counter.analyze_classes(str(target))
            comment_result = comment_analyzer.analyze_comments(str(target))

        # Both analyzers answer a read failure with an 'error' key (and, for
        # comments, a count of 0). A zero must never be mistaken for a gap when
        # it was really an unreadable file.
        if 'error' in class_result or 'error' in comment_result:
            raise AssertionError(f'{label}: analyzer could not read {target}: '
                                 f'{class_result!r} / {comment_result!r}')

        if class_result['classCount'] > 0:
            with_classes.add(label)
        if comment_result['commentLines'] > 0:
            with_comments.add(label)

    return with_classes, with_comments


def _contract_cases(transform=str):
    for language, extensions in contract.get_metric_language_contract().items():
        for extension in extensions:
            yield extension, transform(extension), SNIPPETS[language]


def _languages_without_a_counted_extension(counted):
    return {
        language
        for language, extensions in contract.get_metric_language_contract().items()
        if not set(extensions) & counted
    }


class ContractExtensionCoverageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract_extensions = set(contract.get_supported_metric_extensions())
        missing = set(contract.get_metric_language_names()) - set(SNIPPETS)
        if missing:
            # Without a snippet the probe cannot say anything about the language;
            # fail loudly here instead of with a KeyError from a generator.
            raise AssertionError(f'No snippet for contract language(s): {sorted(missing)}')

        scratch = tempfile.TemporaryDirectory()
        cls.addClassCleanup(scratch.cleanup)
        cls.with_classes, cls.with_comments = _probe(scratch.name, _contract_cases())

    def test_every_snippet_belongs_to_a_contract_language(self):
        # The other direction is enforced in setUpClass. Together they mean a
        # language added to (or dropped from) the contract forces a decision
        # here about which side of each partition its extensions land on.
        self.assertEqual(set(SNIPPETS), set(contract.get_metric_language_names()))

    def test_class_counter_counts_exactly_the_contract_extensions_that_have_an_arm(self):
        silent = self.contract_extensions - self.with_classes

        self.assertEqual(
            sorted(silent - CLASS_COUNTER_SILENT), [],
            'These contract extensions report classCount 0 and are not a pinned gap: an arm was '
            'lost, or the contract gained an extension that no arm handles.')
        self.assertEqual(
            sorted(CLASS_COUNTER_SILENT - silent), [],
            'These extensions used to report classCount 0 and are now counted, or have left the '
            'contract. Either way it is a user-visible metric change: 1.3.0 work, not a 1.2.1 '
            'refactor.')

    def test_comment_analyzer_counts_exactly_the_contract_extensions_that_have_an_arm(self):
        silent = self.contract_extensions - self.with_comments

        self.assertEqual(
            sorted(silent - COMMENT_ANALYZER_SILENT), [],
            'These contract extensions report commentLines 0 and are not a pinned gap: an arm '
            'was lost, or the contract gained an extension that no arm handles.')
        self.assertEqual(
            sorted(COMMENT_ANALYZER_SILENT - silent), [],
            'These extensions used to report commentLines 0 and are now counted, or have left the '
            'contract. Either way it is a user-visible metric change: 1.3.0 work, not a 1.2.1 '
            'refactor.')

    def test_only_the_named_languages_lack_a_counted_extension_to_serve_as_canary(self):
        # The canary for the two negative sets above. A zero proves a dispatch
        # gap only if the very same bytes are counted under a sibling extension;
        # otherwise the snippet itself might be what the analyzer cannot see.
        # Only whole-language gaps lack that proof (the polyglot test below
        # stands in for it), and they are named, so a snippet that quietly stops
        # matching cannot hide here.
        self.assertEqual(
            _languages_without_a_counted_extension(self.with_classes),
            set(CLASS_COUNTER_LANGUAGES_WITHOUT_AN_ARM))
        self.assertEqual(
            _languages_without_a_counted_extension(self.with_comments),
            set(COMMENT_ANALYZER_LANGUAGES_WITHOUT_AN_ARM))

    def test_a_silent_extension_stays_silent_for_a_file_that_every_arm_counts(self):
        # The partitions above are measured with each language's own snippet, so
        # on their own they cannot tell "no arm" from "an arm that cannot see
        # this language": '.zig' sent to the C++ patterns still reads 0 for
        # 'const Sample = struct {', while real Zig files would start to move.
        # Under the polyglot file every arm counts something, so the partition
        # has to come out identical - which also proves, for each counted
        # extension, that its arm does see the polyglot.
        with tempfile.TemporaryDirectory() as scratch:
            polyglot_classes, polyglot_comments = _probe(
                scratch,
                [(extension, extension, POLYGLOT) for extension in sorted(self.contract_extensions)])

        self.assertEqual(sorted(polyglot_classes), sorted(self.with_classes))
        self.assertEqual(sorted(polyglot_comments), sorted(self.with_comments))

    def test_a_c_header_is_still_scanned_with_the_cpp_patterns(self):
        # KNOWN QUIRK, PINNED, NOT ENDORSED. The contract files '.h' under C, but
        # the class counter lists it in its C++ arm, so a C++ class declared in a
        # header is counted today. A table keyed on the contract's language would
        # send '.h' to the C patterns, which cannot see 'class', and every C++
        # header would silently drop to classCount 0. '.c' is the canary: it
        # shows the snippet really does tell the two arms apart.
        with tempfile.TemporaryDirectory() as scratch:
            with_classes, _ = _probe(
                scratch,
                [(extension, extension, SNIPPETS['C++']) for extension in ('.c', '.h')])

        self.assertEqual(sorted(with_classes), ['.h'])

    def test_dispatch_ignores_the_case_of_the_extension(self):
        # The TypeScript gates lower-case the extension before admitting a file,
        # so 'Main.PY' or 'WIDGET.CPP' reaches the backend. Both analyzers lower
        # the path before dispatching; a lookup table keyed on the raw suffix
        # would silently zero those files.
        with tempfile.TemporaryDirectory() as scratch:
            upper_classes, upper_comments = _probe(scratch, _contract_cases(str.upper))

        self.assertEqual(sorted(upper_classes), sorted(self.with_classes))
        self.assertEqual(sorted(upper_comments), sorted(self.with_comments))


class WatcherOnlyExtensionCoverageTests(unittest.TestCase):
    def test_the_premise_holds_that_these_extensions_are_outside_the_contract(self):
        # Once one of them joins the contract, the partition above covers it and
        # it should move there.
        self.assertEqual(
            sorted(set(WATCHER_ONLY_SNIPPETS) & set(contract.get_supported_metric_extensions())), [])

    def test_live_extensions_outside_the_contract_keep_their_arms(self):
        with tempfile.TemporaryDirectory() as scratch:
            with_classes, with_comments = _probe(
                scratch,
                [(extension, extension, source) for extension, source in WATCHER_ONLY_SNIPPETS.items()])

            # The R snippet has nothing class-like in it, so its zero says
            # nothing about arms by itself; the polyglot file does.
            polyglot_classes, polyglot_comments = _probe(
                scratch,
                [(extension, extension, POLYGLOT) for extension in WATCHER_ONLY_SNIPPETS])

        # Same rule as above, both directions: '.rs' without comment counts and
        # '.r' without class counts are gaps being pinned, not endorsed.
        self.assertEqual(sorted(with_classes), sorted(WATCHER_ONLY_WITH_CLASSES))
        self.assertEqual(sorted(with_comments), sorted(WATCHER_ONLY_WITH_COMMENTS))
        self.assertEqual(sorted(polyglot_classes), sorted(WATCHER_ONLY_WITH_CLASSES))
        self.assertEqual(sorted(polyglot_comments), sorted(WATCHER_ONLY_WITH_COMMENTS))


if __name__ == '__main__':
    unittest.main()
