/**
 * Improved SSE Manager with Channel Support
 * Enhanced version using channel-based architecture for better SSE management
 */

import * as http from 'http';
import * as vscode from 'vscode';

/**
 * SSE Channel interface for better organization
 */
export interface SSEChannel {
    channelId: string;
    filePath: string;
    analysisType: string;
    clients: Set<http.ServerResponse>;
    isActive: boolean;
    createdAt: Date;
    lastUpdate: Date;
}

/**
 * SSE Event types
 */
export type SSEEventType = 
    | 'connection-established'
    | 'analysis-updated' 
    | 'analysis-error'
    | 'file-changed'
    | 'channel-closed';

/**
 * SSE Event data structure
 */
export interface SSEEvent {
    type: SSEEventType;
    channelId: string;
    timestamp: Date;
    data: any;
}

/**
 * Enhanced SSE Manager with Channel Support
 */
export class EnhancedSSEManager {
    private static instance: EnhancedSSEManager | null = null;
    private channels: Map<string, SSEChannel> = new Map();
    private channelsByFile: Map<string, Set<string>> = new Map(); // filePath -> channelIds

    private constructor() {
        console.log('[ENHANCED_SSE_MANAGER] Initializing enhanced SSE manager with channel support');
    }

    /**
     * Get the singleton instance
     */
    static getInstance(): EnhancedSSEManager {
        if (!EnhancedSSEManager.instance) {
            EnhancedSSEManager.instance = new EnhancedSSEManager();
        }
        return EnhancedSSEManager.instance;
    }

    /**
     * Create a new SSE channel for a file analysis
     */
    createChannel(filePath: string, analysisType: string): string {
        const channelId = this.generateChannelId(filePath, analysisType);
        
        console.log(`[ENHANCED_SSE_MANAGER] Creating SSE channel: ${channelId} for file: ${filePath}`);

        const channel: SSEChannel = {
            channelId,
            filePath,
            analysisType,
            clients: new Set(),
            isActive: true,
            createdAt: new Date(),
            lastUpdate: new Date()
        };

        this.channels.set(channelId, channel);

        // Update file -> channels mapping
        if (!this.channelsByFile.has(filePath)) {
            this.channelsByFile.set(filePath, new Set());
        }
        this.channelsByFile.get(filePath)!.add(channelId);

        console.log(`[ENHANCED_SSE_MANAGER] Channel created successfully: ${channelId}`);
        return channelId;
    }

    /**
     * Register a client to a specific SSE channel
     */
    registerClient(channelId: string, res: http.ServerResponse): boolean {
        const channel = this.channels.get(channelId);
        if (!channel || !channel.isActive) {
            console.error(`[ENHANCED_SSE_MANAGER] Channel not found or inactive: ${channelId}`);
            return false;
        }

        console.log(`[ENHANCED_SSE_MANAGER] Registering client to channel: ${channelId}`);

        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        });

        // Add client to channel
        channel.clients.add(res);
        channel.lastUpdate = new Date();

        // Send connection established event
        this.sendToClient(res, {
            type: 'connection-established',
            channelId,
            timestamp: new Date(),
            data: {
                filePath: channel.filePath,
                analysisType: channel.analysisType,
                clientCount: channel.clients.size
            }
        });

        // Set up cleanup when client disconnects
        res.on('close', () => {
            this.unregisterClient(channelId, res);
        });

        res.on('error', (error) => {
            console.error(`[ENHANCED_SSE_MANAGER] Client error for channel ${channelId}:`, error);
            this.unregisterClient(channelId, res);
        });

        console.log(`[ENHANCED_SSE_MANAGER] Client registered to channel: ${channelId}. Total clients: ${channel.clients.size}`);
        return true;
    }

    /**
     * Unregister a client from a channel
     */
    unregisterClient(channelId: string, res: http.ServerResponse): void {
        const channel = this.channels.get(channelId);
        if (!channel) {
            return;
        }

        channel.clients.delete(res);
        console.log(`[ENHANCED_SSE_MANAGER] Client unregistered from channel: ${channelId}. Remaining clients: ${channel.clients.size}`);

        // If no more clients, consider closing the channel
        if (channel.clients.size === 0) {
            console.log(`[ENHANCED_SSE_MANAGER] No clients remaining for channel: ${channelId}. Marking as inactive.`);
            channel.isActive = false;
        }
    }

    /**
     * Broadcast event to all clients in a channel
     */
    broadcastToChannel(channelId: string, event: Omit<SSEEvent, 'channelId'>): void {
        const channel = this.channels.get(channelId);
        if (!channel || !channel.isActive) {
            console.warn(`[ENHANCED_SSE_MANAGER] Cannot broadcast to inactive channel: ${channelId}`);
            return;
        }

        const fullEvent: SSEEvent = {
            ...event,
            channelId
        };

        console.log(`[ENHANCED_SSE_MANAGER] Broadcasting to channel ${channelId}: ${event.type} (${channel.clients.size} clients)`);

        for (const client of channel.clients) {
            this.sendToClient(client, fullEvent);
        }

        channel.lastUpdate = new Date();
    }

    /**
     * Broadcast event to all channels for a specific file
     */
    broadcastToFileChannels(filePath: string, event: Omit<SSEEvent, 'channelId'>): void {
        const channelIds = this.channelsByFile.get(filePath);
        if (!channelIds || channelIds.size === 0) {
            console.log(`[ENHANCED_SSE_MANAGER] No channels found for file: ${filePath}`);
            return;
        }

        console.log(`[ENHANCED_SSE_MANAGER] Broadcasting to ${channelIds.size} channels for file: ${filePath}`);

        for (const channelId of channelIds) {
            this.broadcastToChannel(channelId, event);
        }
    }

    /**
     * Close a specific channel
     */
    closeChannel(channelId: string): void {
        const channel = this.channels.get(channelId);
        if (!channel) {
            return;
        }

        console.log(`[ENHANCED_SSE_MANAGER] Closing channel: ${channelId}`);

        // Send close event to all clients
        const closeEvent: SSEEvent = {
            type: 'channel-closed',
            channelId,
            timestamp: new Date(),
            data: { reason: 'Channel closed by server' }
        };

        for (const client of channel.clients) {
            this.sendToClient(client, closeEvent);
            try {
                client.end();
            } catch (error) {
                console.error(`[ENHANCED_SSE_MANAGER] Error closing client connection:`, error);
            }
        }

        // Clean up mappings
        channel.isActive = false;
        channel.clients.clear();
        
        const fileChannels = this.channelsByFile.get(channel.filePath);
        if (fileChannels) {
            fileChannels.delete(channelId);
            if (fileChannels.size === 0) {
                this.channelsByFile.delete(channel.filePath);
            }
        }

        this.channels.delete(channelId);
        console.log(`[ENHANCED_SSE_MANAGER] Channel closed: ${channelId}`);
    }

    /**
     * Get channel information
     */
    getChannelInfo(channelId: string): SSEChannel | undefined {
        return this.channels.get(channelId);
    }

    /**
     * Get all active channels
     */
    getActiveChannels(): SSEChannel[] {
        return Array.from(this.channels.values()).filter(channel => channel.isActive);
    }

    /**
     * Get channels for a specific file
     */
    getChannelsForFile(filePath: string): SSEChannel[] {
        const channelIds = this.channelsByFile.get(filePath) || new Set();
        return Array.from(channelIds)
            .map(id => this.channels.get(id))
            .filter((channel): channel is SSEChannel => channel !== undefined && channel.isActive);
    }

    /**
     * Clean up inactive channels
     */
    cleanupInactiveChannels(): void {
        console.log(`[ENHANCED_SSE_MANAGER] Cleaning up inactive channels`);
        
        const inactiveChannels = Array.from(this.channels.values())
            .filter(channel => !channel.isActive || channel.clients.size === 0);

        for (const channel of inactiveChannels) {
            this.closeChannel(channel.channelId);
        }

        console.log(`[ENHANCED_SSE_MANAGER] Cleanup completed. Removed ${inactiveChannels.length} inactive channels`);
    }

    /**
     * Send event to a specific client
     */
    private sendToClient(res: http.ServerResponse, event: SSEEvent): void {
        try {
            const eventData = JSON.stringify(event);
            res.write(`data: ${eventData}\n\n`);
        } catch (error) {
            console.error(`[ENHANCED_SSE_MANAGER] Error sending event to client:`, error);
        }
    }

    /**
     * Generate unique channel ID
     */
    private generateChannelId(filePath: string, analysisType: string): string {
        const timestamp = Date.now();
        const fileName = filePath.split('/').pop() || 'unknown';
        return `${analysisType}_${fileName}_${timestamp}`;
    }
}
