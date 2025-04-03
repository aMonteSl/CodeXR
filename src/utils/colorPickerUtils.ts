import * as vscode from 'vscode';
import { showColorPickerWebView } from './colorPickerWebView';

// Color presets with friendly names for quick selection
const COLOR_PRESETS = [
  { name: 'Dark Blue', hex: '#112233' },
  { name: 'Navy', hex: '#001f3f' },
  { name: 'Blue', hex: '#0074D9' },
  { name: 'Aqua', hex: '#7FDBFF' },
  { name: 'Teal', hex: '#39CCCC' },
  { name: 'Forest Green', hex: '#2ECC40' },
  { name: 'Lime', hex: '#01FF70' },
  { name: 'Yellow', hex: '#FFDC00' },
  { name: 'Orange', hex: '#FF851B' },
  { name: 'Red', hex: '#FF4136' },
  { name: 'Maroon', hex: '#85144b' },
  { name: 'Purple', hex: '#B10DC9' },
  { name: 'Gray', hex: '#AAAAAA' },
  { name: 'Silver', hex: '#DDDDDD' },
  { name: 'Black', hex: '#111111' },
  { name: 'White', hex: '#FFFFFF' }
];

/**
 * Shows a visual color picker
 * @param title Title for the picker
 * @param defaultColor Current color value in hex format
 * @returns Selected color in hex format, or undefined if canceled
 */
export async function showColorPicker(title: string, defaultColor: string): Promise<string | undefined> {
  return showColorPickerWebView(title, defaultColor);
}