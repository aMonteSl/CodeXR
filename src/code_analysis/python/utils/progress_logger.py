#!/usr/bin/env python3
"""
Progress Logger Utility
Utilidad para enviar mensajes de progreso desde scripts Python a executePython.ts
"""

import sys
import json

class ProgressLogger:
    """
    Clase para enviar mensajes de progreso estructurados via stderr
    que serán capturados por executePython.ts
    """
    
    def __init__(self):
        self.current = 0
        self.total = 0
        
    def set_total(self, total: int):
        """Establece el total de elementos a procesar"""
        self.total = total
        
    def log_progress(self, 
                    current: int = None, 
                    file_name: str = None,
                    message: str = None,
                    operation: str = None,
                    estimated_time: str = None):
        """
        Envía un mensaje de progreso estructurado
        
        Args:
            current: Elemento actual (opcional, se auto-incrementa si no se proporciona)
            file_name: Nombre del archivo actual
            message: Mensaje descriptivo
            operation: Operación actual
            estimated_time: Tiempo estimado restante
        """
        if current is not None:
            self.current = current
        else:
            self.current += 1
            
        percentage = int((self.current / self.total * 100)) if self.total > 0 else 0
        
        progress_data = {
            "progress": {
                "current": self.current,
                "total": self.total,
                "percentage": percentage,
                "message": message or f"Processing {self.current}/{self.total}",
                "fileName": file_name,
            }
        }
        
        if operation:
            progress_data["progress"]["operation"] = operation
        if estimated_time:
            progress_data["progress"]["estimatedTime"] = estimated_time
            
        # Enviar via stderr como JSON
        print(json.dumps(progress_data), file=sys.stderr, flush=True)
        
    def log_info(self, message: str):
        """Envía un mensaje informativo"""
        info_data = {"info": message}
        print(json.dumps(info_data), file=sys.stderr, flush=True)
        
    def log_warning(self, message: str):
        """Envía un mensaje de advertencia"""
        warning_data = {"warning": message}
        print(json.dumps(warning_data), file=sys.stderr, flush=True)
        
    def log_error(self, message: str):
        """Envía un mensaje de error"""
        error_data = {"error": message}
        print(json.dumps(error_data), file=sys.stderr, flush=True)
        
    def log_debug(self, message: str):
        """Envía un mensaje de debug"""
        debug_data = {"debug": message}
        print(json.dumps(debug_data), file=sys.stderr, flush=True)

# Instancia global para uso fácil
progress_logger = ProgressLogger()

def log_progress(current: int = None, 
                file_name: str = None,
                message: str = None,
                operation: str = None,
                estimated_time: str = None):
    """Función de conveniencia para logging de progreso"""
    progress_logger.log_progress(current, file_name, message, operation, estimated_time)

def set_total_files(total: int):
    """Función de conveniencia para establecer total"""
    progress_logger.set_total(total)

def log_info(message: str):
    """Función de conveniencia para logging de info"""
    progress_logger.log_info(message)

def log_warning(message: str):
    """Función de conveniencia para logging de warning"""
    progress_logger.log_warning(message)

def log_error(message: str):
    """Función de conveniencia para logging de error"""
    progress_logger.log_error(message)

def log_debug(message: str):
    """Función de conveniencia para logging de debug"""
    progress_logger.log_debug(message)
