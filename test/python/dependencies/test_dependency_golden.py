"""Golden snapshots of the dependency engine's answers.

``analyze_dependencies`` (directory mode) and ``analyze_file_dependencies``
(file mode) are the two largest functions of the Python backend and are about
to be reshaped: shared metric helpers instead of inline copies, one raw-target
generator instead of two, a shared external-node helper, phase splits. The
suite next door (``test_dependency_analysis.py``) asserts structural properties
only, so a refactor could move an edge, reorder the nodes or drop a warning
and stay green. Here the WHOLE answer is compared with a committed JSON
document, so any output change shows up as a diff.

What a golden holds
-------------------
* ``payload``: what ``main.py`` would print (one JSON round trip). Node order,
  edge order and key order are kept: the TypeScript side receives these arrays
  and objects as they are, so order is output and nothing is sorted.
* Directory mode only, ``cache``: the private cache document the run wrote.
  Its per-file ``targets`` are the raw extraction result before resolution,
  exactly what the raw-target refactor must not change, and its shape is a
  contract with caches written by an older build (``CACHE_VERSION``).
* Directory mode only, ``refreshFromCacheAloneDiffersIn``: the directory is
  asked for again through an empty incremental refresh, which rebuilds the
  answer from the cache document without reading a source (the engine's other
  big branch). Recorded are the top-level keys that come out differently;
  ``{}`` means none.

Two things are normalized, and nothing else:

* the cache's ``root`` (an absolute path) becomes ``<root>``;
* the ``capabilities`` block, identical in every payload, is stored once per
  document and referenced from the payloads. That is lossless: a payload whose
  block differs keeps it inline.

The payloads carry no absolute path, timestamp or random value today; a
dedicated test keeps it that way.

Forced environment
------------------
The engine takes different paths depending on two OPTIONAL packages, and
``npm run test:python`` uses whatever interpreter it finds, where they may or
may not be installed. Every golden is therefore built under a forced state,
set up and torn down inside ``build_goldens``:

* ``directory_without_structured_parser`` / ``file_without_lizard``: both
  packages look uninstalled (a meta-path finder raises the very
  ``ModuleNotFoundError`` a missing install produces, so the warnings read as
  they do in production). This pins the lexical adapter and the "Lizard
  unavailable ... lexical symbol fallback used" branch.
* ``directory_with_structured_parser`` / ``file_with_lizard``: deterministic
  fakes stand in for ``tree_sitter_language_pack`` and ``lizard``. This pins
  what the engine DOES with their answers (the grammar names it asks for, which
  structured targets it keeps, how parser availability becomes a warning, how
  lizard's functions are merged with the lexical scan and given an owner), not
  the packages themselves.

Known non-determinism the goldens have to neutralize
-----------------------------------------------------
``_normalize_reference`` returns ``list({...})``: the candidate keys of a
reference come out in set order, which depends on the interpreter's str hash
seed, and the engine takes the FIRST candidate that resolves. With the fixture
corpus, ``#include "shared.h"`` resolves to ``shared.h`` in one process and to
``shared.gd`` (the first file whose stem is ``shared``) in the next. A snapshot
of that cannot be stable, so the goldens are built with the candidates tried in
sorted order. For every single reference that is one of the orders the engine
really uses today, made repeatable; the membership of the candidate list is
still the engine's. The price: sorted order tries the bare stem first, so the
goldens show ``shared.h`` resolved to ``shared.gd``, and they cannot see a
change that only reorders the candidates. Whoever makes ``_normalize_reference``
return an ordered list MUST delete ``canonical_candidate_order`` in the same
change and regenerate, or the goldens keep pinning an order production no
longer uses; the diff then shows what the fix changed.

Oddities that are in the goldens because they are today's behaviour
-------------------------------------------------------------------
They look wrong in the JSON and are pinned anyway; a behaviour-neutral refactor
keeps them, and a fix shows up as a reviewed diff.

* A refresh served from the cache loses the per-file read warnings ("invalid
  UTF-8 replaced"): they are only produced while reading.
* In a brace language a function declared after a class becomes that class's
  method (shapes.ts: compute, standalone): the brace count includes the
  function's own opening line.
* With lizard, class lines come from the class counter, which reports the first
  blank line above a class; Python methods below such a class lose their owner
  (worker.py: describe, run, again are functions of the module).
* Directory mode turns an unresolved call into an external node; file mode
  drops it.
* The owner-by-name rule is a substring test on the qualified name, so
  ``rebase()`` is a method of ``Base`` (worker.py).
* A declaration with parentheses is also a call: ``class Worker(Base):`` gives
  the module a call edge to ``Worker``. ``self.describe()`` on the other hand is
  never resolved, only bare names are.

Corpus
------
* ``test/fixtures/dependency-languages`` (one tiny file per language) for the
  per-language extraction and resolution.
* A small project written to a temp dir (``PROJECT_FILES``). The fixture files
  are one to four lines long and contain no function, method, cycle or nested
  folder, so on their own they would leave most of both functions untouched.

Regenerating
------------
When the output is MEANT to change::

    python test/python/dependencies/regenerate_golden.py

then review the JSON diff like any other code change.
"""

import contextlib
import difflib
import functools
import importlib
import io
import json
import os
import subprocess
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

PROJECT_ROOT = Path(__file__).resolve().parents[3]
PYTHON_ROOT = PROJECT_ROOT / 'src' / 'code_analysis' / 'python'
UTILS_ROOT = PYTHON_ROOT / 'utils'
CORPUS = PROJECT_ROOT / 'test' / 'fixtures' / 'dependency-languages'
GOLDEN_DIR = Path(__file__).resolve().parent / 'golden'
REGENERATE_SCRIPT = Path(__file__).resolve().with_name('regenerate_golden.py')
REGENERATE_COMMAND = 'python test/python/dependencies/regenerate_golden.py'

OPTIONAL_DEPENDENCIES = ('lizard', 'tree_sitter_language_pack')
ROOT_TOKEN = '<root>'
ABSENT_TOKEN = '<absent>'
CAPABILITIES_TOKEN = '<the capabilities block at the top of this document>'

# Fixture files analyzed in file mode. python_sample.py has an import that
# resolves inside the corpus, cpp_sample.cpp adds a class symbol to an include,
# and ttcn_sample.ttcn3 yields one local and one external target from one line.
CORPUS_FILE_TARGETS = ('python_sample.py', 'cpp_sample.cpp', 'ttcn_sample.ttcn3')

# What the fixture corpus cannot exercise: symbols and their owners (by
# indentation in worker.py, by braces in shapes.ts), call edges, recursion,
# a call cycle (ping/pong), a file cycle (worker <-> helpers, three files long
# once package/ is scanned), a module reached through its dotted name inside a
# folder that a non-recursive scan skips, one external package imported twice,
# and a file that is not valid UTF-8.
#
# Every odd-looking line below keeps one decision of the engine observable: a
# mutation of that decision was checked to leave the goldens green without it.
# They sit exactly where the planned helpers will be cut out.
#   worker.py
#   * 'from worker.plugins ...': a reference whose stem is the analyzed file
#     itself. File mode keeps the target out of its own lookup (it becomes the
#     external 'worker'); directory mode drops the self edge.
#   * the two comments in column 0: neither the owner walk nor the
#     end-of-function walk may treat a comment as a dedent.
#   * inner(): indented, but below a line that closed both class scopes.
#   * Late.helper: a second 'helper'. A bare helper() call goes to the FIRST
#     symbol of that name, so a lookup rebuilt as a dict comprehension (last
#     one wins) shows up.
#   * rebase(): the owner-by-name rule is a substring test, and 'base' is in
#     'rebase', so today this function is a method of Base.
#   helpers.py
#   * 'import util': reaches package/util.py through its bare stem only.
#   package/util.py
#   * analyzed in file mode too: the only target whose relative path has a
#     folder, so the project root really is the root that was passed in.
#   shapes.ts
#   * 'FS/promises' after 'fs': externals are deduplicated case-insensitively
#     and keep the first spelling as their label.
#   * '../outside': nothing is left in front of the first separator, so the
#     external key falls back to the whole reference.
#   * 'Base<number>': the generic suffix is cut off an inheritance target.
#   * 'Match(size)': call keywords are compared in lower case, so this is the
#     keyword 'match' and not a call.
#   tasks.pl
#   * 'package::util': '::' is a path separator when a reference is resolved.
PROJECT_FILES = {
    'worker.py': (
        'import os\n'
        'import helpers\n'
        'import vendor_lib.extras\n'
        'from package.util import tool\n'
        'from vendor_lib.core import thing\n'
        'from worker.plugins import late_bound\n'
        '\n'
        '\n'
        'class Base:\n'
        '    def describe(self):\n'
        '        return helper(1)\n'
        '\n'
        '\n'
        'class Worker(Base):\n'
        '    def run(self):\n'
        '        self.describe()\n'
        '        return helper(tool(2))\n'
        '\n'
        '# column 0: Worker stays open\n'
        '    def again(self):\n'
        '        return self.run()\n'
        '\n'
        '\n'
        'def helper(value=0):\n'
        '    if value:\n'
        '        return helper(value - 1)\n'
        '    return pong()\n'
        '\n'
        '\n'
        'def ping():\n'
        '# column 0: ping goes on\n'
        '    return pong()\n'
        '\n'
        '\n'
        'def pong():\n'
        '    def inner():\n'
        '        return ping()\n'
        '    return inner()\n'
        '\n'
        '\n'
        'class Late:\n'
        '    def helper(self):\n'
        '        return rebase()\n'
        '\n'
        '\n'
        'def rebase():\n'
        '    return ping()\n'
    ),
    'helpers.py': (
        'import worker\n'
        'import util\n'
        '\n'
        '\n'
        'def assist():\n'
        '    return worker.ping()\n'
    ),
    'package/util.py': (
        'import helpers\n'
        '\n'
        '\n'
        'def tool(value):\n'
        '    return value\n'
    ),
    'shapes.ts': (
        'import { area } from "./geometry";\n'
        'import fs from "fs";\n'
        'import { join } from "FS/promises";\n'
        'import { outside } from "../outside";\n'
        '\n'
        'interface Shape {\n'
        '  area(): number;\n'
        '}\n'
        '\n'
        'class Circle extends Base<number> implements Shape {\n'
        '  area() {\n'
        '    return compute(2);\n'
        '  }\n'
        '}\n'
        '\n'
        'function compute(size: number) {\n'
        '  return area(size) * Match(size);\n'
        '}\n'
        '\n'
        'function standalone() {\n'
        '  return compute(1);\n'
        '}\n'
    ),
    'geometry.ts': (
        'export function area(size: number) {\n'
        '  return size * size;\n'
        '}\n'
    ),
    'tasks.pl': (
        'use strict;\n'
        'use package::util;\n'
    ),
    'legacy.py': b'import os\nNAME = "caf\xe9"\n',
}
PROJECT_FILE_TARGETS = ('worker.py', 'shapes.ts', 'package/util.py')

# What the fake lizard reports, per file name:
# (name, long name, first line, last line, nloc, complexity, parameters, nesting).
# * Three functions are left out on purpose (ping, inner, standalone): the
#   engine tops lizard's list up with its own lexical scan, and that merge is
#   behaviour. ping and inner sit in the MIDDLE of worker.py, so the merged list
#   is only in line order (and the ordinals inside the symbol ids only come out
#   right) because the engine sorts it again.
# * 'Late::helper' names its class although it is a Python method. With lizard
#   the class lines are off (see the module docstring), so the long name is the
#   only way this method finds its owner: without the owner-by-name rule it
#   would be a function of the module, like describe, run and again.
# A test below checks that every row points at a line that defines that name.
FAKE_LIZARD_FUNCTIONS = {
    'worker.py': (
        ('describe', 'describe( self )', 10, 11, 2, 1, 1, 0),
        ('run', 'run( self )', 15, 17, 3, 1, 1, 0),
        ('again', 'again( self )', 20, 21, 2, 1, 1, 0),
        ('helper', 'helper( value = 0 )', 24, 27, 4, 2, 1, 1),
        ('pong', 'pong( )', 35, 38, 4, 1, 0, 1),
        ('helper', 'Late::helper( self )', 42, 43, 2, 1, 1, 0),
        ('rebase', 'rebase( )', 46, 47, 2, 1, 0, 0),
    ),
    'shapes.ts': (
        ('area', 'Circle::area', 11, 13, 3, 1, 0, 0),
        ('compute', 'compute( size : number )', 16, 18, 3, 1, 1, 0),
    ),
    'util.py': (
        ('tool', 'tool( value )', 4, 5, 2, 1, 1, 0),
    ),
}

# The fake structured parser has no grammar for TTCN-3, and it chokes on two
# single files, recognized by their text: shared.zig, the FIRST Zig file in
# path order, and solidity_sample.sol, the SECOND Solidity file. Today the first
# file of a language decides whether that language is reported as "structured
# parser unavailable", so the golden has a Zig warning and no Solidity warning.
FAKE_PARSER_MISSING_GRAMMAR = 'ttcn'
FAKE_PARSER_REJECTED_TEXTS = ('pub const value', 'import "./shared.sol"')


class _NotInstalled:
    """Meta-path finder that makes packages look exactly like a missing install."""

    def __init__(self, names):
        self._names = frozenset(names)

    def find_spec(self, fullname, path=None, target=None):
        if fullname.partition('.')[0] in self._names:
            raise ModuleNotFoundError(f'No module named {fullname!r}', name=fullname)
        return None


@functools.lru_cache(maxsize=None)
def _is_under(module_file, directory):
    # Memoized: resolving several hundred module files costs more than the
    # analyses themselves, and sys.modules is walked six times per build.
    try:
        return Path(module_file).resolve().is_relative_to(directory)
    except OSError:
        return False


def _is_swapped(name, module):
    """The optional packages and every backend module: what a forced environment owns."""
    if name.partition('.')[0] in OPTIONAL_DEPENDENCIES:
        return True
    module_file = getattr(module, '__file__', None)
    return bool(module_file) and _is_under(module_file, PYTHON_ROOT)


def import_state():
    """What a forced environment must hand back untouched (all suites share one process)."""
    return {
        'sys.path': list(sys.path),
        'sys.meta_path': list(sys.meta_path),
        'sys.modules': {
            name: module
            for name, module in list(sys.modules.items())
            if _is_swapped(name, module)
        },
    }


@contextlib.contextmanager
def forced_environment(optional_dependencies):
    """Yield a freshly imported engine while the optional packages are forced.

    ``optional_dependencies`` maps each name in OPTIONAL_DEPENDENCIES to a fake
    module, or to None for "not installed". Backend modules loaded earlier are
    set aside as well: ``lizard_analyzer`` binds to whatever ``lizard`` it saw
    at import time, so a cached copy would silently undo the forcing. On exit
    everything loaded inside is dropped and the previous modules come back,
    the same discipline as ``backend_sandbox.BackendModuleSandbox``.
    """
    saved_modules = import_state()['sys.modules']
    saved_path = list(sys.path)
    blocker = _NotInstalled(
        name for name, module in optional_dependencies.items() if module is None
    )
    for name in saved_modules:
        del sys.modules[name]
    for name, module in optional_dependencies.items():
        if module is not None:
            sys.modules[name] = module
    sys.meta_path.insert(0, blocker)
    sys.path.insert(0, str(UTILS_ROOT))
    try:
        yield importlib.import_module('dependency_analysis_engine')
    finally:
        sys.meta_path.remove(blocker)
        for name, module in list(sys.modules.items()):
            if _is_swapped(name, module):
                del sys.modules[name]
        sys.modules.update(saved_modules)
        sys.path[:] = saved_path


@contextlib.contextmanager
def canonical_candidate_order(engine, seen):
    """Try a reference's candidate keys in sorted order (see the module docstring)."""
    original = getattr(engine, '_normalize_reference', None)
    if original is None:
        # A rename or a move is fine, but it has to be followed here: without
        # this shim the goldens are red or green depending on the hash seed.
        raise AssertionError(
            'dependency_analysis_engine._normalize_reference is gone. The goldens sort the '
            'candidate keys it returns (module docstring, "Known non-determinism"); point '
            'canonical_candidate_order at whatever produces the candidate keys now.'
        )

    def ordered(reference):
        seen.append(reference)
        return sorted(original(reference))

    with mock.patch.object(engine, '_normalize_reference', ordered):
        yield


def fake_lizard():
    def analyze_file(file_path):
        rows = FAKE_LIZARD_FUNCTIONS.get(Path(file_path).name, ())
        functions = [
            types.SimpleNamespace(
                name=name, long_name=long_name, start_line=first, end_line=last,
                nloc=nloc, cyclomatic_complexity=complexity,
                parameter_count=parameters, max_nesting_depth=nesting,
            )
            for name, long_name, first, last, nloc, complexity, parameters, nesting in rows
        ]
        return types.SimpleNamespace(
            nloc=sum(function.nloc for function in functions),
            function_list=functions,
        )

    module = types.ModuleType('lizard')
    module.analyze_file = analyze_file
    return module


def fake_structured_parser():
    """A stand-in for tree_sitter_language_pack whose answer shows up in the payload.

    For every file it reports one import the lexical adapter cannot see, named
    after the grammar the engine asked for (so the language-to-grammar table is
    in the golden), wrapped in statements of the kinds the engine must drop
    from structured results (a call, an inheritance). It only does so when the
    engine asks for imports, so a request that stops asking empties the golden.
    """
    class ProcessConfig:
        def __init__(self, **options):
            self.language = options['language']
            self.imports = options.get('imports', False)

    def process(text, config):
        if config.language == FAKE_PARSER_MISSING_GRAMMAR:
            raise LookupError(f'no grammar for {config.language}')
        if any(marker in text for marker in FAKE_PARSER_REJECTED_TEXTS):
            raise ValueError('the fake parser rejects this file')
        source = (
            f'import structured_{config.language}\n'
            'class StructuredOnly extends StructuredBase {}\n'
            'structured_only_call()\n'
        )
        imports = [types.SimpleNamespace(source=source)] if config.imports else []
        return types.SimpleNamespace(imports=imports)

    module = types.ModuleType('tree_sitter_language_pack')
    module.ProcessConfig = ProcessConfig
    module.process = process
    return module


def _write_project(root):
    for relative, content in PROJECT_FILES.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content if isinstance(content, bytes) else content.encode('utf-8'))


def _as_printed(value):
    """The value as a consumer of the backend's stdout gets it: one JSON round trip."""
    return json.loads(json.dumps(value))


def _differences(full_scan, from_cache):
    """The top-level payload and cache keys that a cache-only answer fills differently."""
    different = {}
    for section in ('payload', 'cache'):
        before, after = full_scan[section], from_cache[section]
        for key in [*before, *(key for key in after if key not in before)]:
            if json.dumps(before.get(key, ABSENT_TOKEN)) != json.dumps(after.get(key, ABSENT_TOKEN)):
                different[f'{section}.{key}'] = after.get(key, ABSENT_TOKEN)
    return different


def _directory_case(engine, root, recursive, scratch):
    """One full scan, then an empty incremental refresh that may only use the cache.

    The refresh takes the engine's other big branch: targets, parser
    availability and line counts are rebuilt from the cache document instead of
    from the sources. ``_read_text`` is booby-trapped meanwhile, so an answer
    equal to the full scan cannot come from a silent fall-back to a full scan.
    """
    cache_path = Path(tempfile.mkdtemp(dir=scratch)) / 'dependency-cache.json'
    request_path = cache_path.with_name('refresh-request.json')
    request_path.write_text(json.dumps({
        'sourceRevision': 2, 'forceFullScan': False,
        'changedFiles': [], 'addedFiles': [], 'removedFiles': [],
    }), encoding='utf-8')

    def answer(payload):
        return {
            'payload': _as_printed(payload),
            'cache': json.loads(cache_path.read_text(encoding='utf-8')),
        }

    full_scan = answer(engine.analyze_dependencies(
        str(root), recursive=recursive, cache_path=str(cache_path),
    ))
    booby_trap = AssertionError('a refresh with nothing to refresh read a source file')
    with mock.patch.object(engine, '_read_text', side_effect=booby_trap):
        from_cache = answer(engine.analyze_dependencies(
            str(root), recursive=recursive, cache_path=str(cache_path),
            refresh_request_path=str(request_path),
        ))
    return {**full_scan, 'refreshFromCacheAloneDiffersIn': _differences(full_scan, from_cache)}


def _file_case(engine, root, relative):
    return {'payload': _as_printed(
        engine.analyze_file_dependencies(str(root / relative), project_root=str(root))
    )}


def _normalized(case, root):
    """Replace the one machine-specific value of a case, and only if it is the expected one."""
    cache = case.get('cache')
    if cache and cache.get('root') == os.path.realpath(root):
        return {**case, 'cache': {**cache, 'root': ROOT_TOKEN}}
    return case


def _document(pins, cases):
    capabilities = next(iter(cases.values()))['payload'].get('capabilities')
    hoisted = {}
    for name, case in cases.items():
        payload = dict(case['payload'])
        if 'capabilities' in payload and payload['capabilities'] == capabilities:
            payload['capabilities'] = CAPABILITIES_TOKEN
        hoisted[name] = {**case, 'payload': payload}
    return {
        'generatedBy': REGENERATE_COMMAND,
        'pins': pins,
        'capabilities': capabilities,
        'cases': hoisted,
    }


LINE_WIDTH = 220


def render_json(value, indent=0):
    """JSON with one node, edge, cache entry or capability row per line.

    Containers are broken up until they fit the line, so a changed edge is a
    one-line diff instead of a seven-line one. Key order is kept as it is.
    """
    compact = json.dumps(value)
    if not isinstance(value, (dict, list)) or not value or indent + len(compact) <= LINE_WIDTH:
        return compact
    padding = ' ' * (indent + 2)
    if isinstance(value, dict):
        rows = [
            f'{padding}{json.dumps(key)}: {render_json(item, indent + 2)}'
            for key, item in value.items()
        ]
        opening, closing = '{', '}'
    else:
        rows = [f'{padding}{render_json(item, indent + 2)}' for item in value]
        opening, closing = '[', ']'
    return opening + '\n' + ',\n'.join(rows) + '\n' + ' ' * indent + closing


class GoldenBuild:
    def __init__(self):
        self.documents = {}       # golden file name -> rendered JSON text
        self.unnormalized = {}    # the directory documents before normalization
        self.roots = []           # absolute paths no document may contain
        # References that went through canonical_candidate_order, per mode.
        self.candidate_lookups = {'directory': [], 'file': []}
        self.import_state_before = None
        self.import_state_after = None


DIRECTORY_CASES = {
    # name: (root, recursive)
    'fixture corpus, recursive': ('fixture corpus', True),
    'project, recursive': ('project', True),
    'project, top level only': ('project', False),
}


def _build_documents(build, scratch):
    project = scratch / 'project'
    _write_project(project)
    roots = {'fixture corpus': CORPUS, 'project': project}
    build.roots = [os.path.realpath(root) for root in roots.values()]

    def directory_document(engine, file_name, pins, names):
        cases = {}
        with canonical_candidate_order(engine, build.candidate_lookups['directory']):
            for name in names:
                root, recursive = DIRECTORY_CASES[name]
                cases[name] = _directory_case(engine, roots[root], recursive, scratch)
        build.unnormalized[file_name] = render_json(_document(pins, cases))
        build.documents[file_name] = render_json(_document(pins, {
            name: _normalized(case, roots[DIRECTORY_CASES[name][0]])
            for name, case in cases.items()
        }))

    def file_document(engine, file_name, pins):
        cases = {}
        with canonical_candidate_order(engine, build.candidate_lookups['file']):
            for root, targets in (
                ('fixture corpus', CORPUS_FILE_TARGETS),
                ('project', PROJECT_FILE_TARGETS),
            ):
                for relative in targets:
                    cases[f'{root}: {relative}'] = _file_case(engine, roots[root], relative)
        build.documents[file_name] = render_json(_document(pins, cases))

    with forced_environment({'lizard': None, 'tree_sitter_language_pack': None}) as engine:
        directory_document(
            engine, 'directory_without_structured_parser.json',
            'analyze_dependencies; tree_sitter_language_pack not installed (lexical adapter only)',
            tuple(DIRECTORY_CASES),
        )
        file_document(
            engine, 'file_without_lizard.json',
            'analyze_file_dependencies; lizard not installed (lexical symbol fallback)',
        )

    fakes = {'lizard': fake_lizard(), 'tree_sitter_language_pack': fake_structured_parser()}
    with forced_environment(fakes) as engine:
        directory_document(
            engine, 'directory_with_structured_parser.json',
            'analyze_dependencies; fake tree_sitter_language_pack (see fake_structured_parser)',
            ('fixture corpus, recursive',),
        )
        file_document(
            engine, 'file_with_lizard.json',
            'analyze_file_dependencies; fake lizard (see FAKE_LIZARD_FUNCTIONS)',
        )


def build_goldens():
    """Run the CURRENT engine over the corpus and the project, in both forced environments.

    Every piece of global state touched on the way (sys.modules, sys.path,
    sys.meta_path, sys.stderr, the temp dir holding the project and the caches)
    is back to what it was when this returns.
    """
    build = GoldenBuild()
    build.import_state_before = import_state()
    # The comment analyzer reports its progress on stderr for every file; kept
    # out of the test output unless the build fails.
    chatter = io.StringIO()
    try:
        with contextlib.redirect_stderr(chatter), tempfile.TemporaryDirectory() as temporary:
            _build_documents(build, Path(os.path.realpath(temporary)))
    except BaseException:
        sys.stderr.write(chatter.getvalue())
        raise
    build.import_state_after = import_state()
    return build


def _spellings(path):
    """An absolute path as it could appear inside rendered JSON."""
    return {path, path.replace('\\', '/'), json.dumps(path)[1:-1]}


def find_leaked_paths(documents, roots):
    return sorted(
        f'{name} contains {spelling}'
        for name, text in documents.items()
        for root in roots
        for spelling in _spellings(root)
        if spelling in text
    )


def read_committed(golden_dir):
    """{file name: canonical rendering} of the committed goldens.

    Re-rendering what was parsed makes the comparison blind to line endings
    (a Windows checkout may hold CRLF) and to reformatting, while values,
    list order and key order still have to match exactly.
    """
    return {
        path.name: render_json(json.loads(path.read_text(encoding='utf-8')))
        for path in sorted(Path(golden_dir).glob('*.json'))
    }


MAX_DIFF_LINES = 60


def describe_mismatch(name, committed, current):
    """None when the committed rendering equals the current one, else a short unified diff."""
    if committed is None:
        return f'golden/{name} is missing.'
    if committed == current:
        return None
    diff = list(difflib.unified_diff(
        committed.splitlines(), current.splitlines(),
        f'golden/{name} (committed)', f'golden/{name} (current engine)',
        lineterm='', n=2,
    ))
    hidden = len(diff) - MAX_DIFF_LINES
    if hidden > 0:
        diff = diff[:MAX_DIFF_LINES] + [f'... {hidden} more diff lines']
    return f'golden/{name} is not what the engine produces now:\n' + '\n'.join(diff)


def find_mismatches(documents, golden_dir):
    """Every difference between freshly built documents and a golden directory."""
    committed = read_committed(golden_dir)
    problems = [
        describe_mismatch(name, committed.get(name), text)
        for name, text in sorted(documents.items())
    ]
    problems.extend(
        f'golden/{name} is not produced by build_goldens() any more.'
        for name in sorted(set(committed) - set(documents))
    )
    return [problem for problem in problems if problem]


def regenerate_hint():
    return (
        '\nIf the output was MEANT to change, regenerate and review the diff:\n'
        f'    {REGENERATE_COMMAND}\n'
        'If it was not, the change under test altered the dependency payload.'
    )


_build = None


def setUpModule():
    # Built once. Every global the build touches is restored before this
    # returns, so the tests below only compare strings.
    global _build
    _build = build_goldens()


def tearDownModule():
    global _build
    _build = None


class DependencyGoldenTests(unittest.TestCase):
    def _assert_golden(self, name):
        problem = describe_mismatch(name, read_committed(GOLDEN_DIR).get(name), _build.documents[name])
        if problem:
            self.fail(problem + regenerate_hint())

    def test_directory_answers_match_the_golden_when_no_structured_parser_is_installed(self):
        self._assert_golden('directory_without_structured_parser.json')

    def test_directory_answers_match_the_golden_when_a_structured_parser_answers(self):
        self._assert_golden('directory_with_structured_parser.json')

    def test_file_payloads_match_the_golden_when_lizard_is_not_installed(self):
        self._assert_golden('file_without_lizard.json')

    def test_file_payloads_match_the_golden_when_lizard_answers(self):
        self._assert_golden('file_with_lizard.json')

    def test_golden_directory_holds_exactly_the_documents_the_build_produces(self):
        # A golden nobody compares against looks like coverage and is not.
        self.assertEqual(sorted(_build.documents), sorted(read_committed(GOLDEN_DIR)))

    def test_no_golden_contains_an_absolute_path(self):
        # Canary: the same search does find the roots in the documents as they
        # were before normalization, so an empty result is not a blind detector.
        self.assertTrue(find_leaked_paths(_build.unnormalized, _build.roots))
        self.assertEqual([], find_leaked_paths(_build.documents, _build.roots))

    def test_the_candidate_order_shim_is_on_the_resolution_path_of_both_modes(self):
        # If resolution stops going through engine._normalize_reference the
        # shim is dead and the goldens silently depend on the hash seed again.
        # 'shared.h' is the reference whose candidates resolve to two files.
        self.assertIn('shared.h', _build.candidate_lookups['directory'])
        self.assertIn('shared.h', _build.candidate_lookups['file'])

    def test_goldens_are_reproduced_under_other_str_hash_seeds(self):
        # Set iteration order is fixed within one process, so only another
        # process can show that a golden depends on it.
        if find_mismatches(_build.documents, GOLDEN_DIR):
            # The other processes compare with the same committed files and
            # would only print the same diff two more times.
            self.skipTest('this process already differs from the committed goldens')
        for seed in ('1', '2'):
            with self.subTest(PYTHONHASHSEED=seed):
                result = subprocess.run(
                    [sys.executable, str(REGENERATE_SCRIPT), '--check'],
                    env={**os.environ, 'PYTHONHASHSEED': seed},
                    cwd=str(PROJECT_ROOT), capture_output=True, text=True,
                )
                self.assertEqual(0, result.returncode, result.stdout[-4000:] + result.stderr[-4000:])

    def test_building_the_goldens_hands_back_the_import_state_it_found(self):
        self.assertEqual(_build.import_state_before, _build.import_state_after)

    def test_every_fake_lizard_row_points_at_the_line_that_defines_its_function(self):
        # The engine matches lizard's functions with its own scan by (name,
        # first line). A row that drifted away from PROJECT_FILES would be
        # topped up with a twin, and the golden would pin the twin as if it
        # were behaviour.
        sources = {
            Path(relative).name: content.decode('utf-8', 'replace') if isinstance(content, bytes) else content
            for relative, content in PROJECT_FILES.items()
        }
        self.assertEqual(len(PROJECT_FILES), len(sources), 'the fake lizard tells files apart by base name')
        self.assertTrue(set(FAKE_LIZARD_FUNCTIONS) <= set(sources), sorted(FAKE_LIZARD_FUNCTIONS))
        for file_name, rows in FAKE_LIZARD_FUNCTIONS.items():
            lines = sources[file_name].splitlines()
            self.assertTrue(rows, file_name)
            for name, _long_name, first, last, *_metrics in rows:
                with self.subTest(file=file_name, function=name, line=first):
                    self.assertTrue(1 <= first <= last <= len(lines), (first, last, len(lines)))
                    self.assertRegex(lines[first - 1], rf'\b{name}\(')

    def test_the_comparison_notices_order_changes_and_single_values(self):
        # Guards the comparison itself: whoever makes it "stable" by sorting
        # nodes, edges or keys turns the goldens into a weaker check. The
        # baseline is this process's own document taken through the same
        # parse-and-render step a committed file goes through, so this test
        # says nothing about the committed goldens and stays green while they
        # are being changed on purpose.
        name = 'directory_without_structured_parser.json'
        baseline = render_json(json.loads(_build.documents[name]))
        self.assertEqual(_build.documents[name], baseline, 'a golden must survive being written and read back')

        def problem_after(mutate):
            document = json.loads(_build.documents[name])
            mutate(document['cases']['fixture corpus, recursive']['payload'])
            return describe_mismatch(name, baseline, render_json(document))

        def reverse_metric_keys(payload):
            node = payload['nodes'][0]
            node['metrics'] = dict(reversed(list(node['metrics'].items())))

        def count_one_more(payload):
            payload['edges'][0]['occurrences'] += 1

        self.assertIsNone(problem_after(lambda payload: None))
        self.assertIsNotNone(problem_after(lambda payload: payload['nodes'].reverse()))
        self.assertIsNotNone(problem_after(lambda payload: payload['edges'].reverse()))
        self.assertIsNotNone(problem_after(reverse_metric_keys))
        self.assertIsNotNone(problem_after(count_one_more))


if __name__ == '__main__':
    unittest.main()
