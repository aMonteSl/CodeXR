/**
 * Shared command registration model used across the entire extension.
 *
 * Commands are declared as metadata and registered centrally from
 * `src/commands/index.ts` through CommandBuilder.
 */

export interface ExtensionCommandRegistration<TArgs extends any[] = any[]> {
    id: string;
    module: string;
    description: string;
    handler: (...args: TArgs) => Promise<void> | void;
    errorMessage?: string;
    silentErrors?: boolean;
}

export function assertUniqueCommandIds(registrations: ExtensionCommandRegistration[]): void {
    const seen = new Map<string, string>();

    for (const registration of registrations) {
        const existingModule = seen.get(registration.id);
        if (existingModule) {
            throw new Error(
                `Duplicate command registration detected for "${registration.id}" ` +
                `between "${existingModule}" and "${registration.module}"`,
            );
        }

        seen.set(registration.id, registration.module);
    }
}
