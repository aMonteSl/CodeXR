import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Template loading options
 */
export interface TemplateLoadOptions {
  /**
   * Variables to replace in the template
   */
  variables?: Record<string, string>;
  
  /**
   * Function to process the template after loading
   */
  postProcess?: (template: string) => string;
}

/**
 * Loads an HTML template from the templates directory
 * @param extensionUri Extension URI
 * @param templateName Template file name
 * @param options Template loading options
 * @returns The loaded template content
 */
export function loadTemplate(
  extensionUri: vscode.Uri,
  templateName: string,
  options: TemplateLoadOptions = {}
): string {
  try {
    // Get template path
    const templatePath = path.join(extensionUri.fsPath, 'templates', templateName);
    
    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }
    
    // Read template content
    let templateContent = fs.readFileSync(templatePath, 'utf-8');
    
    // Replace variables if provided
    if (options.variables) {
      templateContent = replaceVariables(templateContent, options.variables);
    }
    
    // Apply post-processing if provided
    if (options.postProcess) {
      templateContent = options.postProcess(templateContent);
    }
    
    return templateContent;
  } catch (error) {
    console.error(`Error loading template ${templateName}:`, error);
    throw error;
  }
}

/**
 * Replace variables in a template
 * @param template Template content
 * @param variables Variables to replace
 * @returns Processed template
 */
function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  
  // Replace each variable
  for (const [key, value] of Object.entries(variables)) {
    // Use regex to replace all occurrences of ${key}
    const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
    result = result.replace(regex, value);
  }
  
  return result;
}

/**
 * Save a template to a file
 * @param content Template content
 * @param filePath Path to save the file
 */
export async function saveTemplate(content: string, filePath: string): Promise<void> {
  try {
    // Ensure directory exists
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (error) {
    console.error(`Error saving template to ${filePath}:`, error);
    throw error;
  }
}