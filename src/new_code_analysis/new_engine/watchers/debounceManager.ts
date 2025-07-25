/**
 * Debounce Manager
 * Maneja el debounce timing para evitar múltiples ejecuciones rápidas
 * Incluye visualización en tiempo real en la barra de estado de VS Code
 */

import * as vscode from 'vscode';

export class DebounceManager {
    private timeoutId: NodeJS.Timeout | null = null;
    private progressIntervalId: NodeJS.Timeout | null = null;
    private isActive: boolean = false;
    private startTime: number = 0;
    private statusBarItem: vscode.StatusBarItem | null = null;

    constructor(
        private delayMs: number,
        private callback: () => Promise<void> | void,
        private targetFileName?: string
    ) {
        console.log(`DEBOUNCE_MANAGER: Created with delay ${delayMs}ms for ${targetFileName || 'unknown file'}`);
        
        // Crear item en la barra de estado
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left, 
            100
        );
    }

    /**
     * Inicia el debounce timer
     */
    public start(): void {
        console.log(`DEBOUNCE_MANAGER: Starting debounce timer for ${this.delayMs}ms`);
        
        // Cancelar timer previo si existe
        this.cancel();
        
        // Solo iniciar timer si hay delay
        if (this.delayMs > 0) {
            this.isActive = true;
            this.startTime = Date.now();
            
            // Mostrar indicador visual
            this.showProgressIndicator();
            
            this.timeoutId = setTimeout(async () => {
                console.log(`DEBOUNCE_MANAGER: Timer completed, executing callback`);
                this.cleanup();
                await this.callback();
            }, this.delayMs);
        } else {
            // Ejecutar inmediatamente si no hay delay
            console.log(`DEBOUNCE_MANAGER: No delay, executing immediately`);
            this.callback();
        }
    }

    /**
     * Cancela el debounce timer actual
     */
    public cancel(): void {
        if (this.timeoutId) {
            console.log(`DEBOUNCE_MANAGER: ❌ Cancelling active debounce timer`);
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.cleanup();
    }

    private cleanup(): void {
        this.isActive = false;
        
        // Limpiar indicador de progreso
        if (this.progressIntervalId) {
            clearInterval(this.progressIntervalId);
            this.progressIntervalId = null;
        }
        
        // Ocultar barra de estado
        if (this.statusBarItem) {
            this.statusBarItem.hide();
        }
    }

    private showProgressIndicator(): void {
        if (!this.statusBarItem) {
            return;
        }
        
        const fileName = this.targetFileName || 'files';
        
        // Actualizar cada 100ms para mostrar countdown
        this.progressIntervalId = setInterval(() => {
            const elapsed = Date.now() - this.startTime;
            const remaining = Math.max(0, this.delayMs - elapsed);
            
            if (remaining > 0) {
                const seconds = (remaining / 1000).toFixed(1);
                this.statusBarItem!.text = `$(clock) Analyzing ${fileName} in ${seconds}s`;
                this.statusBarItem!.tooltip = `Waiting for file changes to settle before re-analyzing`;
                this.statusBarItem!.show();
            } else {
                this.cleanup();
            }
        }, 100);
    }

    /**
     * Verifica si el debounce está activo
     */
    public isRunning(): boolean {
        return this.isActive;
    }

    /**
     * Obtiene el tiempo restante en ms
     */
    public getRemainingTime(): number {
        if (!this.isActive || !this.startTime) {
            return 0;
        }
        
        const elapsed = Date.now() - this.startTime;
        const remaining = Math.max(0, this.delayMs - elapsed);
        return remaining;
    }

    /**
     * Obtiene el estado actual del debounce
     */
    public getStatus(): DebounceStatus {
        return {
            isActive: this.isActive,
            remainingMs: this.getRemainingTime(),
            totalMs: this.delayMs
        };
    }

    /**
     * Actualiza el delay (útil si el usuario cambia la configuración)
     */
    public updateDelay(newDelayMs: number): void {
        console.log(`DEBOUNCE_MANAGER: 🔄 Updating delay from ${this.delayMs}ms to ${newDelayMs}ms`);
        this.delayMs = newDelayMs;
        
        // Si hay un timer activo, reiniciarlo con el nuevo delay
        if (this.isActive) {
            console.log(`DEBOUNCE_MANAGER: Restarting active timer with new delay`);
            this.start();
        }
    }

    /**
     * Limpia recursos al destruir el manager
     */
    public dispose(): void {
        console.log(`DEBOUNCE_MANAGER: 🧹 Disposing debounce manager`);
        this.cancel();
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
            this.statusBarItem = null;
        }
    }
}

/**
 * Interfaz para el estado del debounce
 */
export interface DebounceStatus {
    isActive: boolean;
    remainingMs: number;
    totalMs: number;
}

export default DebounceManager;
