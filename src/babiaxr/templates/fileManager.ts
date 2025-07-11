// Legacy file - stub for backward compatibility  
// The main chart generation is now handled by src/analysis/xr/chartTemplates.ts

export async function saveHtmlToFile(html: string, fileName: string, originalDataPath: string, isRemoteData: boolean): Promise<string | undefined> {
  console.warn('Using deprecated file save system');
  return undefined;
}