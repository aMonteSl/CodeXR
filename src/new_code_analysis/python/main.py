#!/usr/bin/env python3
"""
CodeXR Main Python Analysis Dispatcher
Central dispatcher for all CodeXR analysis types
Receives analysis type as argument and launches the appropriate analyzer
"""

import sys
import os
import argparse
import json
from pathlib import Path

def main():
    """Main dispatcher function"""
    parser = argparse.ArgumentParser(description='CodeXR Analysis Dispatcher')
    parser.add_argument('analysis_type', 
                       choices=['FileLivePanel', 'FileXRAnalysis', 'DOMVisualization'],
                       help='Type of analysis to perform')
    parser.add_argument('file_path', 
                       help='Path to the file to analyze')
    parser.add_argument('--output-dir', 
                       help='Output directory for analysis results (optional)')
    parser.add_argument('--debug', 
                       action='store_true', 
                       help='Enable debug output')
    
    args = parser.parse_args()
    
    if args.debug:
        print(f"MAIN_DISPATCHER: Analysis type: {args.analysis_type}", file=sys.stderr)
        print(f"MAIN_DISPATCHER: File path: {args.file_path}", file=sys.stderr)
        print(f"MAIN_DISPATCHER: Output dir: {args.output_dir}", file=sys.stderr)
    
    # Verify file exists
    if not os.path.exists(args.file_path):
        error_msg = f"File not found: {args.file_path}"
        print(json.dumps({"error": error_msg}))
        sys.exit(1)
    
    try:
        # Get the directory where this script is located
        script_dir = Path(__file__).parent
        
        # Dispatch to appropriate analyzer
        if args.analysis_type == 'FileLivePanel':
            # Import and run LivePanel analysis
            sys.path.insert(0, str(script_dir))
            from livePanel_file_analysis_coordinator import main as live_panel_main
            
            if args.debug:
                print("MAIN_DISPATCHER: Launching LivePanel analysis...", file=sys.stderr)
            
            # Call LivePanel with original sys.argv format
            original_argv = sys.argv
            sys.argv = ['livePanel_file_analysis_coordinator.py', args.file_path]
            try:
                live_panel_main()
            finally:
                sys.argv = original_argv
                
        elif args.analysis_type == 'FileXRAnalysis':
            # Import and run XR analysis
            sys.path.insert(0, str(script_dir))
            from xr_file_analysis_coordinator import main as xr_main
            
            if args.debug:
                print("MAIN_DISPATCHER: Launching XR analysis...", file=sys.stderr)
            
            # Call XR analysis with original sys.argv format
            original_argv = sys.argv
            sys.argv = ['xr_file_analysis_coordinator.py', args.file_path]
            try:
                xr_main()
            finally:
                sys.argv = original_argv
                
        elif args.analysis_type == 'DOMVisualization':
            # Import and run DOM visualization
            sys.path.insert(0, str(script_dir))
            from html_dom_parser import main as dom_main
            
            if args.debug:
                print("MAIN_DISPATCHER: Launching DOM visualization...", file=sys.stderr)
            
            # Call DOM parser with original sys.argv format
            original_argv = sys.argv
            sys.argv = ['html_dom_parser.py', args.file_path]
            try:
                dom_main()
            finally:
                sys.argv = original_argv
        
        else:
            error_msg = f"Unknown analysis type: {args.analysis_type}"
            print(json.dumps({"error": error_msg}))
            sys.exit(1)
            
    except ImportError as e:
        error_msg = f"Failed to import analyzer module: {str(e)}"
        print(json.dumps({"error": error_msg}))
        if args.debug:
            import traceback
            print(f"MAIN_DISPATCHER_ERROR: {traceback.format_exc()}", file=sys.stderr)
        sys.exit(1)
        
    except Exception as e:
        error_msg = f"Analysis failed: {str(e)}"
        print(json.dumps({"error": error_msg}))
        if args.debug:
            import traceback
            print(f"MAIN_DISPATCHER_ERROR: {traceback.format_exc()}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
