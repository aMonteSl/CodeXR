#!/usr/bin/env python3
"""
Lizard Code Analyzer Wrapper

This script runs the Lizard code analysis tool and outputs the results in JSON format.
It's designed to be called from the TypeScript code in the CodeXR extension.

Usage: python lizard_analyzer.py <file_path>
"""

import sys
import json
import os
import lizard

def analyze_file(file_path):
    """
    Analyze a single file using lizard and return structured metrics
    
    Args:
        file_path: Path to the file to analyze
        
    Returns:
        Dictionary with analysis results
    """
    # Make sure the file exists
    if not os.path.exists(file_path):
        return {
            "error": f"File not found: {file_path}"
        }
    
    try:
        # Analyze the file with lizard
        analysis = lizard.analyze_file(file_path)
        
        # Extract file-level metrics
        file_info = {
            "filePath": file_path,
            "fileName": os.path.basename(file_path),
            "nloc": analysis.nloc,
            "functionCount": len(analysis.function_list)
        }
        
        # Extract function-level metrics
        functions = []
        for func in analysis.function_list:
            function_info = {
                "name": func.name,
                "lineStart": func.start_line,
                "lineEnd": func.end_line,
                "lineCount": func.nloc,
                "complexity": func.cyclomatic_complexity,
                "parameters": len(func.parameters),
                "maxNestingDepth": func.max_nesting_depth if hasattr(func, 'max_nesting_depth') else 0
            }
            functions.append(function_info)
        
        # Calculate additional metrics
        complexity_metrics = calculate_complexity_metrics(functions)
        
        # Build the complete result
        result = {
            "file": file_info,
            "functions": functions,
            "metrics": complexity_metrics,
            "status": "success"
        }
        
        return result
    
    except Exception as e:
        return {
            "error": str(e),
            "status": "error"
        }

def calculate_complexity_metrics(functions):
    """
    Calculate complexity metrics based on function data
    
    Args:
        functions: List of function metrics
        
    Returns:
        Dictionary with calculated complexity metrics
    """
    if not functions:
        return {
            "averageComplexity": 0,
            "maxComplexity": 0,
            "functionCount": 0,
            "highComplexityFunctions": 0,
            "criticalComplexityFunctions": 0
        }
    
    # Extract complexities
    complexities = [func["complexity"] for func in functions]
    
    # Calculate metrics
    avg_complexity = sum(complexities) / len(complexities)
    max_complexity = max(complexities)
    high_complexity = sum(1 for c in complexities if c > 10)
    critical_complexity = sum(1 for c in complexities if c > 25)
    
    return {
        "averageComplexity": round(avg_complexity * 10) / 10,  # Round to 1 decimal place
        "maxComplexity": max_complexity,
        "functionCount": len(functions),
        "highComplexityFunctions": high_complexity,
        "criticalComplexityFunctions": critical_complexity
    }


def main():
    """Main entry point"""
    # Check for arguments
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided", "status": "error"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = analyze_file(file_path)
    
    # Output as JSON
    print(json.dumps(result))


if __name__ == "__main__":
    main()