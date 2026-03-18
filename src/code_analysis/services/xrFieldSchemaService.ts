import * as vscode from 'vscode';
import { DimensionDataType } from '../../babia_templates/models/chartModels';
import { ExecutePython } from '../engine/utils/executePython';

export type XRSchemaTargetType = 'file' | 'directory';
export type XRFieldValueType = 'numeric' | 'text';

export interface XRFieldDefinition {
    id: string;
    label: string;
    description: string;
    valueType: XRFieldValueType;
}

export interface XRFieldSchema {
    schemaVersion: number;
    analysisMode: 'xr';
    targetType: XRSchemaTargetType;
    fields: XRFieldDefinition[];
}

export type XRFieldTypeMap = Record<string, XRFieldValueType>;

interface GetSchemaOptions {
    allowCacheFallback?: boolean;
    forceRefresh?: boolean;
}

export class XRFieldSchemaService {
    private static instance: XRFieldSchemaService | undefined;
    private static readonly CACHE_KEY_PREFIX = 'codeXR.analysis.xrFieldSchemaCache.v1';

    private readonly executePython: ExecutePython;
    private readonly memoryCache = new Map<XRSchemaTargetType, XRFieldSchema>();

    private constructor(private readonly context: vscode.ExtensionContext) {
        this.executePython = new ExecutePython(context);
    }

    public static getInstance(context: vscode.ExtensionContext): XRFieldSchemaService {
        if (!XRFieldSchemaService.instance) {
            XRFieldSchemaService.instance = new XRFieldSchemaService(context);
        }

        return XRFieldSchemaService.instance;
    }

    public async prefetchAll(): Promise<void> {
        await Promise.allSettled([
            this.getSchema('file', { allowCacheFallback: true, forceRefresh: true }),
            this.getSchema('directory', { allowCacheFallback: true, forceRefresh: true }),
        ]);
    }

    public async getSchema(
        targetType: XRSchemaTargetType,
        options: GetSchemaOptions = {},
    ): Promise<XRFieldSchema | undefined> {
        const allowCacheFallback = options.allowCacheFallback !== false;
        const forceRefresh = options.forceRefresh === true;

        if (!forceRefresh) {
            const cachedInMemory = this.memoryCache.get(targetType);
            if (cachedInMemory) {
                return cachedInMemory;
            }
        }

        try {
            const schema = await this.executePython.executeXRFieldSchema(targetType);
            if (this.isValidSchema(schema, targetType)) {
                await this.storeSchema(schema);
                return schema;
            }
        } catch (error) {
            console.warn(`XR_FIELD_SCHEMA: Failed to load live schema for ${targetType}:`, error);
        }

        if (!allowCacheFallback) {
            return undefined;
        }

        const cachedSchema = this.getCachedSchema(targetType);
        if (cachedSchema) {
            this.memoryCache.set(targetType, cachedSchema);
            return cachedSchema;
        }

        return undefined;
    }

    public async getFields(
        targetType: XRSchemaTargetType,
        allowCacheFallback: boolean = true,
    ): Promise<XRFieldDefinition[] | undefined> {
        const schema = await this.getSchema(targetType, { allowCacheFallback });
        return schema?.fields;
    }

    public async getFieldsForDataType(
        targetType: XRSchemaTargetType,
        dataType: DimensionDataType,
        allowCacheFallback: boolean = true,
    ): Promise<XRFieldDefinition[] | undefined> {
        const fields = await this.getFields(targetType, allowCacheFallback);
        if (!fields) {
            return undefined;
        }

        if (dataType === 'numeric') {
            return fields.filter((field) => field.valueType === 'numeric');
        }

        if (dataType === 'text') {
            return fields.filter((field) => field.valueType === 'text');
        }

        return fields;
    }

    public async getFieldTypeMap(
        targetType: XRSchemaTargetType,
        allowCacheFallback: boolean = true,
    ): Promise<XRFieldTypeMap | undefined> {
        const fields = await this.getFields(targetType, allowCacheFallback);
        if (!fields) {
            return undefined;
        }

        return Object.fromEntries(fields.map((field) => [field.id, field.valueType]));
    }

    private getCachedSchema(targetType: XRSchemaTargetType): XRFieldSchema | undefined {
        const value = this.context.globalState.get<XRFieldSchema>(this.getCacheKey(targetType));
        if (!value || !this.isValidSchema(value, targetType)) {
            return undefined;
        }

        return value;
    }

    private async storeSchema(schema: XRFieldSchema): Promise<void> {
        this.memoryCache.set(schema.targetType, schema);
        await this.context.globalState.update(this.getCacheKey(schema.targetType), schema);
    }

    private getCacheKey(targetType: XRSchemaTargetType): string {
        return `${XRFieldSchemaService.CACHE_KEY_PREFIX}.${targetType}`;
    }

    private isValidSchema(value: unknown, targetType: XRSchemaTargetType): value is XRFieldSchema {
        if (!value || typeof value !== 'object') {
            return false;
        }

        const schema = value as Partial<XRFieldSchema>;
        return schema.analysisMode === 'xr'
            && schema.targetType === targetType
            && typeof schema.schemaVersion === 'number'
            && Array.isArray(schema.fields)
            && schema.fields.every((field) => this.isValidField(field));
    }

    private isValidField(value: unknown): value is XRFieldDefinition {
        if (!value || typeof value !== 'object') {
            return false;
        }

        const field = value as Partial<XRFieldDefinition>;
        return typeof field.id === 'string'
            && typeof field.label === 'string'
            && typeof field.description === 'string'
            && (field.valueType === 'numeric' || field.valueType === 'text');
    }
}
