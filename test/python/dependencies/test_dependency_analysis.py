import sys
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[3]
UTILS = ROOT / "src" / "code_analysis" / "python" / "utils"
if str(UTILS) not in sys.path:
    sys.path.insert(0, str(UTILS))

import dependency_analysis_engine
from dependency_analysis_engine import analyze_dependencies, analyze_file_dependencies
from metric_language_contract import get_metric_language_names


class DependencyAnalysisTests(unittest.TestCase):
    def setUp(self):
        self.fixture = ROOT / "test" / "fixtures" / "dependency-languages"

    def test_fixture_covers_every_metric_language(self):
        result = analyze_dependencies(str(self.fixture), recursive=True)
        languages = {
            node.get("language")
            for node in result["nodes"]
            if node.get("kind") == "file"
        }
        self.assertEqual(set(get_metric_language_names()), languages)

    def test_dataset_has_resolved_and_external_relations(self):
        result = analyze_dependencies(str(self.fixture), recursive=True)
        node_ids = {node["id"] for node in result["nodes"]}
        self.assertTrue(result["edges"])
        self.assertTrue(all(edge["source"] in node_ids for edge in result["edges"]))
        self.assertTrue(all(edge["target"] in node_ids for edge in result["edges"]))
        self.assertTrue(any(not node["external"] for node in result["nodes"]))
        self.assertTrue(any(node["external"] for node in result["nodes"]))

    def test_metrics_and_capabilities_are_explicit(self):
        result = analyze_dependencies(str(self.fixture), recursive=True)
        self.assertEqual(set(get_metric_language_names()), set(result["capabilities"]))
        for node in result["nodes"]:
            self.assertIn("fanIn", node["metrics"])
            self.assertIn("fanOut", node["metrics"])
            self.assertIn("cycleSize", node["metrics"])
        for language in result["capabilities"].values():
            self.assertEqual(
                {"import", "include", "require", "inheritance", "implementation", "call", "contains"},
                set(language),
            )

    def test_file_dependencies_include_symbols_containment_and_calls(self):
        with tempfile.TemporaryDirectory() as temporary:
            project = Path(temporary)
            target = project / "sample.py"
            target.write_text(
                "class Worker:\n"
                "    def run(self):\n"
                "        return helper()\n\n"
                "def helper():\n"
                "    return 1\n",
                encoding="utf-8",
            )
            result = analyze_file_dependencies(str(target), project_root=str(project))
            symbol_kinds = {
                node.get("symbolKind")
                for node in result["nodes"]
                if node.get("kind") == "symbol"
            }
            self.assertTrue(
                {"module", "class", "method", "function"}.issubset(symbol_kinds),
                f"Unexpected symbol kinds: {sorted(str(kind) for kind in symbol_kinds)}",
            )
            self.assertTrue(any(edge["kind"] == "contains" for edge in result["edges"]))
            self.assertTrue(any(edge["kind"] == "call" for edge in result["edges"]))
            self.assertFalse(any(node.get("label") == "def" for node in result["nodes"]))

    def test_private_cache_is_hash_based_and_drops_stale_entries(self):
        with tempfile.TemporaryDirectory() as temporary:
            cache_path = Path(temporary) / "dependency-cache.json"
            first = analyze_dependencies(
                str(self.fixture),
                recursive=True,
                cache_path=str(cache_path),
            )
            first_cache = json.loads(cache_path.read_text(encoding="utf-8"))
            second = analyze_dependencies(
                str(self.fixture),
                recursive=True,
                cache_path=str(cache_path),
            )
            second_cache = json.loads(cache_path.read_text(encoding="utf-8"))
            self.assertEqual(first["edges"], second["edges"])
            self.assertEqual(first_cache, second_cache)
            self.assertTrue(all(entry["hash"] for entry in second_cache["files"].values()))

    def test_incremental_refresh_reads_only_added_or_changed_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            project = Path(temporary) / "project"
            project.mkdir()
            changed = project / "changed.py"
            unchanged = project / "unchanged.py"
            removed = project / "removed.py"
            changed.write_text("import unchanged\n", encoding="utf-8")
            unchanged.write_text("VALUE = 1\n", encoding="utf-8")
            removed.write_text("VALUE = 2\n", encoding="utf-8")
            cache_path = Path(temporary) / "dependency-cache.json"
            request_path = Path(temporary) / "refresh.json"
            analyze_dependencies(str(project), recursive=True, cache_path=str(cache_path))

            changed.write_text("import added\n", encoding="utf-8")
            added = project / "added.py"
            added.write_text("VALUE = 3\n", encoding="utf-8")
            removed.unlink()
            request_path.write_text(json.dumps({
                "sourceRevision": 2,
                "forceFullScan": False,
                "changedFiles": [str(changed)],
                "addedFiles": [str(added)],
                "removedFiles": [str(removed)],
            }), encoding="utf-8")

            original_read = dependency_analysis_engine._read_text
            with mock.patch.object(
                dependency_analysis_engine,
                "_read_text",
                wraps=original_read,
            ) as read_text:
                result = analyze_dependencies(
                    str(project),
                    recursive=True,
                    cache_path=str(cache_path),
                    refresh_request_path=str(request_path),
                )

            read_paths = {Path(call.args[0]).name for call in read_text.call_args_list}
            self.assertEqual({"changed.py", "added.py"}, read_paths)
            relative_paths = {
                node.get("relativePath")
                for node in result["nodes"]
                if node.get("kind") == "file"
            }
            self.assertEqual({"changed.py", "unchanged.py", "added.py"}, relative_paths)


if __name__ == "__main__":
    unittest.main()
