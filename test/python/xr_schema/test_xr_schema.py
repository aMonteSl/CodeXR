import importlib.util
import tempfile
import types
import unittest
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
PYTHON_ROOT = PROJECT_ROOT / 'src' / 'code_analysis' / 'python'
for extra_path in [PYTHON_ROOT, PYTHON_ROOT / 'utils', PYTHON_ROOT / 'livePanels', PYTHON_ROOT / 'XR', Path(__file__).resolve().parents[1]]:
    if str(extra_path) not in sys.path:
        sys.path.insert(0, str(extra_path))

from backend_sandbox import BackendModuleSandbox

MAIN_MODULE_PATH = PYTHON_ROOT / 'main.py'
XR_DIRECTORY_MODULE_PATH = PYTHON_ROOT / 'XR' / 'xr_directory_analysis_coordinator.py'
FILE_COORDINATOR_PATH = PYTHON_ROOT / 'livePanels' / 'livePanel_file_analysis_coordinator.py'
XR_FILE_COORDINATOR_PATH = PYTHON_ROOT / 'XR' / 'xr_file_analysis_coordinator.py'


class _FakeFunction:
    def __init__(self, name):
        self.name = name
        self.start_line = 2
        self.end_line = 6
        self.nloc = 5
        self.cyclomatic_complexity = 4
        self.parameter_count = 2
        self.max_nesting_depth = 2


class _FakeAnalysis:
    def __init__(self, file_path):
        self.file_path = file_path
        self.nloc = 5
        self.function_list = [_FakeFunction(Path(file_path).stem)]


def _fake_analyze_file(file_path):
    return _FakeAnalysis(file_path)


fake_lizard_module = types.ModuleType('lizard')
fake_lizard_module.analyze_file = _fake_analyze_file
fake_lizard_module.FileAnalyzer = lambda *args, **kwargs: _fake_analyze_file
fake_lizard_module.get_extensions = lambda *_: []

# The fake lizard and every backend module bound to it live only while this
# module's tests run: importing this file (which discovery does for every test
# module up front) must not change what the other suites exercise.
_sandbox = BackendModuleSandbox(PYTHON_ROOT, fake_lizard_module)

execute_schema_request = None
analyze_directory_xr = None
analyze_file_comprehensive = None
analyze_file_for_xr = None


def _load_module(name, module_path):
    spec = importlib.util.spec_from_file_location(name, module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def setUpModule():
    global execute_schema_request, analyze_directory_xr, analyze_file_comprehensive, analyze_file_for_xr
    _sandbox.enter()
    execute_schema_request = _load_module('analysis_main', MAIN_MODULE_PATH).execute_schema_request
    analyze_directory_xr = _load_module('xr_directory_analysis_coordinator', XR_DIRECTORY_MODULE_PATH).analyze_directory_xr
    analyze_file_comprehensive = _load_module('livepanel_file_analysis_coordinator', FILE_COORDINATOR_PATH).analyze_file_comprehensive
    analyze_file_for_xr = _load_module('xr_file_analysis_coordinator', XR_FILE_COORDINATOR_PATH).analyze_file_for_xr


def tearDownModule():
    _sandbox.exit()


class XRSchemaContractTests(unittest.TestCase):
    def test_main_schema_mode_returns_expected_contract_sizes(self):
        file_schema = execute_schema_request('file')
        directory_schema = execute_schema_request('directory')

        self.assertEqual(file_schema['schemaVersion'], 1)
        self.assertEqual(file_schema['analysisMode'], 'xr')
        self.assertEqual(file_schema['targetType'], 'file')
        self.assertEqual(len(file_schema['fields']), 13)
        self.assertEqual(sum(1 for field in file_schema['fields'] if field['valueType'] == 'numeric'), 8)

        self.assertEqual(directory_schema['schemaVersion'], 1)
        self.assertEqual(directory_schema['analysisMode'], 'xr')
        self.assertEqual(directory_schema['targetType'], 'directory')
        self.assertEqual(len(directory_schema['fields']), 25)
        self.assertEqual(sum(1 for field in directory_schema['fields'] if field['valueType'] == 'numeric'), 21)

    def test_file_livepanel_and_xr_payloads_match(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as handle:
            handle.write('def sample(value, flag):\n    return value\n')
            file_path = handle.name

        try:
            livepanel_payload = analyze_file_comprehensive(file_path)
            xr_payload = analyze_file_for_xr(file_path)
            self.assertEqual(livepanel_payload, xr_payload)
            self.assertEqual(len(livepanel_payload), 1)
            self.assertEqual(livepanel_payload[0]['functionName'], Path(file_path).stem)
            self.assertEqual(livepanel_payload[0]['maxNestingDepth'], 2)
            self.assertEqual(livepanel_payload[0]['parameters'], 2)
            self.assertIn('treePath', livepanel_payload[0])
            self.assertIn('modifiedAtMs', livepanel_payload[0])
            self.assertIn('modifiedAtIso', livepanel_payload[0])
        finally:
            Path(file_path).unlink(missing_ok=True)

    def test_directory_xr_payload_is_flat_file_array(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / 'sample.py'
            file_path.write_text('def sample(value, flag):\n    return value\n', encoding='utf-8')

            payload = analyze_directory_xr(temp_dir, is_deep=False)
            self.assertEqual(len(payload), 1)
            self.assertEqual(payload[0]['relativePath'], 'sample.py')
            self.assertIn('maxFunctionNestingDepth', payload[0])
            self.assertIn('averageFunctionParameters', payload[0])
            self.assertIn('modifiedAtMs', payload[0])
            self.assertIn('modifiedAtIso', payload[0])


if __name__ == '__main__':
    unittest.main()
