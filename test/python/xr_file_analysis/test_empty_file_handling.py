import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
XR_MODULE_PATH = PROJECT_ROOT / 'src' / 'code_analysis' / 'python' / 'XR' / 'xr_file_analysis_coordinator.py'
UTIL_MODULE_PATH = PROJECT_ROOT / 'src' / 'code_analysis' / 'python' / 'utils' / 'babia_path_utils.py'

xr_spec = importlib.util.spec_from_file_location('xr_file_analysis_coordinator', XR_MODULE_PATH)
xr_module = importlib.util.module_from_spec(xr_spec)
xr_spec.loader.exec_module(xr_module)

util_spec = importlib.util.spec_from_file_location('babia_path_utils', UTIL_MODULE_PATH)
util_module = importlib.util.module_from_spec(util_spec)
util_spec.loader.exec_module(util_module)

analyze_file_for_xr = xr_module.analyze_file_for_xr
generate_fallback_xr_data = xr_module.generate_fallback_xr_data
normalize_path_for_babia = util_module.normalize_path_for_babia
build_tree_path = util_module.build_tree_path


class EmptyFileHandlingTests(unittest.TestCase):
    def test_empty_file_returns_no_functions(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.ts', delete=False) as handle:
            file_path = handle.name

        try:
            result = generate_fallback_xr_data(file_path)
            self.assertEqual(result, [])
        finally:
            Path(file_path).unlink(missing_ok=True)

    def test_non_empty_file_returns_single_fallback_entry_with_normalized_file_path(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.ts', delete=False) as handle:
            handle.write('const value = 1;\n')
            file_path = handle.name

        try:
            result = generate_fallback_xr_data(file_path)
            self.assertEqual(len(result), 1)
            self.assertEqual(result[0]['lineStart'], 1)
            self.assertEqual(result[0]['lineEnd'], 1)
            self.assertEqual(result[0]['lineCount'], 1)
            self.assertEqual(result[0]['spanLines'], 1)
            self.assertEqual(result[0]['complexityBand'], 'normal')
            self.assertEqual(result[0]['filePath'], normalize_path_for_babia(file_path))
            self.assertEqual(result[0]['treePath'], build_tree_path(Path(file_path).name, Path(file_path).stem))
        finally:
            Path(file_path).unlink(missing_ok=True)

    def test_successful_xr_analysis_normalizes_file_path_and_builds_tree_path(self):
        class FakeCompletedProcess:
            def __init__(self, stdout):
                self.returncode = 0
                self.stdout = stdout
                self.stderr = ''

        fake_output = json.dumps({
            'functions': [
                {
                    'name': 'renderScene',
                    'lineStart': 10,
                    'lineEnd': 30,
                    'lineCount': 20,
                    'complexity': 4,
                    'parameters': 2,
                    'maxNestingDepth': 1,
                    'cyclomaticDensity': 0.2,
                }
            ]
        })

        def fake_run(*args, **kwargs):
            return FakeCompletedProcess(fake_output)

        original_run = xr_module.subprocess.run

        with tempfile.NamedTemporaryFile(mode='w', suffix='.ts', delete=False) as handle:
            handle.write('function renderScene(a, b) {\n  return a + b;\n}\n')
            file_path = handle.name

        try:
            xr_module.subprocess.run = fake_run
            result = analyze_file_for_xr(file_path)
            self.assertEqual(len(result), 1)
            self.assertEqual(result[0]['functionName'], 'renderScene')
            self.assertEqual(result[0]['spanLines'], 21)
            self.assertEqual(result[0]['complexityBand'], 'normal')
            self.assertEqual(result[0]['filePath'], normalize_path_for_babia(file_path))
            self.assertEqual(result[0]['treePath'], build_tree_path(Path(file_path).name, 'renderScene'))
        finally:
            xr_module.subprocess.run = original_run
            Path(file_path).unlink(missing_ok=True)


if __name__ == '__main__':
    unittest.main()
