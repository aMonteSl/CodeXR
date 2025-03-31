import * as vscode from 'vscode';
import { 
  ChartType, 
  BarChartOptions, 
  PieChartOptions 
} from '../models/chartModel';

/**
 * Collects chart-specific options based on chart type
 * @param chartType The type of chart
 * @returns Options object or undefined if cancelled
 */
export async function collectChartOptions(
  chartType: ChartType
): Promise<BarChartOptions | PieChartOptions | undefined> {
  switch (chartType) {
    case ChartType.BAR_CHART:
      return collectBarChartOptions();
    case ChartType.PIE_CHART:
      return collectPieChartOptions();
    default:
      return {};
  }
}

/**
 * Collects options specific to bar charts
 * @returns Bar chart options
 */
export async function collectBarChartOptions(): Promise<BarChartOptions | undefined> {
  // Ask for horizontal orientation
  const horizontalResponse = await vscode.window.showQuickPick(
    ['Vertical', 'Horizontal'],
    { placeHolder: 'Bar orientation' }
  );
  
  if (!horizontalResponse) return undefined;
  
  return {
    horizontal: horizontalResponse === 'Horizontal',
    height: 1,
    width: 2
  };
}

/**
 * Collects options specific to pie charts
 * @returns Pie chart options
 */
export async function collectPieChartOptions(): Promise<PieChartOptions | undefined> {
  // Ask for donut style
  const donutResponse = await vscode.window.showQuickPick(
    ['Standard Pie', 'Donut'],
    { placeHolder: 'Pie chart style' }
  );
  
  if (!donutResponse) return undefined;
  
  return {
    size: 1.5,
    height: 0.2,
    donut: donutResponse === 'Donut',
    showLabels: true
  };
}