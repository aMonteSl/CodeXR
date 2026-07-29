import { EventEmitter } from 'events';

export interface AnalysisDataUpdatedEvent {
    sessionId: string;
    targetPath: string;
    updatedAt: string;
}

class AnalysisUpdateEvents {
    private readonly emitter = new EventEmitter();

    public emit(event: AnalysisDataUpdatedEvent): void {
        this.emitter.emit('analysis-data-updated', event);
    }

    public on(listener: (event: AnalysisDataUpdatedEvent) => void): () => void {
        this.emitter.on('analysis-data-updated', listener);
        return () => this.emitter.off('analysis-data-updated', listener);
    }
}

export const analysisUpdateEvents = new AnalysisUpdateEvents();
