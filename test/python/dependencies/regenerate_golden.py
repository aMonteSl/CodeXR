#!/usr/bin/env python3
"""Rewrite test/python/dependencies/golden/*.json from the CURRENT engine.

Run it deliberately, when the dependency payload is MEANT to change, and review
the resulting JSON diff like any other code change::

    python test/python/dependencies/regenerate_golden.py            rewrite
    python test/python/dependencies/regenerate_golden.py --check    compare only, exit 1 on a difference

What the documents hold, the forced environments and the two normalizations
are described in test_dependency_golden.py, which also owns the build: this
script and the test must never disagree on how a golden is produced.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import test_dependency_golden as golden  # noqa: E402


def _check(build):
    problems = golden.find_mismatches(build.documents, golden.GOLDEN_DIR)
    for problem in problems:
        print(problem)
    if problems:
        print(golden.regenerate_hint())
        return 1
    print(f'{len(build.documents)} golden documents match the current engine.')
    return 0


def _rewrite(build):
    committed = golden.read_committed(golden.GOLDEN_DIR) if golden.GOLDEN_DIR.is_dir() else {}
    golden.GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    for name, text in sorted(build.documents.items()):
        # LF and UTF-8 whatever the platform; the test reads either line ending.
        with open(golden.GOLDEN_DIR / name, 'w', encoding='utf-8', newline='\n') as handle:
            handle.write(text + '\n')
        status = 'unchanged' if committed.get(name) == text else 'REWRITTEN'
        size = (golden.GOLDEN_DIR / name).stat().st_size
        print(f'{status:>9}  golden/{name}  ({size / 1024:.1f} KB)')
    for name in sorted(set(committed) - set(build.documents)):
        (golden.GOLDEN_DIR / name).unlink()
        print(f'  REMOVED  golden/{name}  (no longer produced)')
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split('\n', 1)[0])
    parser.add_argument('--check', action='store_true', help='compare only; exit 1 on any difference')
    arguments = parser.parse_args(argv)

    build = golden.build_goldens()
    leaks = golden.find_leaked_paths(build.documents, build.roots)
    if leaks:
        # A golden holding this machine's paths would be red everywhere else.
        print('Refusing to continue, a document contains an absolute path:')
        for leak in leaks:
            print(f'  {leak}')
        return 2
    return _check(build) if arguments.check else _rewrite(build)


if __name__ == '__main__':
    sys.exit(main())
