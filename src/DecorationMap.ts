import * as vscode from 'vscode';
import { Color } from './AnalyzeContext';

export class DecorationsMap {
  private map = new Map<Color, vscode.TextEditorDecorationType>();


  /**
   * Returns the {@link vscode.TextEditorDecorationType} associated to the color
   * {@link color}.
   */
  get(color: string): vscode.TextEditorDecorationType {
    if (this.map.has(color)) { return this.map.get(color)!; }

    const red = parseInt(color.substring(2, 4), 16);
    const green = parseInt(color.substring(4, 6), 16);
    const blue = parseInt(color.substring(6, 8), 16);
    const rgba = '#' + color.substring(2) + color.substring(0, 2);
    const isLight = DecorationsMap.isColorLight(red, green, blue);
    const colorContrast = isLight ? '#000000ff' : '#ffffffff';
    const decorationType = vscode.window.createTextEditorDecorationType(
      {
        backgroundColor: rgba,
        color: colorContrast,
        border: `3px solid ${color}`,
        borderRadius: '3px',
        before: {
          contentText: ' ',
          margin: '0.1em 0.2em 0 0.2em',
          width: '0.8em',
          height: '0.8em',
          backgroundColor: rgba,
          border: `1px solid ${colorContrast}`,
        },
        overviewRulerColor: rgba,
      },
    );
    this.map.set(color, decorationType);
    return decorationType;
  }

  /**
   * Returns true if the color is light, false if it is dark.
   */
  private static isColorLight(red: number, green: number, blue: number): boolean {

    const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
    return brightness > 125;
  }

  dispose(): void {
    for (const decorationType of this.map.values()) {
      decorationType.dispose();
    }
  }

}
