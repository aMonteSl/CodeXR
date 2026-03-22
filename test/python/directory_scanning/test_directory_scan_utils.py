import importlib.util
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SCAN_UTILS_PATH = PROJECT_ROOT / 'src' / 'code_analysis' / 'python' / 'utils' / 'directory_scan_utils.py'

scan_spec = importlib.util.spec_from_file_location('directory_scan_utils', SCAN_UTILS_PATH)
scan_module = importlib.util.module_from_spec(scan_spec)
scan_spec.loader.exec_module(scan_module)

filter_explicit_files_for_analysis = scan_module.filter_explicit_files_for_analysis
scan_directory_files_for_analysis = scan_module.scan_directory_files_for_analysis


class DirectoryScanUtilsTests(unittest.TestCase):
    def test_recursive_scan_prunes_ignored_and_hidden_directories(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / 'src').mkdir()
            (root / 'src' / 'feature.ts').write_text('export const feature = true\n', encoding='utf-8')
            (root / 'main.py').write_text('print("ok")\n', encoding='utf-8')

            (root / '.git').mkdir()
            (root / '.git' / 'config.js').write_text('ignored\n', encoding='utf-8')
            (root / 'node_modules').mkdir()
            (root / 'node_modules' / 'index.js').write_text('ignored\n', encoding='utf-8')
            (root / 'build').mkdir()
            (root / 'build' / 'bundle.ts').write_text('ignored\n', encoding='utf-8')
            (root / '.hidden').mkdir()
            (root / '.hidden' / 'secret.py').write_text('ignored\n', encoding='utf-8')

            result = scan_directory_files_for_analysis(temp_dir, recursive=True, max_total_files=50)
            relative_paths = {Path(file_path).relative_to(root).as_posix() for file_path in result}

            self.assertEqual(relative_paths, {'main.py', 'src/feature.ts'})

    def test_single_level_scan_only_returns_top_level_analyzable_files(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / 'index.ts').write_text('export const value = 1\n', encoding='utf-8')
            (root / 'README.md').write_text('# ignored\n', encoding='utf-8')
            (root / '.env').write_text('SECRET=yes\n', encoding='utf-8')
            (root / 'nested').mkdir()
            (root / 'nested' / 'feature.ts').write_text('export const nested = true\n', encoding='utf-8')

            result = scan_directory_files_for_analysis(temp_dir, recursive=False)
            relative_paths = [Path(file_path).relative_to(root).as_posix() for file_path in result]

            self.assertEqual(relative_paths, ['index.ts'])

    def test_explicit_file_filter_keeps_only_existing_analyzable_files(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            valid = root / 'module.ts'
            valid.write_text('export const value = 1\n', encoding='utf-8')
            hidden = root / '.secret.py'
            hidden.write_text('print("ignored")\n', encoding='utf-8')
            invalid = root / 'notes.md'
            invalid.write_text('ignored\n', encoding='utf-8')
            missing = root / 'missing.py'

            result = filter_explicit_files_for_analysis([
                str(valid),
                str(hidden),
                str(invalid),
                str(missing),
            ])

            self.assertEqual(result, [str(valid)])


if __name__ == '__main__':
    unittest.main()
