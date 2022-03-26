import { load } from 'js-yaml';
import * as vscode from 'vscode';

const pattern = new RegExp(/\b[a-z0-9]{8}\b/);

let activeEditor: vscode.TextEditor | undefined;

let timeout: NodeJS.Timeout | null = null;


export function activate(context: vscode.ExtensionContext) {

  activeEditor = vscode.window.activeTextEditor;

  vscode.window.onDidChangeActiveTextEditor(function (editor) {
    activeEditor = editor;
    if (editor) {
      trigger(context);
    }
  }, null, context.subscriptions);


  vscode.workspace.onDidChangeTextDocument(function (event) {
    if (activeEditor && event.document === activeEditor.document) {
      trigger(context);
    }
  }, null, context.subscriptions);

  trigger(context);

}

export function deactivate() {
  if (timeout !== null) {
    clearTimeout(timeout);
  }
}

function trigger(context: vscode.ExtensionContext) {
  if (timeout !== null) {
    clearTimeout(timeout);
  }
  timeout = setTimeout(() => {
    displayColorDecoration(context);
  }, 0);
}

const colorRegExp = /\b[a-f0-9]{8}\b/g;

function displayColorDecoration(context: vscode.ExtensionContext): void {
  if (!activeEditor || !activeEditor.document) {
    return;
  }
  const text = activeEditor.document.getText();

  const matches = text.matchAll(colorRegExp);
  console.log('matches', matches);
  for (const match of matches) {
    const matchText = match[0];
    const startPosition = activeEditor.document.positionAt(match.index!);
    const endPosition = activeEditor.document.positionAt(match.index! + matchText.length);
    const decoration = {
      range: new vscode.Range(startPosition, endPosition),
    };
    const red = parseInt(matchText.substring(2, 4), 16);
    const green = parseInt(matchText.substring(4, 6), 16);
    const blue = parseInt(matchText.substring(6, 8), 16);
    const rgba = '#' + matchText.substring(2) + matchText.substring(0, 2);
    const isLight = isColorLight(red, green, blue);
    const decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: rgba,
      color: isLight ? '#000000ff' : '#ffffffff',
      before: {
        contentText: ' ',
        margin: '0.1em 0.2em 0 0.2em',
        width: '0.7em',
        height: '0.7em',
        backgroundColor: rgba,
      },
      overviewRulerColor: rgba,
    });


    activeEditor.setDecorations(decorationType, [decoration]);
  }

  const yaml = load(text) as {};


}


/**
 * Returns true if the color is light, false if it is dark.
 */
function isColorLight(red: number, green: number, blue: number): boolean {

  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 125;
}

