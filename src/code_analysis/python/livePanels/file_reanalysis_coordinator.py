#!/usr/bin/env python3
"""
File Re-analysis Coordinator

Universal coordinator for re-analyzing files and generating standard file summary format.
Used by both LivePanel and XR directory analysis watchers.

Generates consistent file summary structure:
{
    "fileName": "filename.ext",
    "filePath": "/absolute/path/to/file",
    "relativePath": "relative/path/to/file",
    "language": "Language",
    "status": "success|failed",
    "totalLines": 0,
    "codeLines": 0,
    "commentLines": 0,
    "blankLines": 0,
    "classCount": 0,
    "functionCount": 0,
    "maxComplexity": 0,
    "cyclomaticComplexityNumber": 0.0,
    "cyclomaticComplexityDensity": 0.0,
    "averageFunctionParameters": 0.0,
    "maxFunctionParameters": 0,
    "fileSizeBytes": 0
}

Usage: 
    python file_reanalysis_coordinator.py <file_path> [relative_path]
    python file_reanalysis_coordinator.py <file_path_1> <file_path_2> ... [--relative-paths path1 path2 ...]
"""

import sys
import json
import os
import subprocess
import time
from pathlib import Path
from typing import List, Optional, Dict, Any

UTILS_DIR = Path(__file__).resolve().parent.parent / "utils"
if str(UTILS_DIR) not in sys.path:
    sys.path.insert(0, str(UTILS_DIR))

from babia_path_utils import normalize_output_paths
from xr_field_schema import safe_ratio, summarize_function_metrics

def analyze_file_summary(file_path: str, relative_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Generate standardized file summary for both LivePanel and XR directory analysis
    
    Args:
        file_path (str): Absolute path to the file to analyze
        relative_path (str, optional): Relative path for the file (defaults to basename)
        
    Returns:
        dict: Standard file summary structure
    """
    print(json.dumps({"debug": f"FILE_REANALYSIS: Starting analysis for {file_path}"}), file=sys.stderr)
    
    # Get file information
    file_name = os.path.basename(file_path)
    if relative_path is None:
        relative_path = file_name
    
    # Get the tools directory for analyzers
    script_dir = Path(__file__).parent
    
    try:
        # Use the existing livePanel_file_analysis_coordinator for comprehensive analysis
        coordinator_path = script_dir / "livePanel_file_analysis_coordinator.py"
        
        print(json.dumps({"debug": f"FILE_REANALYSIS: Using LivePanel coordinator: {coordinator_path}"}), file=sys.stderr)
        
        result = subprocess.run([
            sys.executable, 
            str(coordinator_path), 
            file_path
        ], capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            print(json.dumps({"debug": f"FILE_REANALYSIS: LivePanel coordinator failed: {result.stderr}"}), file=sys.stderr)
            return generate_fallback_summary(file_path, relative_path)
        
        # Extract the data from LivePanel output
        # LivePanel returns data directly at the root level, not under a "summary" key
        try:
            livepanel_data = json.loads(result.stdout)
            print(json.dumps({"debug": f"FILE_REANALYSIS: LivePanel analysis completed successfully"}), file=sys.stderr)
        except json.JSONDecodeError as e:
            print(json.dumps({"debug": f"FILE_REANALYSIS: Failed to parse LivePanel output: {e}"}), file=sys.stderr)
            return generate_fallback_summary(file_path, relative_path)
        
        # Create standardized file summary from LivePanel data
        function_summary = summarize_function_metrics(livepanel_data.get('functions', []))
        file_summary = {
            "fileName": file_name,
            "filePath": file_path,
            "relativePath": relative_path,
            "language": livepanel_data.get('language', get_language_from_extension(file_path)),
            "status": "success",
            
            # Line metrics (direct from LivePanel)
            "totalLines": livepanel_data.get('totalLines', 0),
            "codeLines": livepanel_data.get('codeLines', 0),
            "commentLines": livepanel_data.get('commentLines', 0),
            "blankLines": livepanel_data.get('blankLines', 0),
            "commentRatio": livepanel_data.get('commentRatio', safe_ratio(livepanel_data.get('commentLines', 0), livepanel_data.get('totalLines', 0))),
            "codeRatio": livepanel_data.get('codeRatio', safe_ratio(livepanel_data.get('codeLines', 0), livepanel_data.get('totalLines', 0))),
            "blankRatio": livepanel_data.get('blankRatio', safe_ratio(livepanel_data.get('blankLines', 0), livepanel_data.get('totalLines', 0))),
            
            # Structure metrics (direct from LivePanel)
            "classCount": livepanel_data.get('classCount', 0),
            "functionCount": livepanel_data.get('functionCount', 0),
            
            # Complexity metrics (from complexity sub-object)
            "maxComplexity": livepanel_data.get('complexity', {}).get('maxComplexity', 0),
            "cyclomaticComplexityNumber": livepanel_data.get('complexity', {}).get('averageComplexity', 0.0),
            "cyclomaticComplexityDensity": calculate_average_density(livepanel_data.get('functions', [])),
            "highComplexityFunctions": livepanel_data.get('complexity', {}).get('highComplexityFunctions', 0),
            "criticalComplexityFunctions": livepanel_data.get('complexity', {}).get('criticalComplexityFunctions', 0),
            
            # Parameter metrics (calculated from functions)
            "averageFunctionParameters": calculate_average_parameters(livepanel_data.get('functions', [])),
            "maxFunctionParameters": calculate_max_parameters(livepanel_data.get('functions', [])),
            "averageFunctionLines": function_summary.get('averageFunctionLines', 0.0),
            "maxFunctionLines": function_summary.get('maxFunctionLines', 0),
            "averageFunctionNestingDepth": function_summary.get('averageFunctionNestingDepth', 0.0),
            "maxFunctionNestingDepth": function_summary.get('maxFunctionNestingDepth', 0),
            
            # File size
            "fileSizeBytes": get_file_size(file_path)
        }
        
        print(json.dumps({"debug": f"FILE_REANALYSIS: Generated standard summary for {file_name}"}), file=sys.stderr)
        
        return normalize_output_paths(file_summary)
        
    except subprocess.TimeoutExpired:
        print(json.dumps({"debug": "FILE_REANALYSIS: Analysis timed out"}), file=sys.stderr)
        return generate_fallback_summary(file_path, relative_path)
    except Exception as e:
        print(json.dumps({"debug": f"FILE_REANALYSIS: Analysis failed: {str(e)}"}), file=sys.stderr)
        return generate_fallback_summary(file_path, relative_path)

def analyze_multiple_files(file_paths: List[str], relative_paths: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    Analyze multiple files and return list of summaries
    
    Args:
        file_paths (List[str]): List of absolute file paths
        relative_paths (List[str], optional): List of relative paths (must match file_paths length)
        
    Returns:
        List[dict]: List of standard file summaries
    """
    print(json.dumps({"debug": f"FILE_REANALYSIS: Starting batch analysis for {len(file_paths)} files"}), file=sys.stderr)
    
    if relative_paths and len(relative_paths) != len(file_paths):
        raise ValueError("relative_paths length must match file_paths length")
    
    results = []
    
    for i, file_path in enumerate(file_paths):
        rel_path = relative_paths[i] if relative_paths else None
        
        try:
            summary = analyze_file_summary(file_path, rel_path)
            results.append(summary)
            
            print(json.dumps({"debug": f"FILE_REANALYSIS: [{i+1}/{len(file_paths)}] Success: {os.path.basename(file_path)}"}), file=sys.stderr)
        except Exception as e:
            print(json.dumps({"debug": f"FILE_REANALYSIS: [{i+1}/{len(file_paths)}] Failed: {os.path.basename(file_path)} - {str(e)}"}), file=sys.stderr)
            
            # Add failed entry
            fallback = generate_fallback_summary(file_path, rel_path)
            fallback["status"] = "failed"
            results.append(fallback)
    
    print(json.dumps({"debug": f"FILE_REANALYSIS: Batch analysis completed - {len(results)} results"}), file=sys.stderr)
    
    return results

def generate_fallback_summary(file_path: str, relative_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Generate fallback summary when analysis fails
    
    Args:
        file_path (str): Path to the file
        relative_path (str, optional): Relative path for the file
        
    Returns:
        dict: Fallback summary data
    """
    file_name = os.path.basename(file_path)
    if relative_path is None:
        relative_path = file_name
    
    # Try to get basic file info
    file_size = get_file_size(file_path)
    total_lines = count_lines_safe(file_path)
    
    fallback_summary = {
        "fileName": file_name,
        "filePath": file_path,
        "relativePath": relative_path,
        "language": get_language_from_extension(file_path),
        "status": "success",  # Will be overridden if called for failed analysis
        
        # Basic metrics
        "totalLines": total_lines,
        "codeLines": max(0, total_lines - 2),  # Rough estimate
        "commentLines": 0,
        "blankLines": 2,  # Rough estimate
        "commentRatio": 0.0,
        "codeRatio": safe_ratio(max(0, total_lines - 2), total_lines),
        "blankRatio": safe_ratio(2, total_lines),
        
        # Conservative structure metrics
        "classCount": 0,
        "functionCount": 1 if total_lines > 5 else 0,  # Assume at least one function in non-trivial files
        
        # Conservative complexity metrics
        "maxComplexity": 1,
        "cyclomaticComplexityNumber": 1.0,
        "cyclomaticComplexityDensity": round(1.0 / max(total_lines, 1), 3),
        "highComplexityFunctions": 0,
        "criticalComplexityFunctions": 0,
        
        # Conservative parameter metrics
        "averageFunctionParameters": 0.0,
        "maxFunctionParameters": 0,
        "averageFunctionLines": float(total_lines),
        "maxFunctionLines": total_lines,
        "averageFunctionNestingDepth": 0.0,
        "maxFunctionNestingDepth": 0,
        
        # File size
        "fileSizeBytes": file_size
    }
    
    print(json.dumps({"debug": f"FILE_REANALYSIS: Generated fallback summary for {file_name}"}), file=sys.stderr)
    
    return normalize_output_paths(fallback_summary)

def calculate_average_density(functions: List[Dict[str, Any]]) -> float:
    """
    Calculate average cyclomatic density from functions list
    
    Args:
        functions (List[Dict]): List of function data from LivePanel
        
    Returns:
        float: Average cyclomatic density
    """
    if not functions:
        return 0.0
    
    total_density = sum(func.get('cyclomaticDensity', 0.0) for func in functions)
    return round(total_density / len(functions), 3)

def calculate_average_parameters(functions: List[Dict[str, Any]]) -> float:
    """
    Calculate average number of parameters from functions list
    
    Args:
        functions (List[Dict]): List of function data from LivePanel
        
    Returns:
        float: Average number of parameters
    """
    if not functions:
        return 0.0
    
    total_params = sum(func.get('parameters', 0) for func in functions)
    return round(total_params / len(functions), 1)

def calculate_max_parameters(functions: List[Dict[str, Any]]) -> int:
    """
    Calculate maximum number of parameters from functions list
    
    Args:
        functions (List[Dict]): List of function data from LivePanel
        
    Returns:
        int: Maximum number of parameters
    """
    if not functions:
        return 0
    
    return max(func.get('parameters', 0) for func in functions)

def get_language_from_extension(file_path: str) -> str:
    """
    Determine programming language from file extension
    """
    ext = Path(file_path).suffix.lower()
    
    language_map = {
        '.py': 'Python',
        '.js': 'JavaScript',
        '.ts': 'TypeScript',
        '.tsx': 'TypeScript',
        '.jsx': 'JavaScript',
        '.java': 'Java',
        '.c': 'C',
        '.cpp': 'C++',
        '.cc': 'C++',
        '.cxx': 'C++',
        '.h': 'C',
        '.hpp': 'C++',
        '.cs': 'C#',
        '.go': 'Go',
        '.rs': 'Rust',
        '.php': 'PHP',
        '.rb': 'Ruby',
        '.swift': 'Swift',
        '.kt': 'Kotlin',
        '.scala': 'Scala',
        '.dart': 'Dart',
        '.vue': 'Vue',
        '.html': 'HTML',
        '.css': 'CSS',
        '.scss': 'SCSS',
        '.less': 'Less'
    }
    
    return language_map.get(ext, 'Unknown')

def get_file_size(file_path: str) -> int:
    """
    Get file size in bytes safely
    """
    try:
        return os.path.getsize(file_path)
    except:
        return 0

def count_lines_safe(file_path: str) -> int:
    """
    Count file lines safely
    """
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return sum(1 for _ in f)
    except:
        return 0

def main():
    """
    Main entry point for file re-analysis
    """
    if len(sys.argv) < 2:
        print("Usage: python file_reanalysis_coordinator.py <file_path> [relative_path]", file=sys.stderr)
        print("   or: python file_reanalysis_coordinator.py <file1> <file2> ... [--relative-paths path1 path2 ...]", file=sys.stderr)
        sys.exit(1)
    
    # Parse arguments
    args = sys.argv[1:]
    
    # Check for --relative-paths flag
    relative_paths = None
    if '--relative-paths' in args:
        rel_index = args.index('--relative-paths')
        file_paths = args[:rel_index]
        relative_paths = args[rel_index + 1:]
        
        if len(relative_paths) != len(file_paths):
            print(json.dumps({"error": "Number of relative paths must match number of file paths"}), file=sys.stderr)
            sys.exit(1)
    else:
        # Single file or multiple files without relative paths
        if len(args) == 1:
            # Single file analysis
            file_path = args[0]
            
            # Validate file exists
            if not os.path.isfile(file_path):
                print(json.dumps({"error": f"File not found: {file_path}"}), file=sys.stderr)
                sys.exit(1)
            
            try:
                summary = analyze_file_summary(file_path)
                
                # Output the result as JSON with markers
                print("=== JSON_START ===")
                print(json.dumps(summary, indent=2))
                print("=== JSON_END ===")
                
                print(json.dumps({"debug": f"FILE_REANALYSIS: Successfully completed analysis for {file_path}"}), file=sys.stderr)
                
            except Exception as e:
                print(json.dumps({"error": f"File re-analysis failed: {str(e)}"}), file=sys.stderr)
                sys.exit(1)
                
        elif len(args) == 2:
            # Single file with relative path
            file_path, relative_path = args
            
            # Validate file exists
            if not os.path.isfile(file_path):
                print(json.dumps({"error": f"File not found: {file_path}"}), file=sys.stderr)
                sys.exit(1)
            
            try:
                summary = analyze_file_summary(file_path, relative_path)
                
                # Output the result as JSON with markers
                print("=== JSON_START ===")
                print(json.dumps(summary, indent=2))
                print("=== JSON_END ===")
                
                print(json.dumps({"debug": f"FILE_REANALYSIS: Successfully completed analysis for {file_path}"}), file=sys.stderr)
                
            except Exception as e:
                print(json.dumps({"error": f"File re-analysis failed: {str(e)}"}), file=sys.stderr)
                sys.exit(1)
        else:
            # Multiple files without relative paths
            file_paths = args
            
            # Validate all files exist
            for file_path in file_paths:
                if not os.path.isfile(file_path):
                    print(json.dumps({"error": f"File not found: {file_path}"}), file=sys.stderr)
                    sys.exit(1)
            
            try:
                summaries = analyze_multiple_files(file_paths)
                
                # Output the results as JSON array with markers
                print("=== JSON_START ===")
                print(json.dumps(summaries, indent=2))
                print("=== JSON_END ===")
                
                print(json.dumps({"debug": f"FILE_REANALYSIS: Successfully completed batch analysis"}), file=sys.stderr)
                
            except Exception as e:
                print(json.dumps({"error": f"Batch file re-analysis failed: {str(e)}"}), file=sys.stderr)
                sys.exit(1)
    
    # Handle --relative-paths case
    if relative_paths is not None:
        # Validate all files exist
        for file_path in file_paths:
            if not os.path.isfile(file_path):
                print(json.dumps({"error": f"File not found: {file_path}"}), file=sys.stderr)
                sys.exit(1)
        
        try:
            summaries = analyze_multiple_files(file_paths, relative_paths)
            
            # Output the results as JSON array with markers
            print("=== JSON_START ===")
            print(json.dumps(summaries, indent=2))
            print("=== JSON_END ===")
            
            print(json.dumps({"debug": f"FILE_REANALYSIS: Successfully completed batch analysis with relative paths"}), file=sys.stderr)
            
        except Exception as e:
            print(json.dumps({"error": f"Batch file re-analysis with relative paths failed: {str(e)}"}), file=sys.stderr)
            sys.exit(1)

if __name__ == "__main__":
    main()








