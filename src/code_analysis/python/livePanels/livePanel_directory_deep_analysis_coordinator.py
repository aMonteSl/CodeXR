#!/usr/bin/env python3
"""
Directory Deep Analysis Coordinator for LivePanel

This script coordinates all directory-level analyzers to generate a comprehensive
data.json structure for deep directory analysis visualization in LivePanel mode.
This includes recursive scanning of all subdirectories.

Usage: python livePanel_directory_deep_analysis_coordinator.py <directory_path>
"""

import sys
import json
import os
import subprocess
import time
from pathlib import Path

UTILS_DIR = Path(__file__).resolve().parent.parent / "utils"
if str(UTILS_DIR) not in sys.path:
    sys.path.insert(0, str(UTILS_DIR))

from babia_path_utils import normalize_output_paths

def analyze_directory_deep_comprehensive(directory_path, filtered_files=None):
    """
    Coordinate all analyzers to generate comprehensive deep directory analysis data
    This version includes recursive subdirectory scanning
    
    Args:
        directory_path (str): Path to the directory to analyze
        filtered_files (list): Optional list of pre-filtered file paths
        
    Returns:
        dict: Complete analysis data structure for deep directory visualization
    """
    print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Starting comprehensive DEEP analysis for {directory_path}"}), file=sys.stderr)
    
    if filtered_files:
        print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Using filtered file list with {len(filtered_files)} files"}), file=sys.stderr)
    
    # Get the tools directory for analyzers
    script_dir = Path(__file__).parent.parent / "tools"
    
    # Initialize result structure based on template requirements (same as regular but with deep data)
    result = {
        "directoryName": os.path.basename(directory_path),
        "directoryPath": directory_path,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "status": "success",
        
        # Summary metrics for the directory template (aggregated from all levels)
        "summary": {
            "totalFiles": 0,
            "totalFilesAnalyzed": 0,
            "totalFilesNotAnalyzed": 0,
            "totalLines": 0,
            "totalComments": 0,
            "totalBlankLines": 0,
            "totalFunctions": 0,
            "totalClasses": 0,
            "averageComplexity": 0.0,
            "analyzedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
            "languages": {},  # language -> file count
            "directoryPath": directory_path
        },
        
        # Array of file analysis data for each file in directory tree
        "files": [],
        
        # Analysis metadata
        "metadata": {
            "analysisType": "DirectoryLivePanelDeep",
            "scanDepth": "deep",  # Deep recursive analysis
            "excludedExtensions": [],
            "includedExtensions": get_analyzable_extensions()
        }
    }
    
    try:
        # Scan directory RECURSIVELY for analyzable files
        print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Scanning directory tree {directory_path} RECURSIVELY"}), file=sys.stderr)
        files_to_analyze = scan_directory_files_deep(directory_path, filtered_files)
        
        print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Found {len(files_to_analyze)} files to analyze across all subdirectories"}), file=sys.stderr)
        
        # Update summary with total files
        result["summary"]["totalFiles"] = len(files_to_analyze)
        
        # Analyze each file
        analyzed_files = 0
        not_analyzed_files = 0
        total_complexity_sum = 0
        total_functions_for_avg = 0
        
        for file_path in files_to_analyze:
            try:
                print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Analyzing file {file_path}"}), file=sys.stderr)
                file_analysis = analyze_single_file(file_path, script_dir)
                
                if file_analysis and file_analysis.get("status") == "success":
                    # Set relative path from the base directory for deep analysis
                    relative_path = os.path.relpath(file_path, directory_path)
                    file_analysis["relativePath"] = relative_path
                    
                    result["files"].append(file_analysis)
                    analyzed_files += 1
                    
                    # Add to summary metrics using enhanced data
                    result["summary"]["totalLines"] += file_analysis.get("totalLines", 0)
                    result["summary"]["totalComments"] += file_analysis.get("commentLines", 0)
                    result["summary"]["totalBlankLines"] += file_analysis.get("blankLines", 0)
                    result["summary"]["totalFunctions"] += file_analysis.get("functionCount", 0)
                    result["summary"]["totalClasses"] += file_analysis.get("classCount", 0)
                    
                    # Accumulate complexity for directory average
                    file_complexity = file_analysis.get("cyclomaticComplexityNumber", 0)
                    file_function_count = file_analysis.get("functionCount", 0)
                    if file_function_count > 0:
                        total_complexity_sum += file_complexity * file_function_count
                        total_functions_for_avg += file_function_count
                    
                    # Add language to summary
                    language = file_analysis.get("language", "unknown")
                    result["summary"]["languages"][language] = result["summary"]["languages"].get(language, 0) + 1
                    
                else:
                    not_analyzed_files += 1
                    print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Failed to analyze {file_path}"}), file=sys.stderr)
                    
            except Exception as e:
                not_analyzed_files += 1
                print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Error analyzing {file_path}: {str(e)}"}), file=sys.stderr)
        
        # Update summary with analysis counts
        result["summary"]["totalFilesAnalyzed"] = analyzed_files
        result["summary"]["totalFilesNotAnalyzed"] = result["summary"]["totalFiles"] - analyzed_files
        
        # Calculate directory-wide average complexity
        if total_functions_for_avg > 0:
            result["summary"]["averageComplexity"] = total_complexity_sum / total_functions_for_avg
        else:
            result["summary"]["averageComplexity"] = 0.0
        
        print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Completed DEEP analysis. Files: {analyzed_files} analyzed, {not_analyzed_files} failed across all subdirectories"}), file=sys.stderr)
        
        return normalize_output_paths(result)
        
    except Exception as e:
        print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Critical error: {str(e)}"}), file=sys.stderr)
        result["status"] = "error"
        result["error"] = str(e)
        return normalize_output_paths(result)

def scan_directory_files_deep(directory_path, filtered_files=None):
    """
    Scan directory RECURSIVELY for analyzable files (all levels for Deep LivePanel)
    
    Args:
        directory_path (str): Directory to scan
        filtered_files (list): Optional list of pre-filtered file paths
        
    Returns:
        list: List of file paths to analyze from all subdirectories
    """
    if filtered_files:
        # Use filtered files list instead of scanning directory
        print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Using filtered file list with {len(filtered_files)} files"}), file=sys.stderr)
        
        # Validate that filtered files exist and are analyzable
        analyzable_files = []
        analyzable_extensions = get_analyzable_extensions()
        
        for file_path in filtered_files:
            if os.path.isfile(file_path):
                file_ext = os.path.splitext(file_path)[1].lower()
                if file_ext in analyzable_extensions:
                    analyzable_files.append(file_path)
                    print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Including filtered file: {os.path.basename(file_path)}"}), file=sys.stderr)
                else:
                    print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Skipping non-analyzable filtered file: {os.path.basename(file_path)} (ext: {file_ext})"}), file=sys.stderr)
            else:
                print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Skipping non-existent filtered file: {file_path}"}), file=sys.stderr)
        
        return sorted(analyzable_files)
    
    # Fallback to original recursive directory scanning
    analyzable_files = []
    analyzable_extensions = get_analyzable_extensions()
    
    # Directories to skip for better performance on large projects
    skip_dirs = {
        'node_modules', '.git', '.svn', '.hg', '.bzr', 
        'build', 'dist', 'out', 'target', 'bin', 'obj',
        '.vscode', '.idea', '.eclipse', '.settings',
        '__pycache__', '.pytest_cache', '.mypy_cache',
        'coverage', '.coverage', '.nyc_output',
        'temp', 'tmp', '.tmp', 'logs', 'log'
    }
    
    try:
        # Walk through all directories recursively
        for root, dirs, files in os.walk(directory_path):
            # Filter out directories we should skip in-place to avoid traversing them
            dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith('.')]
            
            # Limit the number of files per directory to prevent overwhelming performance
            if len(files) > 1000:
                print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Large directory detected ({len(files)} files) in {root}, limiting to first 1000 files"}), file=sys.stderr)
                files = files[:1000]
            
            for file_name in files:
                # Skip hidden files
                if file_name.startswith('.'):
                    continue
                    
                # Check if file has analyzable extension
                file_ext = os.path.splitext(file_name)[1].lower()
                if file_ext in analyzable_extensions:
                    full_path = os.path.join(root, file_name)
                    analyzable_files.append(full_path)
                    
                # Limit total files to prevent memory issues with extremely large projects
                if len(analyzable_files) > 10000:
                    print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Reached maximum file limit (10000) for performance, stopping scan"}), file=sys.stderr)
                    break
            
            # Break outer loop if we hit the limit
            if len(analyzable_files) > 10000:
                break
    
    except Exception as e:
        print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Error scanning directory tree: {str(e)}"}), file=sys.stderr)
    
    print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Found {len(analyzable_files)} analyzable files in deep scan"}), file=sys.stderr)
    return sorted(analyzable_files)

def analyze_single_file(file_path, script_dir):
    """
    Analyze a single file using the existing file analysis coordinator
    
    Args:
        file_path (str): Path to file to analyze
        script_dir (Path): Path to script directory
        
    Returns:
        dict: File analysis data with detailed metrics or None if failed
    """
    try:
        # Use the existing livePanel_file_analysis_coordinator.py to analyze the file
        coordinator_path = script_dir.parent / "livePanels" / "livePanel_file_analysis_coordinator.py"
        
        if not coordinator_path.exists():
            print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: File coordinator not found: {coordinator_path}"}), file=sys.stderr)
            return None
        
        # Execute the file analysis coordinator
        result = subprocess.run(
            [sys.executable, str(coordinator_path), file_path],
            capture_output=True,
            text=True,
            timeout=30  # 30 second timeout per file
        )
        
        if result.returncode == 0 and result.stdout.strip():
            try:
                # Parse the JSON output from the file coordinator
                file_analysis = json.loads(result.stdout.strip())
                
                # Ensure we have the detailed metrics we need for directory analysis
                if file_analysis and file_analysis.get("status") == "success":
                    # Enhance the file data with additional calculated metrics
                    enhanced_file_data = enhance_file_metrics(file_analysis, file_path)
                    return enhanced_file_data
                else:
                    print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: File analysis returned non-success status for {file_path}"}), file=sys.stderr)
                    return None
                    
            except json.JSONDecodeError as e:
                print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: JSON decode error for {file_path}: {str(e)}"}), file=sys.stderr)
                return None
        else:
            print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: File analysis failed for {file_path}. Return code: {result.returncode}"}), file=sys.stderr)
            if result.stderr:
                print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Error output: {result.stderr}"}), file=sys.stderr)
            return None
    
    except subprocess.TimeoutExpired:
        print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Timeout analyzing {file_path}"}), file=sys.stderr)
        return None
    except Exception as e:
        print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Exception analyzing {file_path}: {str(e)}"}), file=sys.stderr)
        return None

def enhance_file_metrics(file_analysis, file_path):
    """
    Enhance file analysis data with additional calculated metrics for directory view
    Same logic as the regular directory analysis but for deep analysis
    
    Args:
        file_analysis (dict): Original file analysis data
        file_path (str): Path to the analyzed file
        
    Returns:
        dict: Enhanced file analysis data with directory-specific metrics
    """
    try:
        # Base file information
        enhanced = {
            "fileName": os.path.basename(file_path),
            "filePath": file_path,
            "relativePath": file_analysis.get("fileName", os.path.basename(file_path)),  # Will be updated by caller
            "language": file_analysis.get("language", get_language_from_extension(file_path)),
            "status": file_analysis.get("status", "success"),
            
            # Line metrics
            "totalLines": file_analysis.get("totalLines", 0),
            "codeLines": file_analysis.get("codeLines", 0),
            "commentLines": file_analysis.get("commentLines", 0),
            "blankLines": file_analysis.get("blankLines", 0),
            
            # Structure metrics
            "classCount": file_analysis.get("classCount", 0),
            "functionCount": file_analysis.get("functionCount", 0),
            
            # Complexity metrics
            "maxComplexity": 0,
            "cyclomaticComplexityNumber": 0.0,  # CCN media del archivo
            "cyclomaticComplexityDensity": 0.0,  # CCN density del archivo
            
            # Function metrics
            "averageFunctionParameters": 0.0,
            "maxFunctionParameters": 0,
            
            # File size (template expects fileSizeBytes)
            "fileSizeBytes": 0
        }
        
        # Calculate file size
        try:
            enhanced["fileSizeBytes"] = os.path.getsize(file_path)
        except:
            enhanced["fileSizeBytes"] = 0
        
        # Extract complexity metrics from analysis
        complexity_data = file_analysis.get("complexity", {})
        if complexity_data:
            enhanced["maxComplexity"] = complexity_data.get("maxComplexity", 0)
            enhanced["cyclomaticComplexityNumber"] = complexity_data.get("averageComplexity", 0.0)  # CCN media
            
            # Calculate CCN density (CCN / Lines of Code)
            code_lines = enhanced["codeLines"]
            if code_lines > 0 and enhanced["cyclomaticComplexityNumber"] > 0:
                enhanced["cyclomaticComplexityDensity"] = enhanced["cyclomaticComplexityNumber"] / code_lines
            else:
                enhanced["cyclomaticComplexityDensity"] = 0.0
        
        # Calculate function parameter metrics from functions array (but don't include functions in output)
        functions = file_analysis.get("functions", [])
        if functions:
            parameter_counts = []
            total_complexity = 0
            max_complexity = 0
            
            for func in functions:
                # Parameters
                param_count = func.get("parameterCount", 0)
                parameter_counts.append(param_count)
                
                # Complexity
                func_complexity = func.get("complexity", 0)
                total_complexity += func_complexity
                max_complexity = max(max_complexity, func_complexity)
            
            # Average function parameters
            if parameter_counts:
                enhanced["averageFunctionParameters"] = sum(parameter_counts) / len(parameter_counts)
                enhanced["maxFunctionParameters"] = max(parameter_counts)
            
            # Update complexity metrics with function-level data
            if functions:
                enhanced["maxComplexity"] = max_complexity
                enhanced["cyclomaticComplexityNumber"] = total_complexity / len(functions) if len(functions) > 0 else 0
                
                # Recalculate CCN density with updated CCN
                if enhanced["codeLines"] > 0:
                    enhanced["cyclomaticComplexityDensity"] = enhanced["cyclomaticComplexityNumber"] / enhanced["codeLines"]
        
        print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Enhanced metrics for {file_path} - CCN: {enhanced['cyclomaticComplexityNumber']:.2f}, Density: {enhanced['cyclomaticComplexityDensity']:.4f}, Functions: {enhanced['functionCount']}, Classes: {enhanced['classCount']}"}), file=sys.stderr)
        
        return enhanced
        
    except Exception as e:
        print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Error enhancing metrics for {file_path}: {str(e)}"}), file=sys.stderr)
        # Return original data if enhancement fails
        return file_analysis

def get_analyzable_extensions():
    """
    Get list of file extensions that can be analyzed
    
    Returns:
        list: List of file extensions (with dots)
    """
    return [
        # Programming Languages - CodeXR Supported
        '.py', '.pyw', '.pyi',  # Python
        '.rb', '.rbw',  # Ruby
        '.java',  # Java
        '.c', '.h',  # C
        '.cpp', '.cxx', '.cc', '.hpp', '.hxx',  # C++
        '.cs',  # C#
        '.erl', '.hrl',  # Erlang
        '.f90', '.f95', '.f03', '.f08', '.f',  # Fortran
        '.gd',  # GDScript
        '.go',  # Go
        '.js', '.mjs', '.cjs',  # JavaScript
        '.kt', '.kts',  # Kotlin
        '.lua',  # Lua
        '.m', '.mm',  # Objective-C
        '.php', '.phtml', '.php3', '.php4', '.php5',  # PHP
        '.pl', '.pm',  # Perl
        '.scala', '.sc',  # Scala
        '.sol',  # Solidity
        '.swift',  # Swift
        '.ts', '.tsx',  # TypeScript
        '.ttcn', '.ttcn3',  # TTCN-3
        '.vue',  # Vue
        '.zig',  # Zig
        # Additional commonly analyzed languages
        '.rs',  # Rust
        '.dart',  # Dart
        '.r',  # R
        '.sh', '.bash',  # Shell
        '.ps1',  # PowerShell
        '.jsx',  # JavaScript (JSX)
        '.css', '.scss', '.less',  # CSS and preprocessors
        '.clj', '.cljs',  # Clojure
        '.hs',  # Haskell
        '.ml', '.mli',  # OCaml
        '.pas'  # Pascal
    ]

def get_language_from_extension(file_path):
    """
    Determine programming language from file extension
    
    Args:
        file_path (str): Path to the file
        
    Returns:
        str: Programming language name
    """
    ext = os.path.splitext(file_path)[1].lower()
    
    language_map = {
        # Programming Languages - CodeXR Supported
        '.py': 'Python', '.pyw': 'Python', '.pyi': 'Python',
        '.rb': 'Ruby', '.rbw': 'Ruby',
        '.java': 'Java',
        '.c': 'C', '.h': 'C',
        '.cpp': 'C++', '.cxx': 'C++', '.cc': 'C++', '.hpp': 'C++', '.hxx': 'C++',
        '.cs': 'C#',
        '.erl': 'Erlang', '.hrl': 'Erlang',
        '.f90': 'Fortran', '.f95': 'Fortran', '.f03': 'Fortran', '.f08': 'Fortran', '.f': 'Fortran',
        '.gd': 'GDScript',
        '.go': 'Go',
        '.js': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
        '.kt': 'Kotlin', '.kts': 'Kotlin',
        '.lua': 'Lua',
        '.m': 'Objective-C', '.mm': 'Objective-C',
        '.php': 'PHP', '.phtml': 'PHP', '.php3': 'PHP', '.php4': 'PHP', '.php5': 'PHP',
        '.pl': 'Perl', '.pm': 'Perl',
        '.scala': 'Scala', '.sc': 'Scala',
        '.sol': 'Solidity',
        '.swift': 'Swift',
        '.ts': 'TypeScript', '.tsx': 'TypeScript',
        '.ttcn': 'TTCN-3', '.ttcn3': 'TTCN-3',
        '.vue': 'Vue',
        '.zig': 'Zig',
        '.rs': 'Rust',
        '.dart': 'Dart',
        '.r': 'R',
        '.sh': 'Shell', '.bash': 'Shell',
        '.ps1': 'PowerShell',
        '.jsx': 'JavaScript (JSX)',
        '.css': 'CSS', '.scss': 'SCSS', '.less': 'LESS',
        '.clj': 'Clojure', '.cljs': 'Clojure',
        '.hs': 'Haskell',
        '.ml': 'OCaml', '.mli': 'OCaml',
        '.pas': 'Pascal'
    }
    
    return language_map.get(ext, 'Unknown')

def main(filtered_files=None):
    """Main entry point"""
    if len(sys.argv) != 2:
        error_msg = "Usage: python livePanel_directory_deep_analysis_coordinator.py <directory_path>"
        print(json.dumps({"error": error_msg}))
        sys.exit(1)
    
    directory_path = sys.argv[1]
    
    # Validate directory exists
    if not os.path.exists(directory_path):
        error_msg = f"Directory not found: {directory_path}"
        print(json.dumps({"error": error_msg}))
        sys.exit(1)
    
    if not os.path.isdir(directory_path):
        error_msg = f"Path is not a directory: {directory_path}"
        print(json.dumps({"error": error_msg}))
        sys.exit(1)
    
    if filtered_files:
        print(json.dumps({"debug": f"DIRECTORY_DEEP_ANALYSIS: Received {len(filtered_files)} filtered files"}), file=sys.stderr)
    
    try:
        # Perform comprehensive DEEP directory analysis
        analysis_result = analyze_directory_deep_comprehensive(directory_path, filtered_files)
        
        # Output the complete analysis as JSON
        print(json.dumps(analysis_result, indent=2))
        
    except Exception as e:
        error_msg = f"Deep analysis failed: {str(e)}"
        print(json.dumps({"error": error_msg}))
        sys.exit(1)

if __name__ == "__main__":
    main()




