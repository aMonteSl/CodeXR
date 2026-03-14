import json
import subprocess
import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
PYTHON_ROOT = PROJECT_ROOT / 'src' / 'code_analysis' / 'python'
HTML_PARSER = PYTHON_ROOT / 'html' / 'html_dom_parser.py'
DOM_TEMPLATE = PROJECT_ROOT / 'templates' / 'xr' / 'html' / 'dom-visualization-template.html'

FIXTURES = {
    'basic': PROJECT_ROOT / 'manual_test' / 'html_dom_fixture.html',
    'advanced': PROJECT_ROOT / 'manual_test' / 'html_dom_advanced_analysis.html',
}

for extra_path in [PYTHON_ROOT, PYTHON_ROOT / 'utils', PYTHON_ROOT / 'html']:
    if str(extra_path) not in sys.path:
        sys.path.insert(0, str(extra_path))

from html_dom_parser import extract_html_content


def normalize_fixture_content(file_path: Path) -> str:
    return file_path.read_text(encoding='utf-8').replace('\r\n', '\n').replace('\r', '\n').strip()


def render_index_html(html_content: str, fixture_path: Path) -> str:
    template = DOM_TEMPLATE.read_text(encoding='utf-8')
    variables = {
        'TITLE': f'DOM Visualization - {fixture_path.name}',
        'FILE_NAME': fixture_path.name,
        'FILE_PATH': str(fixture_path),
        'HTML_CONTENT': '',
        'HTML_CONTENT_JSON': json.dumps(html_content).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026'),
        'BACKGROUND_COLOR': '#87CEEB',
        'ENVIRONMENT_PRESET': 'forest',
        'GROUND_COLOR': '#7BC8A4',
        'PALETTE': 'categorical',
        'nonce': 'test-nonce',
        'scriptUri': './main.js',
    }

    rendered = template
    for key, value in variables.items():
        rendered = rendered.replace(f'${{{key}}}', value)
    return rendered


class HTMLDomProtocolTests(unittest.TestCase):
    def parse_cli_output(self, fixture_path: Path):
        completed = subprocess.run(
            [sys.executable, str(HTML_PARSER), str(fixture_path)],
            capture_output=True,
            text=True,
            check=False,
            cwd=str(PYTHON_ROOT / 'html'),
        )

        self.assertEqual(completed.returncode, 0, msg=completed.stderr)
        self.assertIn('=== JSON_START ===', completed.stdout)
        self.assertIn('=== JSON_END ===', completed.stdout)

        json_block = completed.stdout.split('=== JSON_START ===', 1)[1].split('=== JSON_END ===', 1)[0].strip()
        return json.loads(json_block)

    def test_basic_fixture_preserves_full_original_document(self):
        result = extract_html_content(str(FIXTURES['basic']))
        expected = normalize_fixture_content(FIXTURES['basic'])

        self.assertTrue(result['preparedForVisualization'])
        self.assertEqual(result['htmlContent'], expected)
        self.assertIn('<!DOCTYPE html>', result['htmlContent'])
        self.assertIn('<html>', result['htmlContent'])
        self.assertIn('<head>', result['htmlContent'])
        self.assertIn('<body>', result['htmlContent'])
        self.assertIn('<style>', result['htmlContent'])
        self.assertIn('<script>', result['htmlContent'])
        self.assertIn('console.log(\'should be removed\');', result['htmlContent'])

    def test_advanced_fixture_preserves_full_original_document(self):
        result = extract_html_content(str(FIXTURES['advanced']))
        expected = normalize_fixture_content(FIXTURES['advanced'])

        self.assertTrue(result['preparedForVisualization'])
        self.assertEqual(result['htmlContent'], expected)
        self.assertIn('<!DOCTYPE html>', result['htmlContent'])
        self.assertIn('<html>', result['htmlContent'])
        self.assertIn('<head>', result['htmlContent'])
        self.assertIn('<body>', result['htmlContent'])
        self.assertIn('<style>', result['htmlContent'])
        self.assertIn('<script>', result['htmlContent'])
        self.assertIn('window.shouldDisappear = true;', result['htmlContent'])
        self.assertIn('Nested DOM fixture for advanced visualization checks.', result['htmlContent'])

    def test_html_dom_parser_cli_emits_parseable_payload_for_both_dom_fixtures(self):
        for fixture_name, fixture_path in FIXTURES.items():
            with self.subTest(fixture=fixture_name):
                parsed = self.parse_cli_output(fixture_path)
                expected = normalize_fixture_content(fixture_path)
                self.assertTrue(parsed['preparedForVisualization'])
                self.assertFalse(parsed.get('error'))
                self.assertEqual(parsed['htmlContent'], expected)
                self.assertIn('<!DOCTYPE html>', parsed['htmlContent'])
                self.assertIn('<html>', parsed['htmlContent'])

    def test_generated_index_for_basic_fixture_uses_json_payload_and_runtime_mount_contract(self):
        result = extract_html_content(str(FIXTURES['basic']))
        generated_index = render_index_html(result['htmlContent'], FIXTURES['basic'])

        self.assertIn('babia-html="renderHTML: true; renderHTMLOnlyLeafs: true; distanceLevels: 0.7"', generated_index)
        self.assertIn('window.__CODEXR_DOM_HTML_PAYLOAD__ =', generated_index)
        self.assertIn('html2canvas.min.js', generated_index)
        self.assertNotIn('data.json', generated_index)
        self.assertNotIn('${HTML_CONTENT}', generated_index)
        self.assertIn('applyBabiaHtml(0.7, window.__CODEXR_DOM_HTML_PAYLOAD__);', generated_index)
        self.assertIn('\\u003c!DOCTYPE html\\u003e', generated_index)
        self.assertIn('Manual DOM Fixture', generated_index)
        self.assertIn('DOM visualization smoke test.', generated_index)
        self.assertIn('should be removed', generated_index)

    def test_generated_index_for_advanced_fixture_uses_json_payload_and_runtime_mount_contract(self):
        result = extract_html_content(str(FIXTURES['advanced']))
        generated_index = render_index_html(result['htmlContent'], FIXTURES['advanced'])

        self.assertIn('babia-html="renderHTML: true; renderHTMLOnlyLeafs: true; distanceLevels: 0.7"', generated_index)
        self.assertIn('window.__CODEXR_DOM_HTML_PAYLOAD__ =', generated_index)
        self.assertIn('html2canvas.min.js', generated_index)
        self.assertNotIn('data.json', generated_index)
        self.assertNotIn('${HTML_CONTENT}', generated_index)
        self.assertIn('applyBabiaHtml(0.7, window.__CODEXR_DOM_HTML_PAYLOAD__);', generated_index)
        self.assertIn('\\u003c!DOCTYPE html\\u003e', generated_index)
        self.assertIn('Advanced DOM Fixture', generated_index)
        self.assertIn('Analytics Hub', generated_index)
        self.assertIn('Generated for CodeXR DOM tests.', generated_index)
        self.assertIn('window.shouldDisappear = true;', generated_index)


if __name__ == '__main__':
    unittest.main()
