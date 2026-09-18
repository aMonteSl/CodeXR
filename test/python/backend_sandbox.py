"""Scoped module isolation for backend tests that need a fake ``lizard``.

Several suites replace ``lizard`` with a stub so they can run without the real
dependency. Doing that at import time leaks: ``unittest discover`` imports every
test module before running any test, so the stub - and every backend module
that bound to it - stays in ``sys.modules`` for the rest of the process, and
what the other suites exercise depends on discovery order.

``BackendModuleSandbox`` makes the swap explicit and reversible. Use it from
``setUpModule`` / ``tearDownModule``::

    _sandbox = BackendModuleSandbox(PYTHON_ROOT, fake_lizard_module)

    def setUpModule():
        _sandbox.enter()
        ...load the backend modules under test...

    def tearDownModule():
        _sandbox.exit()
"""

import sys
from pathlib import Path


class BackendModuleSandbox:
    def __init__(self, python_root, fake_lizard):
        self._python_root = str(Path(python_root).resolve())
        self._fake_lizard = fake_lizard
        self._saved = None

    def _is_isolated(self, name, module):
        if name == 'lizard':
            return True
        module_file = getattr(module, '__file__', None)
        if not module_file:
            return False
        try:
            return str(Path(module_file).resolve()).startswith(self._python_root)
        except OSError:
            return False

    def enter(self):
        """Set aside lizard and every loaded backend module, then install the fake."""
        if self._saved is not None:
            raise RuntimeError('BackendModuleSandbox.enter() called twice')
        self._saved = {
            name: module
            for name, module in list(sys.modules.items())
            if self._is_isolated(name, module)
        }
        for name in self._saved:
            del sys.modules[name]
        sys.modules['lizard'] = self._fake_lizard

    def exit(self):
        """Drop everything loaded under the fake and put the previous modules back."""
        if self._saved is None:
            return
        for name, module in list(sys.modules.items()):
            if self._is_isolated(name, module):
                del sys.modules[name]
        sys.modules.update(self._saved)
        self._saved = None
