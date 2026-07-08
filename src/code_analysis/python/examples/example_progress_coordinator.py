#!/usr/bin/env python3
"""
Example Progress Coordinator
Ejemplo de cómo usar el sistema de progreso en coordinadores Python
"""

import os
import sys
import time
import json
from pathlib import Path

# Import progress utilities
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'utils'))
from progress_logger import log_info, log_progress, set_total_files, log_debug, log_error, log_warning

def example_file_analysis_with_progress(files_to_analyze):
    """
    Ejemplo de análisis de múltiples archivos con progreso
    
    Args:
        files_to_analyze: Lista de rutas de archivos a analizar
    """
    
    # 1. Establecer el total de archivos
    total_files = len(files_to_analyze)
    set_total_files(total_files)
    
    log_info(f"Starting analysis of {total_files} files")
    
    results = []
    
    for i, file_path in enumerate(files_to_analyze, 1):
        file_name = os.path.basename(file_path)
        
        # 2. Reportar progreso al iniciar análisis del archivo
        log_progress(
            current=i,
            file_name=file_name,
            message=f"Analyzing file {i}/{total_files}",
            operation="File Analysis"
        )
        
        try:
            # Simular análisis (reemplazar con análisis real)
            log_debug(f"Processing {file_name}...")
            
            # Aquí iría el análisis real del archivo
            time.sleep(0.1)  # Simular trabajo
            
            # Ejemplo de resultado
            file_result = {
                "file_path": file_path,
                "file_name": file_name,
                "status": "success",
                "lines": 100,  # Ejemplo
                "functions": 5,  # Ejemplo
                "classes": 1     # Ejemplo
            }
            
            results.append(file_result)
            log_debug(f" Completed analysis of {file_name}")
            
        except Exception as e:
            log_error(f"Failed to analyze {file_name}: {str(e)}")
            
            file_result = {
                "file_path": file_path,
                "file_name": file_name,
                "status": "error",
                "error": str(e)
            }
            results.append(file_result)
    
    log_info(f"Analysis completed. Processed {len(results)} files")
    return results

def example_directory_analysis_with_progress(directory_path):
    """
    Ejemplo de análisis de directorio con progreso
    
    Args:
        directory_path: Ruta del directorio a analizar
    """
    
    log_info(f"Scanning directory: {directory_path}")
    
    # 1. Escanear archivos soportados
    supported_extensions = ['.py', '.js', '.ts', '.java', '.cpp', '.c', '.h']
    files_to_analyze = []
    
    try:
        for ext in supported_extensions:
            pattern = f"**/*{ext}"
            files = list(Path(directory_path).glob(pattern))
            files_to_analyze.extend([str(f) for f in files])
            
        log_info(f"Found {len(files_to_analyze)} files to analyze")
        
        if not files_to_analyze:
            log_warning("No supported files found in directory")
            return {"files": [], "summary": {"total_files": 0}}
        
        # 2. Analizar archivos con progreso
        analyzed_files = example_file_analysis_with_progress(files_to_analyze)
        
        # 3. Generar resumen
        successful_files = [f for f in analyzed_files if f.get("status") == "success"]
        failed_files = [f for f in analyzed_files if f.get("status") == "error"]
        
        summary = {
            "total_files": len(analyzed_files),
            "successful_files": len(successful_files),
            "failed_files": len(failed_files),
            "total_lines": sum(f.get("lines", 0) for f in successful_files),
            "total_functions": sum(f.get("functions", 0) for f in successful_files),
            "total_classes": sum(f.get("classes", 0) for f in successful_files)
        }
        
        log_info("Summary calculated successfully")
        
        return {
            "files": analyzed_files,
            "summary": summary
        }
        
    except Exception as e:
        log_error(f"Error during directory analysis: {str(e)}")
        raise

if __name__ == "__main__":
    # Ejemplo de uso
    if len(sys.argv) > 1:
        target_path = sys.argv[1]
        
        if os.path.isfile(target_path):
            log_info("Single file analysis example")
            result = example_file_analysis_with_progress([target_path])
        elif os.path.isdir(target_path):
            log_info("Directory analysis example")
            result = example_directory_analysis_with_progress(target_path)
        else:
            log_error(f"Invalid path: {target_path}")
            sys.exit(1)
            
        print("=== JSON_START ===")
        print(json.dumps(result, indent=2))
        print("=== JSON_END ===")
    else:
        log_error("Usage: python example_progress_coordinator.py <file_or_directory_path>")
