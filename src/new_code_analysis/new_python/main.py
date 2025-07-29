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

# Import progress logging utilities
sys.path.append(os.path.join(os.path.dirname(__file__), 'utils'))
from progress_logger import log_info, log_progress, set_total_files, log_debug, log_error

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
    
    log_info(f"Starting analysis - Mode: {args.mode}, Type: {args.type}")
    log_info(f"Target: {args.target}")
    
    try:
        if args.mode == 'livePanel' and args.type == 'file':
            log_debug("Delegating to LivePanel file analysis...")
            result = execute_livepanel_file_analysis(args.target)
        elif args.mode == 'livePanel' and args.type == 'directory':
            log_debug("Delegating to LivePanel directory analysis...")
            result = execute_livepanel_directory_analysis(args.target, args.files, args.deep)
        elif args.mode == 'xr':
            log_debug("Delegating to XR analysis...")
            result = execute_xr_analysis(args.target, args.type, args.files)
        else:
            raise ValueError(f"Unsupported combination: {args.mode} + {args.type}")
        
        # Output result as JSON
        log_info("Analysis completed successfully")
        print("=== JSON_START ===")
        print(json.dumps(result, indent=2))
        print("=== JSON_END ===")
        
    except Exception as e:
        log_error(f"Error during analysis: {str(e)}")
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
    log_progress(message="Preparing file analysis", file_name=os.path.basename(target_file))
    set_total_files(1)  # Solo un archivo
    
    # Import the coordinator
    sys.path.append(os.path.join(os.path.dirname(__file__), 'livePanels'))
    
    try:
        from livePanel_file_analysis_coordinator import analyze_file_comprehensive
        
        log_progress(current=1, message="Analyzing file", file_name=os.path.basename(target_file))
        result = analyze_file_comprehensive(target_file)
        
        # Para livePanel, devolvemos directamente los datos sin wrapper
        return result
        
    except ImportError as e:
        log_error(f"Could not import coordinator: {e}")
        raise
    except Exception as e:
        log_error(f"Error in file analysis: {e}")
        raise

def execute_livepanel_directory_analysis(target_directory, files_to_analyze=None, deep_scan=False):
    """Execute LivePanel directory analysis using original coordinators"""
    try:
        log_progress(message="Preparing directory analysis", file_name=os.path.basename(target_directory))
        
        # Si tenemos lista específica de archivos, usar esa para el total
        if files_to_analyze:
            set_total_files(len(files_to_analyze))
            log_info(f"Analyzing {len(files_to_analyze)} specific files")
            log_debug(f"Sample filtered files: {[os.path.basename(f) for f in files_to_analyze[:5]]}")
        else:
            log_info("Scanning directory for supported files...")
            
        # Import the appropriate coordinator based on deep_scan flag
        sys.path.append(os.path.join(os.path.dirname(__file__), 'livePanels'))
        
        if deep_scan:
            log_debug("Using deep directory analysis coordinator")
            log_debug(f"🔧 MAIN.PY: Passing {len(files_to_analyze) if files_to_analyze else 0} filtered files to DEEP coordinator")
            from livePanel_directory_deep_analysis_coordinator import analyze_directory_deep_comprehensive
            result = analyze_directory_deep_comprehensive(target_directory, files_to_analyze)
        else:
            log_debug("Using standard directory analysis coordinator")
            log_debug(f"🔧 MAIN.PY: Passing {len(files_to_analyze) if files_to_analyze else 0} filtered files to STANDARD coordinator")
            from livePanel_directory_analysis_coordinator import analyze_directory_comprehensive
            result = analyze_directory_comprehensive(target_directory, files_to_analyze)
        
        return result
        
    except ImportError as e:
        log_error(f"Could not import directory coordinator: {e}")
        raise
    except Exception as e:
        log_error(f"Error in directory analysis: {e}")
        raise

def execute_xr_analysis(target_path, analysis_type, files_to_analyze=None):
    """Ejecuta análisis XR usando coordinador específico"""
    log_progress(message="Starting XR analysis", file_name=os.path.basename(target_path))
    
    # Import the XR coordinator
    sys.path.append(os.path.join(os.path.dirname(__file__), 'XR'))
    
    try:
        if analysis_type == 'file':
            set_total_files(1)  # Para archivos, siempre es 1
            log_debug("Using XR file analysis coordinator")
            from xr_file_analysis_coordinator import analyze_file_for_xr
            
            log_progress(current=1, message="Analyzing file for XR", file_name=os.path.basename(target_path))
            result = analyze_file_for_xr(target_path)
            
            # Para XR, devolvemos directamente los datos (array de funciones)
            log_info(f"XR file analysis completed. Generated {len(result) if isinstance(result, list) else 0} function records")
            return result
            
        elif analysis_type == 'directory':
            log_debug("Using XR directory analysis coordinator")
            from xr_directory_analysis_coordinator import analyze_directory_xr
            
            # Check if deep analysis is requested (from command line args)
            is_deep = '--deep' in sys.argv
            log_info(f"XR directory analysis (deep={is_deep}) for: {target_path}")
            
            # ✅ FIXED: Pass filtered files to XR analysis just like LivePanel does
            if files_to_analyze:
                log_info(f"Using filtered file list with {len(files_to_analyze)} files")
                set_total_files(len(files_to_analyze))
            else:
                log_info("Scanning directory for supported files...")
                
            result = analyze_directory_xr(target_path, is_deep=is_deep, filtered_files=files_to_analyze)
            
            # Para XR directorio, devolvemos directamente el array de archivos
            log_info(f"XR directory analysis completed. Generated {len(result) if isinstance(result, list) else 0} file records")
            return result
            
        else:
            raise ValueError(f"Unknown XR analysis type: {analysis_type}")
            
    except ImportError as e:
        log_error(f"Could not import XR coordinator: {e}")
        raise
    except Exception as e:
        log_error(f"Error in XR analysis: {e}")
        raise

if __name__ == "__main__":
    main()
