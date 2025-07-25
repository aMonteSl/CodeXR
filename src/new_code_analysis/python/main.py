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
                       choices=['FileLivePanel', 'FileXRAnalysis', 'DOMVisualization', 'DirectoryLivePanel', 'DirectoryLivePanelDeep', 'DirectoryXR', 'DirectoryXRDeep', 'FileReanalysis'],
                       help='Type of analysis to perform')
    parser.add_argument('file_path', 
                       help='Path to the file or directory to analyze')
    parser.add_argument('--output-dir', 
                       help='Output directory for analysis results (optional)')
    parser.add_argument('--debug', 
                       action='store_true', 
                       help='Enable debug output')
    parser.add_argument('--file-list-stdin', 
                       action='store_true', 
                       help='Read filtered file list from stdin as JSON')
    
    args = parser.parse_args()
    
    # Read filtered file list from stdin if requested
    filtered_files = None
    if args.file_list_stdin:
        try:
            stdin_content = sys.stdin.read()
            if stdin_content.strip():
                filtered_files = json.loads(stdin_content)
                if args.debug:
                    print(f"MAIN_DISPATCHER: Received filtered files list: {len(filtered_files)} files", file=sys.stderr)
        except json.JSONDecodeError as e:
            error_msg = f"Failed to parse file list from stdin: {str(e)}"
            print(json.dumps({"error": error_msg}))
            sys.exit(1)
    
    if args.debug:
        print(f"MAIN_DISPATCHER: Analysis type: {args.analysis_type}", file=sys.stderr)
        print(f"MAIN_DISPATCHER: File path: {args.file_path}", file=sys.stderr)
        print(f"MAIN_DISPATCHER: Output dir: {args.output_dir}", file=sys.stderr)
        print(f"MAIN_DISPATCHER: Using file list stdin: {args.file_list_stdin}", file=sys.stderr)
    
    # Verify file exists (skip verification if using file list from stdin)
    if not args.file_list_stdin and not os.path.exists(args.file_path):
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
                
        elif args.analysis_type == 'DirectoryLivePanel':
            # Import and run Directory LivePanel analysis
            sys.path.insert(0, str(script_dir))
            from livePanel_directory_analysis_coordinator import main as directory_main
            
            if args.debug:
                print("MAIN_DISPATCHER: Launching Directory LivePanel analysis...", file=sys.stderr)
                if filtered_files:
                    print(f"MAIN_DISPATCHER: Using file list with {len(filtered_files)} filtered files", file=sys.stderr)
            
            # Call Directory analysis with filtered files
            try:
                directory_main(filtered_files)
            except TypeError:
                # Fallback for older coordinators that don't accept filtered_files parameter
                if args.debug:
                    print("MAIN_DISPATCHER: Coordinator doesn't support filtered files, using legacy mode", file=sys.stderr)
                original_argv = sys.argv
                sys.argv = ['livePanel_directory_analysis_coordinator.py', args.file_path]
                try:
                    directory_main()
                finally:
                    sys.argv = original_argv
                
        elif args.analysis_type == 'DirectoryLivePanelDeep':
            # Import and run Directory LivePanel DEEP analysis
            sys.path.insert(0, str(script_dir))
            from livePanel_directory_deep_analysis_coordinator import main as directory_deep_main
            
            if args.debug:
                print("MAIN_DISPATCHER: Launching Directory LivePanel DEEP analysis...", file=sys.stderr)
                if filtered_files:
                    print(f"MAIN_DISPATCHER: Using file list with {len(filtered_files)} filtered files", file=sys.stderr)
            
            # Call Directory Deep analysis with filtered files
            try:
                directory_deep_main(filtered_files)
            except TypeError:
                # Fallback for older coordinators that don't accept filtered_files parameter
                if args.debug:
                    print("MAIN_DISPATCHER: Coordinator doesn't support filtered files, using legacy mode", file=sys.stderr)
                original_argv = sys.argv
                sys.argv = ['livePanel_directory_deep_analysis_coordinator.py', args.file_path]
                try:
                    directory_deep_main()
                finally:
                    sys.argv = original_argv
                
        elif args.analysis_type == 'DirectoryXR':
            # Import and run Directory XR analysis
            sys.path.insert(0, str(script_dir))
            from xr_directory_analysis_coordinator import main as directory_xr_main
            
            if args.debug:
                print("MAIN_DISPATCHER: Launching Directory XR analysis...", file=sys.stderr)
            
            # Call Directory XR analysis with original sys.argv format, including output_dir if provided
            original_argv = sys.argv
            if args.output_dir:
                sys.argv = ['xr_directory_analysis_coordinator.py', args.file_path, args.output_dir]
            else:
                sys.argv = ['xr_directory_analysis_coordinator.py', args.file_path]
            try:
                directory_xr_main(filtered_files)
            finally:
                sys.argv = original_argv
                
        elif args.analysis_type == 'DirectoryXRDeep':
            # Import and run Directory XR Deep analysis  
            sys.path.insert(0, str(script_dir))
            from xr_directory_analysis_coordinator import main as directory_xr_main
            
            if args.debug:
                print("MAIN_DISPATCHER: Launching Directory XR Deep analysis...", file=sys.stderr)
            
            # Call Directory XR analysis with DEEP flag - add '--deep' argument
            original_argv = sys.argv
            if args.output_dir:
                sys.argv = ['xr_directory_analysis_coordinator.py', args.file_path, args.output_dir, '--deep']
            else:
                sys.argv = ['xr_directory_analysis_coordinator.py', args.file_path, '--deep']
            try:
                directory_xr_main(filtered_files)
            finally:
                sys.argv = original_argv
                
        elif args.analysis_type == 'FileReanalysis':
            # Import and run File Re-analysis (common for both LivePanel and XR)
            sys.path.insert(0, str(script_dir))
            from file_reanalysis_coordinator import main as file_reanalysis_main
            
            if args.debug:
                print("MAIN_DISPATCHER: Launching File Re-analysis...", file=sys.stderr)
            
            # Call File Re-analysis with original sys.argv format
            original_argv = sys.argv
            sys.argv = ['file_reanalysis_coordinator.py', args.file_path]
            try:
                file_reanalysis_main()
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
