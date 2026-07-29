import importlib.util
import tempfile
import types
import unittest
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
PYTHON_ROOT = PROJECT_ROOT / 'src' / 'code_analysis' / 'python'
for extra_path in [PYTHON_ROOT, PYTHON_ROOT / 'utils', PYTHON_ROOT / 'livePanels', PYTHON_ROOT / 'XR']:
    if str(extra_path) not in sys.path:
        sys.path.insert(0, str(extra_path))

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
sys.modules['lizard'] = fake_lizard_module

for module_name in [
    'lizard_analyzer',
    'file_analysis_engine',
    'file_metric_summary',
    'line_metric_utils',
    'main',
    'analysis_main',
    'livePanel_file_analysis_coordinator',
    'xr_file_analysis_coordinator',
    'xr_directory_analysis_coordinator',
]:
    sys.modules.pop(module_name, None)

main_spec = importlib.util.spec_from_file_location('analysis_main', MAIN_MODULE_PATH)
main_module = importlib.util.module_from_spec(main_spec)
main_spec.loader.exec_module(main_module)

xr_dir_spec = importlib.util.spec_from_file_location('xr_directory_analysis_coordinator', XR_DIRECTORY_MODULE_PATH)
xr_dir_module = importlib.util.module_from_spec(xr_dir_spec)
xr_dir_spec.loader.exec_module(xr_dir_module)

file_spec = importlib.util.spec_from_file_location('livepanel_file_analysis_coordinator', FILE_COORDINATOR_PATH)
file_module = importlib.util.module_from_spec(file_spec)
file_spec.loader.exec_module(file_module)

xr_file_spec = importlib.util.spec_from_file_location('xr_file_analysis_coordinator', XR_FILE_COORDINATOR_PATH)
xr_file_module = importlib.util.module_from_spec(xr_file_spec)
xr_file_spec.loader.exec_module(xr_file_module)

execute_schema_request = main_module.execute_schema_request
analyze_directory_xr = xr_dir_module.analyze_directory_xr
analyze_file_comprehensive = file_module.analyze_file_comprehensive
analyze_file_for_xr = xr_file_module.analyze_file_for_xr


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
