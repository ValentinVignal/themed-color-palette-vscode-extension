import * as vscode from 'vscode';
import { Color } from './AnalyzeContext';

export class DecorationsMap {
  private singleColorMap = new Map<Color, vscode.TextEditorDecorationType>();
  private multipleColorsMap = new Map<Color, vscode.TextEditorDecorationType[]>();


  /**
   * Returns the {@link vscode.TextEditorDecorationType} associated to the color
   * {@link color}.
   */
  getSingleColor(color: string): vscode.TextEditorDecorationType | null {
    if (this.singleColorMap.has(color)) { return this.singleColorMap.get(color)!; }

    const colorAndContrast = DecorationsMap.getColorAndColorContrast(color);
    if (colorAndContrast === null) {
      return null;
    }
    const decorationType = vscode.window.createTextEditorDecorationType(
      {
        backgroundColor: colorAndContrast.color,
        color: colorAndContrast.contrast,
        border: `3px solid ${colorAndContrast.color}`,
        borderRadius: '3px',
        before: {
          contentText: ' ',
          margin: '0.1em 0.2em 0 0.2em',
          width: '0.8em',
          height: '0.8em',
          backgroundColor: colorAndContrast.color,
          border: `1px solid ${colorAndContrast.contrast}`,
        },
        overviewRulerColor: colorAndContrast.color,
      },
    );
    this.singleColorMap.set(color, decorationType);
    return decorationType;
  }

  /**
   * 
   * @param colors the colors separated with a `','`.
   */
  getMultipleColors(colors: string): vscode.TextEditorDecorationType[] {
    if (this.multipleColorsMap.has(colors)) {
      return this.multipleColorsMap.get(colors)!;
    }
    const colorList = colors.split(',');
    const decorationTypes: vscode.TextEditorDecorationType[] = [];
    for (const color of colorList) {
      const colorAndContrast = DecorationsMap.getColorAndColorContrast(color);
      if (colorAndContrast !== null) {
        decorationTypes.push(vscode.window.createTextEditorDecorationType(
          {
            after: {
              contentText: ' ',
              margin: '0.1em 0.2em 0 0.2em',
              width: '0.8em',
              height: '0.8em',
              backgroundColor: colorAndContrast!.color,
              border: `1px solid ${colorAndContrast!.contrast}`,
            },
          },
        ));
      }

    }
    this.multipleColorsMap.set(colors, decorationTypes);
    return decorationTypes;
  }

  /**
   * 
   * @param color The string color representation.
   * @returns The color and its contrast to use for html.
   */
  static getColorAndColorContrast(color: Color): { color: Color, contrast: Color } | null {
    try {
      const red = parseInt(color.substring(2, 4), 16);
      const green = parseInt(color.substring(4, 6), 16);
      const blue = parseInt(color.substring(6, 8), 16);
      const rgba = '#' + color.substring(2) + color.substring(0, 2);
      const isLight = DecorationsMap.isColorLight(red, green, blue);
      const colorContrast = isLight ? '#000000ff' : '#ffffffff';
      return {
        color: rgba,
        contrast: colorContrast,
      };
    } catch {
      return null;
    }

  }

  /**
   * Returns true if the color is light, false if it is dark.
   */
  private static isColorLight(red: number, green: number, blue: number): boolean {

    const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
    return brightness > 125;
  }

  dispose(): void {
    for (const decorationType of this.singleColorMap.values()) {
      decorationType.dispose();
    }
    for (const decorationTypes of this.multipleColorsMap.values()) {
      for (const decorationType of decorationTypes) {
        decorationType.dispose();
      }
    }
  }

}
