#!/usr/bin/env python3
"""
XR Directory Analysis Coordinator

This script coordinates directory-level analysis to generate file data for XR visualization.
It generates a simplified data.json structure containing only file metrics for each file
in the directory, designed specifically for XR environments.

Usage: python xr_directory_analysis_coordinator.py <directory_path>
"""

import sys
import json
import os
import subprocess
import time
from pathlib import Path

def analyze_directory_xr(directory_path, is_deep=False, filtered_files=None):
    """
    Coordinate XR directory analysis to generate file-focused data structure
    
    Args:
        directory_path (str): Path to the directory to analyze
        is_deep (bool): Whether to analyze recursively through subdirectories
        filtered_files (list): Optional list of specific files to analyze (bypasses scanning)
        
    Returns:
        list: Array of file data objects for XR visualization
    """
    print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Starting XR analysis for {directory_path} (deep={is_deep}, filtered={filtered_files is not None})"}), file=sys.stderr)
    
    # Get the directory containing this script
    script_dir = Path(__file__).parent
    
    # Initialize result as simple array of files for XR
    files_array = []
    
    try:
        # Use filtered files if provided, otherwise scan directory for analyzable files
        if filtered_files is not None:
            print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Using filtered file list with {len(filtered_files)} files"}), file=sys.stderr)
            files_to_analyze = filtered_files
        else:
            # Scan directory for analyzable files
            print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Scanning directory {directory_path}"}), file=sys.stderr)
            if is_deep:
                files_to_analyze = scan_directory_files_xr_deep(directory_path)
                print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Deep scan found {len(files_to_analyze)} files to analyze"}), file=sys.stderr)
            else:
                files_to_analyze = scan_directory_files_xr(directory_path)
                print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Regular scan found {len(files_to_analyze)} files to analyze"}), file=sys.stderr)
        
        # Analyze each file and generate XR file data
        analyzed_files = 0
        not_analyzed_files = 0
        total_files = len(files_to_analyze)
        
        print(json.dumps({"progress": {"current": 0, "total": total_files, "message": "Starting file analysis..."}}), file=sys.stderr)
        
        for file_path in files_to_analyze:
            try:
                # Calculate progress percentage
                current_file = analyzed_files + not_analyzed_files + 1
                percentage = int((current_file / total_files) * 100) if total_files > 0 else 0
                file_name = os.path.basename(file_path)
                
                print(json.dumps({"progress": {"current": current_file, "total": total_files, "percentage": percentage, "message": f"Analyzing {file_name}... ({current_file}/{total_files})"}}), file=sys.stderr)
                print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Analyzing file {file_path}"}), file=sys.stderr)
                
                file_data = analyze_single_file_xr(file_path, script_dir, directory_path)
                
                if file_data and file_data.get("status") == "success":
                    files_array.append(file_data)
                    analyzed_files += 1
                    print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Successfully analyzed {os.path.basename(file_path)}"}), file=sys.stderr)
                else:
                    not_analyzed_files += 1
                    print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Failed to analyze {os.path.basename(file_path)}"}), file=sys.stderr)
                    
            except Exception as e:
                not_analyzed_files += 1
                print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Error analyzing {file_path}: {str(e)}"}), file=sys.stderr)
        
        # Final progress update
        print(json.dumps({"progress": {"current": total_files, "total": total_files, "percentage": 100, "message": f"Analysis completed! {analyzed_files} files analyzed successfully."}}), file=sys.stderr)
        print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Completed. {analyzed_files} analyzed, {not_analyzed_files} failed"}), file=sys.stderr)
        
        return files_array
        
    except Exception as e:
        print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Critical error: {str(e)}"}), file=sys.stderr)
        return []

def scan_directory_files_xr(directory_path):
    """
    Scan directory for analyzable files (first level only for XR)
    
    Args:
        directory_path (str): Path to directory to scan
        
    Returns:
        list: List of file paths to analyze
    """
    analyzable_files = []
    analyzable_extensions = get_analyzable_extensions()
    
    try:
        for entry in os.listdir(directory_path):
            full_path = os.path.join(directory_path, entry)
            
            # Only process files (not subdirectories for XR first-level analysis)
            if os.path.isfile(full_path):
                # Check if file has analyzable extension
                file_ext = os.path.splitext(entry)[1].lower()
                if file_ext in analyzable_extensions:
                    analyzable_files.append(full_path)
    
    except Exception as e:
        print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Error scanning directory: {str(e)}"}), file=sys.stderr)
    
    return sorted(analyzable_files)

def scan_directory_files_xr_deep(directory_path):
    """
    Recursively scan directory and all subdirectories for analyzable files (XR Deep)
    
    Args:
        directory_path (str): Path to directory to scan
        
    Returns:
        list: List of file paths to analyze from all subdirectories
    """
    analyzable_files = []
    analyzable_extensions = get_analyzable_extensions()
    
    try:
        # Use os.walk for recursive directory traversal
        for root, dirs, files in os.walk(directory_path):
            for file in files:
                full_path = os.path.join(root, file)
                
                # Check if file has analyzable extension
                file_ext = os.path.splitext(file)[1].lower()
                if file_ext in analyzable_extensions:
                    analyzable_files.append(full_path)
    
    except Exception as e:
        print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Error scanning directory recursively: {str(e)}"}), file=sys.stderr)
    
    return sorted(analyzable_files)

def analyze_single_file_xr(file_path, script_dir, base_directory_path):
    """
    Analyze a single file and generate XR-focused file data
    
    Args:
        file_path (str): Path to file to analyze
        script_dir (Path): Path to script directory
        base_directory_path (str): Base directory path for relative path calculation
        
    Returns:
        dict: XR file data structure with metrics
    """
    try:
        # Use the existing file analysis coordinator to get detailed metrics
        coordinator_path = script_dir / "livePanel_file_analysis_coordinator.py"
        
        if not coordinator_path.exists():
            print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: File coordinator not found: {coordinator_path}"}), file=sys.stderr)
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
                
                # Generate XR file data structure
                xr_file_data = create_xr_file_data(file_analysis, file_path, base_directory_path)
                return xr_file_data
                
            except json.JSONDecodeError as e:
                print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: JSON decode error for {file_path}: {str(e)}"}), file=sys.stderr)
                return None
        else:
            print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: File analysis failed for {file_path}. Return code: {result.returncode}"}), file=sys.stderr)
            if result.stderr:
                print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Error output: {result.stderr[:200]}"}), file=sys.stderr)
            return None
            
    except subprocess.TimeoutExpired:
        print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Timeout analyzing {file_path}"}), file=sys.stderr)
        return None
    except Exception as e:
        print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Exception analyzing {file_path}: {str(e)}"}), file=sys.stderr)
        return None

def create_xr_file_data(file_analysis, file_path, base_directory_path):
    """
    Create XR file data structure from detailed file analysis
    
    Args:
        file_analysis (dict): Detailed file analysis from coordinator
        file_path (str): Full path to the file
        base_directory_path (str): Base directory path for relative path calculation
        
    Returns:
        dict: XR file data structure
    """
    # Calculate relative path
    relative_path = os.path.relpath(file_path, base_directory_path)
    
    # Basic file information
    xr_data = {
        "fileName": os.path.basename(file_path),
        "filePath": file_path,
        "relativePath": relative_path,
        "language": file_analysis.get("language", get_language_from_extension(file_path)),
        "status": "success",
        
        # Line metrics (direct from LivePanel - corrected paths)
        "totalLines": file_analysis.get("totalLines", 0),
        "codeLines": file_analysis.get("codeLines", 0),
        "commentLines": file_analysis.get("commentLines", 0),
        "blankLines": file_analysis.get("blankLines", 0),
        
        # Structure metrics (direct from LivePanel)
        "classCount": file_analysis.get("classCount", 0),
        "functionCount": file_analysis.get("functionCount", 0),
        
        # Complexity metrics (from complexity sub-object)
        "maxComplexity": 0,
        "cyclomaticComplexityNumber": 0.0,
        "cyclomaticComplexityDensity": 0.0,
        
        # Function parameter metrics (calculated from functions array)
        "averageFunctionParameters": 0.0,
        "maxFunctionParameters": 0,
        
        # File size
        "fileSizeBytes": 0
    }
    
    # Calculate file size
    try:
        xr_data["fileSizeBytes"] = os.path.getsize(file_path)
    except:
        xr_data["fileSizeBytes"] = 0
    
    # Extract complexity metrics from complexity sub-object
    complexity_data = file_analysis.get("complexity", {})
    if complexity_data:
        xr_data["maxComplexity"] = complexity_data.get("maxComplexity", 0)
        xr_data["cyclomaticComplexityNumber"] = complexity_data.get("averageComplexity", 0.0)
    
    # Calculate function parameter metrics from functions array
    functions = file_analysis.get("functions", [])
    if functions:
        parameter_counts = []
        total_density = 0.0
        
        for func in functions:
            # Extract parameter count
            param_count = func.get("parameters", 0)
            parameter_counts.append(param_count)
            
            # Extract cyclomatic density for overall average
            density = func.get("cyclomaticDensity", 0.0)
            total_density += density
        
        if parameter_counts:
            xr_data["averageFunctionParameters"] = round(sum(parameter_counts) / len(parameter_counts), 1)
            xr_data["maxFunctionParameters"] = max(parameter_counts)
        
        # Calculate average cyclomatic density across all functions
        if len(functions) > 0:
            xr_data["cyclomaticComplexityDensity"] = round(total_density / len(functions), 3)
    
    return xr_data

def get_analyzable_extensions():
    """
    Get list of file extensions that can be analyzed by Lizard
    (Excluding HTML as per recent requirements)
    
    Returns:
        list: List of file extensions
    """
    return [
        # Programming Languages - CodeXR Supported by Lizard
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
        '.pas',  # Pascal
        # XR-specific file types
        '.html', '.htm'  # HTML (required for XR analysis)
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
        '.jsx': 'JavaScript',
        '.css': 'CSS', '.scss': 'CSS', '.less': 'CSS',
        '.clj': 'Clojure', '.cljs': 'Clojure',
        '.hs': 'Haskell',
        '.ml': 'OCaml', '.mli': 'OCaml',
        '.pas': 'Pascal'
    }
    
    return language_map.get(ext, 'Unknown')

def main(filtered_files=None):
    """Main entry point for XR directory analysis"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python xr_directory_analysis_coordinator.py <directory_path> [output_dir] [--deep]"}), file=sys.stderr)
        sys.exit(1)
    
    directory_path = sys.argv[1]
    output_dir = None
    is_deep = False
    
    # Parse remaining arguments
    for i in range(2, len(sys.argv)):
        arg = sys.argv[i]
        if arg == '--deep':
            is_deep = True
        elif output_dir is None:
            output_dir = arg
    
    print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Starting with directory={directory_path}, output_dir={output_dir}, deep={is_deep}, filtered_files={filtered_files is not None}"}), file=sys.stderr)
    
    # Validate directory exists (skip if using filtered files)
    if filtered_files is None and (not os.path.exists(directory_path) or not os.path.isdir(directory_path)):
        print(json.dumps({"error": f"Directory not found or not a directory: {directory_path}"}), file=sys.stderr)
        sys.exit(1)
    
    # Perform XR directory analysis
    files_array = analyze_directory_xr(directory_path, is_deep, filtered_files)
    
    # If output directory specified, save to data.json
    if output_dir:
        try:
            os.makedirs(output_dir, exist_ok=True)
            output_file = os.path.join(output_dir, "data.json")
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(files_array, f, indent=2)
            print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Saved results to {output_file}"}), file=sys.stderr)
        except Exception as e:
            print(json.dumps({"error": f"Failed to save results: {str(e)}"}), file=sys.stderr)
    
    # Output result as JSON array to stdout
    print(json.dumps(files_array, indent=2))

if __name__ == "__main__":
    main()
