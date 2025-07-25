#!/usr/bin/env python3
"""
Main entry point for Python analysis
Este script actúa como punto de entrada único para todos los análisis Python
"""

import sys
import os
import argparse
import json
import subprocess
from pathlib import Path

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Python Analysis Entry Point')
    parser.add_argument('--mode', required=True, choices=['livePanel', 'xr'], help='Analysis mode')
    parser.add_argument('--type', required=True, choices=['file', 'directory', 'project'], help='Analysis type')
    parser.add_argument('--target', required=True, help='Target path to analyze')
    parser.add_argument('--output', help='Output file path (optional)')
    
    # Directory analysis specific options
    parser.add_argument('--files', nargs='*', help='Specific files to analyze (for directory mode)')
    parser.add_argument('--deep', action='store_true', help='Enable deep recursive analysis for directories')
    
    args = parser.parse_args()
    
    print(f"MAIN_PY: Starting analysis - Mode: {args.mode}, Type: {args.type}, Target: {args.target}")
    
    try:
        if args.mode == 'livePanel' and args.type == 'file':
            print("MAIN_PY: Delegating to LivePanel file analysis...")
            result = execute_livepanel_file_analysis(args.target)
        elif args.mode == 'livePanel' and args.type == 'directory':
            print("MAIN_PY: Delegating to LivePanel directory analysis...")
            result = execute_livepanel_directory_analysis(args.target, args.files, args.deep)
        elif args.mode == 'xr':
            print("MAIN_PY: Delegating to XR analysis...")
            result = execute_xr_analysis(args.target, args.type)
        else:
            raise ValueError(f"Unsupported combination: {args.mode} + {args.type}")
        
        # Output result as JSON
        print("MAIN_PY: Analysis completed successfully")
        print("=== JSON_START ===")
        print(json.dumps(result, indent=2))
        print("=== JSON_END ===")
        
    except Exception as e:
        print(f"MAIN_PY: Error during analysis: {str(e)}", file=sys.stderr)
        error_result = {
            "error": True,
            "message": str(e),
            "mode": args.mode,
            "type": args.type,
            "target": args.target
        }
        print("=== JSON_START ===")
        print(json.dumps(error_result, indent=2))
        print("=== JSON_END ===")
        sys.exit(1)

def execute_livepanel_file_analysis(target_file):
    """Ejecuta análisis de archivo LivePanel"""
    print(f"MAIN_PY: Analyzing file: {target_file}")
    
    # Import the coordinator
    sys.path.append(os.path.join(os.path.dirname(__file__), 'livePanels'))
    
    try:
        from livePanel_file_analysis_coordinator import analyze_file_comprehensive
        
        result = analyze_file_comprehensive(target_file)
        
        # Para livePanel, devolvemos directamente los datos sin wrapper
        return result
        
    except ImportError as e:
        print(f"MAIN_PY: Could not import coordinator: {e}")
        raise
    except Exception as e:
        print(f"MAIN_PY: Error in file analysis: {e}")
        raise

def execute_livepanel_directory_analysis(target_directory, files_to_analyze=None, deep_scan=False):
    """Execute LivePanel directory analysis using original coordinators"""
    try:
        print(f"MAIN_PY: Starting directory analysis: {target_directory} (deep={deep_scan})")
        
        # Import the appropriate coordinator based on deep_scan flag
        sys.path.append(os.path.join(os.path.dirname(__file__), 'livePanels'))
        
        if deep_scan:
            from livePanel_directory_deep_analysis_coordinator import analyze_directory_deep_comprehensive
            result = analyze_directory_deep_comprehensive(target_directory, files_to_analyze)
        else:
            from livePanel_directory_analysis_coordinator import analyze_directory_comprehensive
            result = analyze_directory_comprehensive(target_directory, files_to_analyze)
        
        return result
        
    except ImportError as e:
        print(f"MAIN_PY: Could not import directory coordinator: {e}")
        raise
    except Exception as e:
        print(f"MAIN_PY: Error in directory analysis: {e}")
        raise

def execute_xr_analysis(target_path, analysis_type):
    """Ejecuta análisis XR"""
    print(f"MAIN_PY: TODO - XR analysis not yet implemented: {target_path} ({analysis_type})")
    
    return {
        "success": False,
        "mode": "xr",
        "type": analysis_type,
        "target": target_path,
        "message": "XR analysis not yet implemented",
        "data": {}
    }

if __name__ == "__main__":
    main()
