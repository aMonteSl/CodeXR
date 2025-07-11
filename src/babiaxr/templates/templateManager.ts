// Legacy file - stub for backward compatibility
// The main chart generation is now handled by src/analysis/xr/chartTemplates.ts

export async function processTemplate(context: any, chartSpec: any): Promise<{html: string, originalDataPath: string, isRemoteData: boolean}> {
  console.warn('Using deprecated template system');
  return {
    html: '<html><body>Deprecated chart system</body></html>',
    originalDataPath: '',
    isRemoteData: false
  };
}
