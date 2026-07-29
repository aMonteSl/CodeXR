import importlib.util
import tempfile
import types
import unittest
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
PYTHON_ROOT = PROJECT_ROOT / 'src' / 'code_analysis' / 'python'
for extra_path in [PYTHON_ROOT, PYTHON_ROOT / 'utils', PYTHON_ROOT / 'tools']:
    if str(extra_path) not in sys.path:
        sys.path.insert(0, str(extra_path))

ENGINE_PATH = PYTHON_ROOT / 'utils' / 'file_analysis_engine.py'
UTILS_PATH = PYTHON_ROOT / 'utils' / 'babia_path_utils.py'


class _FakeFunction:
    def __init__(self, name):
        self.name = name
        self.start_line = 1
        self.end_line = 3
        self.nloc = 3
        self.cyclomatic_complexity = 2
        self.parameter_count = 1
        self.max_nesting_depth = 1


class _FakeAnalysis:
    def __init__(self, file_path, has_functions=True):
        self.file_path = file_path
        self.nloc = 3 if has_functions else 0
        self.function_list = [_FakeFunction(Path(file_path).stem)] if has_functions else []


def _fake_analyze_file(file_path):
    try:
        content = Path(file_path).read_text(encoding='utf-8')
    except Exception:
        content = ''
    return _FakeAnalysis(file_path, has_functions=bool(content.strip()))


fake_lizard_module = types.ModuleType('lizard')
fake_lizard_module.analyze_file = _fake_analyze_file
fake_lizard_module.FileAnalyzer = lambda *args, **kwargs: _fake_analyze_file
fake_lizard_module.get_extensions = lambda *_: []
sys.modules['lizard'] = fake_lizard_module

engine_spec = importlib.util.spec_from_file_location('file_analysis_engine', ENGINE_PATH)
engine_module = importlib.util.module_from_spec(engine_spec)
engine_spec.loader.exec_module(engine_module)

util_spec = importlib.util.spec_from_file_location('babia_path_utils', UTILS_PATH)
util_module = importlib.util.module_from_spec(util_spec)
util_spec.loader.exec_module(util_module)

build_file_snapshot = engine_module.build_file_snapshot
build_file_payload = engine_module.build_file_payload
normalize_path_for_babia = util_module.normalize_path_for_babia
build_tree_path = util_module.build_tree_path


class EmptyFileHandlingTests(unittest.TestCase):
    def test_empty_file_returns_zeroed_snapshot_and_empty_payload(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.ts', delete=False) as handle:
            file_path = handle.name

        try:
            snapshot = build_file_snapshot(file_path)
            payload = build_file_payload(file_path, snapshot)
            self.assertEqual(snapshot['totalLines'], 0)
            self.assertEqual(snapshot['functionCount'], 0)
            self.assertEqual(snapshot['maxFunctionNestingDepth'], 0)
            self.assertIn('modifiedAtMs', snapshot)
            self.assertIn('modifiedAtIso', snapshot)
            self.assertIsInstance(snapshot['modifiedAtMs'], int)
            self.assertEqual(payload, [])
        finally:
            Path(file_path).unlink(missing_ok=True)

    def test_non_empty_file_returns_function_payload_with_normalized_path_and_tree_path(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.ts', delete=False) as handle:
            handle.write('const value = 1;\nfunction renderScene(input) {\n  return input + value;\n}\n')
            file_path = handle.name

        try:
            snapshot = build_file_snapshot(file_path)
            payload = build_file_payload(file_path, snapshot)
            self.assertEqual(len(payload), 1)
            self.assertEqual(payload[0]['lineStart'], 1)
            self.assertEqual(payload[0]['lineEnd'], 3)
            self.assertEqual(payload[0]['complexityBand'], 'normal')
            self.assertEqual(payload[0]['filePath'], normalize_path_for_babia(file_path))
            self.assertEqual(payload[0]['treePath'], build_tree_path(Path(file_path).name, Path(file_path).stem))
            self.assertEqual(payload[0]['modifiedAtMs'], snapshot['modifiedAtMs'])
            self.assertEqual(payload[0]['modifiedAtIso'], snapshot['modifiedAtIso'])
        finally:
            Path(file_path).unlink(missing_ok=True)


if __name__ == '__main__':
    unittest.main()

