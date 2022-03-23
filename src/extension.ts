// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { load } from 'js-yaml';
import * as vscode from 'vscode';

const pattern = new RegExp(/\b[a-z0-9]{8}\b/);

let activeEditor: vscode.TextEditor | undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('how are you2');

  vscode.window.onDidChangeActiveTextEditor(function (editor) {
    activeEditor = editor;
    if (editor) {
      displayColorDecoration(context);
    }
  }, null, context.subscriptions);

  console.log('again');

  vscode.workspace.onDidChangeTextDocument(function (event) {
    if (activeEditor && event.document === activeEditor.document) {
      displayColorDecoration(context);
    }
  }, null, context.subscriptions);

  displayColorDecoration(context);
  // command

}

// this method is called when your extension is deactivated
export function deactivate() { }


function displayColorDecoration(context: vscode.ExtensionContext): void {
  console.log('here');
  if (!activeEditor || !activeEditor.document) {
    return;
  }
  const text = activeEditor.document.getText();

  const yaml = load(text) as {};
  console.log('yaml', yaml);

  for (const key in yaml) {
    console.log('key', key);
  }

  const matches = pattern.exec(text) ?? [];

  console.log('text', text.length);

  for (const match of matches) {
    console.log('match', match);

  }

}
