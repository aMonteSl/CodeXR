/**
 * SSE Notification Manager
 * Maneja las notificaciones SSE para sesiones de análisis
 */

import { SessionServerInfo, SSENotification } from './models/sessionServerModels';
import { SSEManager } from '../../../servers/runtime/sse/SSEManager';

export class SSENotificationManager {

    constructor() {
        console.log('SSE_NOTIFICATION_MANAGER: Initializing SSE manager');
    }    /**
     * Notifica que un servidor ha sido iniciado
     */
    async notifyServerStarted(sessionInfo: SessionServerInfo): Promise<void> {
        try {
            console.log(`SSE_NOTIFICATION_MANAGER: Notifying server started for session ${sessionInfo.sessionId}`);

            const notification: SSENotification = {
                type: 'server-started',
                sessionId: sessionInfo.sessionId,
                timestamp: new Date(),
                data: {
                    port: sessionInfo.port,
                    serverUrl: sessionInfo.serverUrl,
                    targetPath: sessionInfo.targetPath
                }
            };

            await this.sendSSENotification(notification);

        } catch (error) {
            console.error(`SSE_NOTIFICATION_MANAGER: Error notifying server started:`, error);
        }
    }

    /**
     * Notifica que un servidor ha sido detenido
     */
    async notifyServerStopped(sessionInfo: SessionServerInfo): Promise<void> {
        try {
            console.log(`SSE_NOTIFICATION_MANAGER: Notifying server stopped for session ${sessionInfo.sessionId}`);

            const notification: SSENotification = {
                type: 'server-stopped',
                sessionId: sessionInfo.sessionId,
                timestamp: new Date(),
                data: {
                    port: sessionInfo.port,
                    targetPath: sessionInfo.targetPath
                }
            };

            await this.sendSSENotification(notification);

        } catch (error) {
            console.error(`SSE_NOTIFICATION_MANAGER: Error notifying server stopped:`, error);
        }
    }

    /**
     * Notifica que el análisis ha sido actualizado
     */
    async notifyAnalysisUpdated(sessionInfo: SessionServerInfo): Promise<void> {
        try {
            console.log(`SSE_NOTIFICATION_MANAGER: Notifying analysis updated for session ${sessionInfo.sessionId}`);

            const notification: SSENotification = {
                type: 'analysis-updated',
                sessionId: sessionInfo.sessionId,
                timestamp: new Date(),
                data: {
                    port: sessionInfo.port,
                    serverUrl: sessionInfo.serverUrl,
                    targetPath: sessionInfo.targetPath
                }
            };

            await this.sendSSENotification(notification);

        } catch (error) {
            console.error(`SSE_NOTIFICATION_MANAGER: Error notifying analysis updated:`, error);
        }
    }

    /**
     * Notifica que un archivo ha cambiado
     */
    async notifyFileChanged(sessionInfo: SessionServerInfo, changedFile: string): Promise<void> {
        try {
            console.log(`SSE_NOTIFICATION_MANAGER: Notifying file changed for session ${sessionInfo.sessionId}`);

            const notification: SSENotification = {
                type: 'file-changed',
                sessionId: sessionInfo.sessionId,
                timestamp: new Date(),
                data: {
                    port: sessionInfo.port,
                    targetPath: sessionInfo.targetPath,
                    changedFile
                }
            };

            await this.sendSSENotification(notification);

        } catch (error) {
            console.error(`SSE_NOTIFICATION_MANAGER: Error notifying file changed:`, error);
        }
    }

    /**
     * Envía una notificación SSE a todos los clientes conectados
     */
    private async sendSSENotification(notification: SSENotification): Promise<void> {
        try {
            console.log(`SSE_NOTIFICATION_MANAGER: Sending SSE notification:`, {
                type: notification.type,
                sessionId: notification.sessionId,
                timestamp: notification.timestamp
            });

            // Obtener el SSEManager real
            const sseManager = SSEManager.getInstance();
            
            // Para sesiones de análisis, usar el targetPath como identificador SSE
            const targetPath = notification.data?.targetPath;
            
            if (targetPath) {
                console.log(`SSE_NOTIFICATION_MANAGER: Sending to clients of: ${targetPath}`);
                
                // Crear el mensaje SSE en el formato esperado por el cliente
                const sseMessage = {
                    type: notification.type,
                    fileUri: targetPath,
                    sessionId: notification.sessionId,
                    timestamp: notification.timestamp,
                    data: notification.data
                };
                
                // Enviar usando el SSEManager real
                sseManager.sendCustomMessage(targetPath, sseMessage);
                
                console.log(`SSE_NOTIFICATION_MANAGER: ✅ SSE notification sent successfully to ${targetPath}`);
            } else {
                console.warn(`SSE_NOTIFICATION_MANAGER: ⚠️ No targetPath found in notification data`);
            }

        } catch (error) {
            console.error(`SSE_NOTIFICATION_MANAGER: ❌ Error sending SSE notification:`, error);
            throw error;
        }
    }
}

export default SSENotificationManager;
