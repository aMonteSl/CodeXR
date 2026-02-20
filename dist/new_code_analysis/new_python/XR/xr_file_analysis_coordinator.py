

#!/usr/bin/env python3
"""
XR File Analysis Coordinator

This script generates function-level analysis data specifically formatted for XR visualization.
Produces a JSON array with function-specific metrics.

Usage: python xr_file_analysis_coordinator.py <file_path>
"""

import sys
import json
import os
import subprocess
import time
from pathlib import Path

def analyze_file_for_xr(file_path):
    """
    Generate XR-specific function analysis data
    
    Args:
        file_path (str): Path to the file to analyze
        
    Returns:
        list: Array of function objects with XR-specific metrics
    """
    print(json.dumps({"debug": f"XR_ANALYSIS: Starting XR analysis for {file_path}"}), file=sys.stderr)
    
    # Get the directory containing this script
    script_dir = Path(__file__).parent
    
    try:
        # Run lizard analysis to get function-level metrics
        lizard_path = script_dir / ".." / "tools" / "lizard_analyzer.py"  # Updated path to use new tools
        
        print(json.dumps({"debug": f"XR_ANALYSIS: Running lizard analyzer: {lizard_path}"}), file=sys.stderr)
        
        result = subprocess.run([
            sys.executable, 
            str(lizard_path), 
            file_path
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            print(json.dumps({"debug": f"XR_ANALYSIS: Lizard analyzer failed: {result.stderr}"}), file=sys.stderr)
            return generate_fallback_xr_data(file_path)
        
        # Parse lizard output
        try:
            lizard_data = json.loads(result.stdout)
            print(json.dumps({"debug": f"XR_ANALYSIS: Lizard analysis completed, found {len(lizard_data.get('functions', []))} functions"}), file=sys.stderr)
        except json.JSONDecodeError as e:
            print(json.dumps({"debug": f"XR_ANALYSIS: Failed to parse lizard output: {e}"}), file=sys.stderr)
            return generate_fallback_xr_data(file_path)
        
        # Convert to XR format
        xr_functions = []
        
        # Get file information for context
        file_name = os.path.basename(file_path)
        relative_path = file_path  # Will be updated by the caller if needed
        
        for func in lizard_data.get('functions', []):
            xr_function = {
                "functionName": func.get('name', 'unknown'),
                "lineStart": func.get('lineStart', 0),  # Fixed: use correct field name
                "lineEnd": func.get('lineEnd', 0),      # Fixed: use correct field name
                "lineCount": func.get('lineCount', 0),  # Fixed: use correct field name
                "complexity": func.get('complexity', 1), # Fixed: use correct field name
                "parameters": func.get('parameters', 0), # Fixed: use correct field name
                "maxNestingDepth": func.get('maxNestingDepth', 0), # Fixed: use correct field name
                "cyclomaticDensity": func.get('cyclomaticDensity', 1.0),  # Use the already calculated value from lizard
                # Add file context for identification
                "filePath": file_path,
                "fileName": file_name
            }
            xr_functions.append(xr_function)
        
        print(json.dumps({"debug": f"XR_ANALYSIS: Generated {len(xr_functions)} XR function records"}), file=sys.stderr)
        
        # Sort by line start for consistent ordering
        xr_functions.sort(key=lambda x: x['lineStart'])
        
        return xr_functions
        
    except subprocess.TimeoutExpired:
        print(json.dumps({"debug": "XR_ANALYSIS: Lizard analysis timed out"}), file=sys.stderr)
        return generate_fallback_xr_data(file_path)
    except Exception as e:
        print(json.dumps({"debug": f"XR_ANALYSIS: Analysis failed: {str(e)}"}), file=sys.stderr)
        return generate_fallback_xr_data(file_path)

def calculate_cyclomatic_density(complexity, nloc):
    """
    Calculate cyclomatic density (complexity / lines of code)
    
    Args:
        complexity (int): Cyclomatic complexity
        nloc (int): Number of lines of code
        
    Returns:
        float: Cyclomatic density (rounded to 3 decimals)
    """
    if nloc <= 0:
        return 0.0
    
    density = complexity / nloc
    return round(density, 3)

def generate_fallback_xr_data(file_path):
    """
    Generate fallback XR data when analysis fails
    
    Args:
        file_path (str): Path to the file
        
    Returns:
        list: Fallback function data (empty list for empty files)
    """
    file_name = os.path.basename(file_path)
    
    # Try to count lines for basic metrics
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            total_lines = len(lines)
    except:
        total_lines = 0  # Default fallback to 0 for error cases
    
    # For completely empty files, return empty array (no functions)
    # This allows the empty file to appear in visualization with 0 lines
    if total_lines == 0:
        print(json.dumps({"debug": f"XR_ANALYSIS: File is empty, returning empty function list"}), file=sys.stderr)
        return []
    
    # For files with content but analysis failed, generate a single fallback function entry
    base_name = os.path.splitext(file_name)[0]
    fallback_function = {
        "functionName": base_name,
        "lineStart": 1,
        "lineEnd": total_lines,
        "lineCount": total_lines,
        "complexity": 1,
        "parameters": 0,
        "maxNestingDepth": 0,
        "cyclomaticDensity": round(1.0 / total_lines, 3) if total_lines > 0 else 0.0,
        # Add file context for identification
        "filePath": file_path,
        "fileName": file_name
    }
    
    print(json.dumps({"debug": f"XR_ANALYSIS: Generated fallback data for {file_name}"}), file=sys.stderr)
    
    return [fallback_function]

def get_language_from_extension(file_path):
    """
    Determine programming language from file extension
    """
    ext = Path(file_path).suffix.lower()
    
    language_map = {
        '.py': 'python',
        '.js': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.jsx': 'javascript',
        '.java': 'java',
        '.c': 'c',
        '.cpp': 'cpp',
        '.cc': 'cpp',
        '.cxx': 'cpp',
        '.h': 'c',
        '.hpp': 'cpp',
        '.cs': 'csharp',
        '.go': 'go',
        '.rs': 'rust',
        '.php': 'php',
        '.rb': 'ruby',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.scala': 'scala',
        '.dart': 'dart',
        '.vue': 'vue',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.less': 'less'
    }
    
    return language_map.get(ext, 'unknown')

def main():
    """
    Main entry point for XR file analysis
    """
    if len(sys.argv) != 2:
        print("Usage: python xr_file_analysis_coordinator.py <file_path>", file=sys.stderr)
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    # Validate file exists
    if not os.path.isfile(file_path):
        print(json.dumps({"error": f"File not found: {file_path}"}), file=sys.stderr)
        sys.exit(1)
    
    # Perform XR analysis
    try:
        xr_data = analyze_file_for_xr(file_path)
        
        # Output the result as JSON
        print(json.dumps(xr_data, indent=2))
        
        print(json.dumps({"debug": f"XR_ANALYSIS: Successfully completed analysis for {file_path}"}), file=sys.stderr)
        
    except Exception as e:
        print(json.dumps({"error": f"XR analysis failed: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
