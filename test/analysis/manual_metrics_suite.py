import json
import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
PYTHON_ROOT = PROJECT_ROOT / 'src' / 'code_analysis' / 'python'
for extra_path in [
    PYTHON_ROOT,
    PYTHON_ROOT / 'utils',
    PYTHON_ROOT / 'livePanels',
    PYTHON_ROOT / 'XR',
    PYTHON_ROOT / 'html',
]:
    if str(extra_path) not in sys.path:
        sys.path.insert(0, str(extra_path))

from babia_path_utils import normalize_path_for_babia
from html_dom_parser import extract_html_content
from livePanel_directory_analysis_coordinator import analyze_directory_comprehensive
from livePanel_directory_deep_analysis_coordinator import analyze_directory_deep_comprehensive
from livePanel_file_analysis_coordinator import analyze_file_comprehensive
from metric_language_contract import get_metric_language, get_metric_language_contract
from xr_directory_analysis_coordinator import analyze_directory_xr
from xr_field_schema import get_xr_schema
from xr_file_analysis_coordinator import analyze_file_for_xr

MANUAL_TEST_ROOT = PROJECT_ROOT / 'manual_test'
HTML_FIXTURE = MANUAL_TEST_ROOT / 'html_dom_fixture.html'
FILE_SCHEMA_FIELDS = {field['id'] for field in get_xr_schema('file')['fields']}
DIRECTORY_SCHEMA_FIELDS = {field['id'] for field in get_xr_schema('directory')['fields']}


def get_root_code_fixtures():
    return sorted(
        path for path in MANUAL_TEST_ROOT.iterdir()
        if path.is_file() and get_metric_language(str(path)) != 'Unknown'
    )


def get_deep_code_fixtures():
    deep_root = MANUAL_TEST_ROOT / 'deep'
    return sorted(
        path for path in deep_root.rglob('*')
        if path.is_file() and get_metric_language(str(path)) != 'Unknown'
    )


class ManualMetricsSuite(unittest.TestCase):
    def test_manual_test_covers_all_supported_metric_languages(self):
        fixture_languages = {get_metric_language(str(path)) for path in get_root_code_fixtures()}
        self.assertEqual(fixture_languages, set(get_metric_language_contract().keys()))

    def test_file_analysis_payload_matches_schema_and_is_shared_between_modes(self):
        for file_path in get_root_code_fixtures():
            with self.subTest(file=file_path.name):
                livepanel_payload = analyze_file_comprehensive(str(file_path))
                xr_payload = analyze_file_for_xr(str(file_path))

                self.assertEqual(livepanel_payload, xr_payload)
                self.assertIsInstance(livepanel_payload, list)
                self.assertGreater(len(livepanel_payload), 0)

                first_entry = livepanel_payload[0]
                self.assertTrue(FILE_SCHEMA_FIELDS.issubset(first_entry.keys()))
                self.assertEqual(first_entry['filePath'], normalize_path_for_babia(str(file_path)))
                self.assertGreater(first_entry['totalLines'], 0)
                self.assertGreaterEqual(first_entry['codeLines'], 0)
                self.assertGreater(first_entry['maxFunctionParameters'], 0)
                self.assertGreater(first_entry['maxFunctionNestingDepth'], 0)
                self.assertGreater(first_entry['cyclomaticComplexityNumber'], 0)

    def test_directory_payload_matches_schema_and_is_shared_between_modes(self):
        livepanel_payload = analyze_directory_comprehensive(str(MANUAL_TEST_ROOT))
        xr_payload = analyze_directory_xr(str(MANUAL_TEST_ROOT), is_deep=False)

        self.assertEqual(livepanel_payload, xr_payload)
        self.assertGreater(len(livepanel_payload), 0)

        for entry in livepanel_payload:
            self.assertTrue(DIRECTORY_SCHEMA_FIELDS.issubset(entry.keys()))

        self.assertTrue(any(entry['maxFunctionParameters'] > 0 for entry in livepanel_payload))
        self.assertTrue(any(entry['maxFunctionNestingDepth'] > 0 for entry in livepanel_payload))

    def test_deep_directory_payload_includes_nested_fixtures(self):
        shallow_payload = analyze_directory_comprehensive(str(MANUAL_TEST_ROOT))
        livepanel_payload = analyze_directory_deep_comprehensive(str(MANUAL_TEST_ROOT))
        xr_payload = analyze_directory_xr(str(MANUAL_TEST_ROOT), is_deep=True)

        self.assertEqual(livepanel_payload, xr_payload)
        self.assertGreater(len(livepanel_payload), len(shallow_payload))
        self.assertEqual(len(livepanel_payload), len(get_root_code_fixtures()) + len(get_deep_code_fixtures()))
        self.assertTrue(any('deep/' in entry['relativePath'] for entry in livepanel_payload))

    def test_dom_html_fixture_generates_prepared_stringified_output(self):
        result = extract_html_content(str(HTML_FIXTURE))
        self.assertTrue(result['preparedForVisualization'])
        self.assertIn('Manual DOM Fixture', result['htmlContent'])
        self.assertNotIn('<script', result['htmlContent'].lower())
        self.assertNotIn('<style', result['htmlContent'].lower())


if __name__ == '__main__':
    unittest.main()
