#!/usr/bin/env python3
"""
Generate manual metric reports for the manual_test corpus.
"""

import json
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
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

from html_dom_parser import extract_html_content
from livePanel_directory_analysis_coordinator import analyze_directory_comprehensive
from livePanel_directory_deep_analysis_coordinator import analyze_directory_deep_comprehensive
from livePanel_file_analysis_coordinator import analyze_file_comprehensive
from metric_language_contract import get_metric_language
from xr_directory_analysis_coordinator import analyze_directory_xr
from xr_file_analysis_coordinator import analyze_file_for_xr

MANUAL_TEST_ROOT = PROJECT_ROOT / 'manual_test'
REPORT_ROOT = PROJECT_ROOT / 'artifacts' / 'manual_test_reports'
HTML_FIXTURE = MANUAL_TEST_ROOT / 'html_dom_fixture.html'


def get_root_code_fixtures():
    return sorted(
        path for path in MANUAL_TEST_ROOT.iterdir()
        if path.is_file() and get_metric_language(str(path)) != 'Unknown'
    )


def write_json(target: Path, payload):
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, indent=2), encoding='utf-8')


def main():
    if REPORT_ROOT.exists():
        shutil.rmtree(REPORT_ROOT)
    REPORT_ROOT.mkdir(parents=True, exist_ok=True)

    root_files = get_root_code_fixtures()
    for file_path in root_files:
        fixture_dir = REPORT_ROOT / 'files' / file_path.stem
        write_json(fixture_dir / 'livepanel.json', analyze_file_comprehensive(str(file_path)))
        write_json(fixture_dir / 'xr.json', analyze_file_for_xr(str(file_path)))

    write_json(REPORT_ROOT / 'directory' / 'livepanel.json', analyze_directory_comprehensive(str(MANUAL_TEST_ROOT)))
    write_json(REPORT_ROOT / 'directory' / 'xr.json', analyze_directory_xr(str(MANUAL_TEST_ROOT), is_deep=False))
    write_json(REPORT_ROOT / 'directory_deep' / 'livepanel.json', analyze_directory_deep_comprehensive(str(MANUAL_TEST_ROOT)))
    write_json(REPORT_ROOT / 'directory_deep' / 'xr.json', analyze_directory_xr(str(MANUAL_TEST_ROOT), is_deep=True))
    write_json(REPORT_ROOT / 'dom' / 'html.json', extract_html_content(str(HTML_FIXTURE)))

    summary = {
        'rootFixtures': [path.name for path in root_files],
        'rootFixtureCount': len(root_files),
        'deepFixtureCount': len(list((MANUAL_TEST_ROOT / 'deep').rglob('*.*'))),
        'reportRoot': str(REPORT_ROOT),
    }
    write_json(REPORT_ROOT / 'summary.json', summary)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
