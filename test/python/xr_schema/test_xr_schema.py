import importlib.util
import tempfile
import types
import unittest
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
MAIN_MODULE_PATH = PROJECT_ROOT / 'src' / 'code_analysis' / 'python' / 'main.py'
XR_DIRECTORY_MODULE_PATH = PROJECT_ROOT / 'src' / 'code_analysis' / 'python' / 'XR' / 'xr_directory_analysis_coordinator.py'
LIZARD_MODULE_PATH = PROJECT_ROOT / 'src' / 'code_analysis' / 'python' / 'tools' / 'lizard_analyzer.py'

main_spec = importlib.util.spec_from_file_location('analysis_main', MAIN_MODULE_PATH)
main_module = importlib.util.module_from_spec(main_spec)
main_spec.loader.exec_module(main_module)

xr_dir_spec = importlib.util.spec_from_file_location('xr_directory_analysis_coordinator', XR_DIRECTORY_MODULE_PATH)
xr_dir_module = importlib.util.module_from_spec(xr_dir_spec)
xr_dir_spec.loader.exec_module(xr_dir_module)


class _FakeFunction:
    def __init__(self, name):
        self.name = name
        self.start_line = 1
        self.end_line = 3
        self.nloc = 3
        self.cyclomatic_complexity = 2
        self.parameters = ['value']
        self.max_nesting_depth = 1


class _FakeAnalysis:
    def __init__(self, file_path):
        self.file_path = file_path
        self.nloc = 3
        self.function_list = [_FakeFunction(Path(file_path).stem)]


def _fake_analyze_file(file_path):
    return _FakeAnalysis(file_path)


fake_lizard_module = types.ModuleType('lizard')
fake_lizard_module.analyze_file = _fake_analyze_file
sys.modules['lizard'] = fake_lizard_module

lizard_spec = importlib.util.spec_from_file_location('lizard_analyzer', LIZARD_MODULE_PATH)
lizard_module = importlib.util.module_from_spec(lizard_spec)
lizard_spec.loader.exec_module(lizard_module)

execute_schema_request = main_module.execute_schema_request
create_xr_file_data = xr_dir_module.create_xr_file_data
analyze_file = lizard_module.analyze_file


class XRSchemaContractTests(unittest.TestCase):
    def test_main_schema_mode_returns_expected_contract(self):
        file_schema = execute_schema_request('file')
        directory_schema = execute_schema_request('directory')

        self.assertEqual(file_schema['schemaVersion'], 1)
        self.assertEqual(file_schema['analysisMode'], 'xr')
        self.assertEqual(file_schema['targetType'], 'file')
        self.assertIn('spanLines', [field['id'] for field in file_schema['fields']])
        self.assertIn('complexityBand', [field['id'] for field in file_schema['fields']])

        self.assertEqual(directory_schema['schemaVersion'], 1)
        self.assertEqual(directory_schema['analysisMode'], 'xr')
        self.assertEqual(directory_schema['targetType'], 'directory')
        self.assertIn('commentRatio', [field['id'] for field in directory_schema['fields']])
        self.assertIn('maxFunctionNestingDepth', [field['id'] for field in directory_schema['fields']])

    def test_directory_xr_payload_includes_new_metrics(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / 'sample.py'
            file_path.write_text('def sample():\n    return 1\n', encoding='utf-8')

            payload = create_xr_file_data(
                {
                    'language': 'Python',
                    'totalLines': 2,
                    'codeLines': 2,
                    'commentLines': 0,
                    'blankLines': 0,
                    'commentRatio': 0.0,
                    'codeRatio': 1.0,
                    'blankRatio': 0.0,
                    'classCount': 0,
                    'functionCount': 1,
                    'maxComplexity': 2,
                    'cyclomaticComplexityNumber': 2.0,
                    'cyclomaticComplexityDensity': 1.0,
                    'highComplexityFunctions': 0,
                    'criticalComplexityFunctions': 0,
                    'averageFunctionParameters': 0.0,
                    'maxFunctionParameters': 0,
                    'averageFunctionLines': 2.0,
                    'maxFunctionLines': 2,
                    'averageFunctionNestingDepth': 0.0,
                    'maxFunctionNestingDepth': 0,
                },
                str(file_path),
                temp_dir,
            )

            self.assertEqual(payload['relativePath'], 'sample.py')
            self.assertEqual(payload['commentRatio'], 0.0)
            self.assertEqual(payload['codeRatio'], 1.0)
            self.assertEqual(payload['blankRatio'], 0.0)
            self.assertEqual(payload['averageFunctionLines'], 2.0)
            self.assertEqual(payload['maxFunctionNestingDepth'], 0)
            self.assertIn('fileSizeBytes', payload)

    def test_lizard_wrapper_keeps_common_metrics_shape_for_supported_languages(self):
        suffixes = [
            '.py', '.js', '.ts', '.java', '.c', '.cpp', '.cs', '.go', '.php', '.rb',
        ]
        required_keys = {
            'name',
            'lineStart',
            'lineEnd',
            'lineCount',
            'complexity',
            'parameters',
            'maxNestingDepth',
            'cyclomaticDensity',
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            for suffix in suffixes:
                file_path = Path(temp_dir) / f'sample{suffix}'
                file_path.write_text('placeholder', encoding='utf-8')

                result = analyze_file(str(file_path))
                self.assertEqual(result.get('status'), 'success')
                self.assertEqual(result['file']['fileName'], file_path.name)
                self.assertTrue(required_keys.issubset(result['functions'][0].keys()))


if __name__ == '__main__':
    unittest.main()
