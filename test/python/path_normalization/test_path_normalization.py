import importlib.util
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
BABIA_UTILS_PATH = PROJECT_ROOT / 'src' / 'code_analysis' / 'python' / 'utils' / 'babia_path_utils.py'
XR_SCHEMA_PATH = PROJECT_ROOT / 'src' / 'code_analysis' / 'python' / 'utils' / 'xr_field_schema.py'

babia_spec = importlib.util.spec_from_file_location('babia_path_utils', BABIA_UTILS_PATH)
babia_module = importlib.util.module_from_spec(babia_spec)
babia_spec.loader.exec_module(babia_module)
normalize_path_for_babia = babia_module.normalize_path_for_babia
normalize_output_paths = babia_module.normalize_output_paths
build_tree_path = babia_module.build_tree_path

schema_spec = importlib.util.spec_from_file_location('xr_field_schema', XR_SCHEMA_PATH)
schema_module = importlib.util.module_from_spec(schema_spec)
schema_spec.loader.exec_module(schema_module)
get_xr_schema = schema_module.get_xr_schema
build_complexity_band = schema_module.build_complexity_band
safe_ratio = schema_module.safe_ratio
summarize_function_metrics = schema_module.summarize_function_metrics


class NormalizePathForBabiaTests(unittest.TestCase):
    def test_normalizes_windows_absolute_paths(self):
        self.assertEqual(
            normalize_path_for_babia('C:\\Users\\admin\\project\\file.py'),
            '/Users/admin/project/file.py',
        )

    def test_normalizes_windows_relative_paths(self):
        self.assertEqual(
            normalize_path_for_babia('.\\src\\components\\button.tsx'),
            './src/components/button.tsx',
        )

    def test_collapses_duplicate_separators(self):
        self.assertEqual(
            normalize_path_for_babia('src\\\\nested\\\\folder\\file.ts'),
            'src/nested/folder/file.ts',
        )

    def test_preserves_unix_paths(self):
        self.assertEqual(
            normalize_path_for_babia('/home/user/project/file.py'),
            '/home/user/project/file.py',
        )

    def test_handles_empty_and_none_values(self):
        self.assertEqual(normalize_path_for_babia(''), '')
        self.assertIsNone(normalize_path_for_babia(None))

    def test_normalize_output_paths_recurses_only_whitelisted_keys(self):
        payload = {
            'filePath': 'C:\\Users\\admin\\project\\file.py',
            'relativePath': '.\\src\\components\\button.tsx',
            'directoryPath': 'D:\\repo\\project',
            'originalFile': 'E:\\repo\\template.html',
            'file': {
                'filePath': 'C:\\nested\\module.ts',
            },
            'items': [
                {'file_path': 'C:\\repo\\src\\item.ts'},
                {'path': 'C:\\should\\stay\\untouched.ts'},
            ],
        }

        result = normalize_output_paths(payload)

        self.assertEqual(result['filePath'], '/Users/admin/project/file.py')
        self.assertEqual(result['relativePath'], './src/components/button.tsx')
        self.assertEqual(result['directoryPath'], '/repo/project')
        self.assertEqual(result['originalFile'], '/repo/template.html')
        self.assertEqual(result['file']['filePath'], '/nested/module.ts')
        self.assertEqual(result['items'][0]['file_path'], '/repo/src/item.ts')
        self.assertEqual(result['items'][1]['path'], 'C:\\should\\stay\\untouched.ts')

    def test_build_tree_path_creates_single_hierarchy_level(self):
        self.assertEqual(
            build_tree_path('engine.py', 'renderScene'),
            'engine.py/renderScene',
        )

    def test_build_tree_path_sanitizes_separators_and_empty_values(self):
        self.assertEqual(
            build_tree_path('folder/engine.py', 'scene\\render'),
            'folder_engine.py/scene_render',
        )
        self.assertEqual(
            build_tree_path('', None),
            'unknown/unknown',
        )


class XRFieldSchemaHelperTests(unittest.TestCase):
    def test_safe_ratio_handles_invalid_and_zero_denominator(self):
        self.assertEqual(safe_ratio(3, 10), 0.3)
        self.assertEqual(safe_ratio(3, 0), 0.0)
        self.assertEqual(safe_ratio('x', 5), 0.0)

    def test_build_complexity_band_uses_shared_thresholds(self):
        self.assertEqual(build_complexity_band(3), 'normal')
        self.assertEqual(build_complexity_band(11), 'high')
        self.assertEqual(build_complexity_band(26), 'critical')

    def test_summarize_function_metrics_returns_expected_aggregates(self):
        result = summarize_function_metrics([
            {'lineCount': 10, 'maxNestingDepth': 1, 'complexity': 2},
            {'lineCount': 20, 'maxNestingDepth': 3, 'complexity': 11},
            {'lineCount': 5, 'maxNestingDepth': 2, 'complexity': 30},
        ])

        self.assertEqual(result['averageFunctionLines'], 11.67)
        self.assertEqual(result['maxFunctionLines'], 20)
        self.assertEqual(result['averageFunctionNestingDepth'], 2.0)
        self.assertEqual(result['maxFunctionNestingDepth'], 3)
        self.assertEqual(result['highComplexityFunctions'], 2)
        self.assertEqual(result['criticalComplexityFunctions'], 1)

    def test_schema_exposes_file_and_directory_fields_with_expected_types(self):
        file_schema = get_xr_schema('file')
        directory_schema = get_xr_schema('directory')

        file_fields = {field['id']: field['valueType'] for field in file_schema['fields']}
        directory_fields = {field['id']: field['valueType'] for field in directory_schema['fields']}

        self.assertEqual(file_schema['analysisMode'], 'xr')
        self.assertEqual(file_schema['targetType'], 'file')
        self.assertEqual(file_fields['spanLines'], 'numeric')
        self.assertEqual(file_fields['complexityBand'], 'text')
        self.assertEqual(file_fields['treePath'], 'text')

        self.assertEqual(directory_schema['analysisMode'], 'xr')
        self.assertEqual(directory_schema['targetType'], 'directory')
        self.assertEqual(directory_fields['commentRatio'], 'numeric')
        self.assertEqual(directory_fields['criticalComplexityFunctions'], 'numeric')
        self.assertEqual(directory_fields['filePath'], 'text')
        self.assertNotIn('status', directory_fields)


if __name__ == '__main__':
    unittest.main()
