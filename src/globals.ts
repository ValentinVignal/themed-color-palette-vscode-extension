
import * as vscode from 'vscode';



export class Globals {
  static readonly colorRegExp = /\b[a-f0-9]{8}\b/g;

  static readonly camelCaseRegExp = /[a-z][a-zA-Z0-9]*/g;

  private static _diagnosticCollection: vscode.DiagnosticCollection | undefined;

  static get diagnosticCollection(): vscode.DiagnosticCollection {
    if (!Globals._diagnosticCollection) {
      Globals._diagnosticCollection = vscode.languages.createDiagnosticCollection('themed-yaml');
    }
    return Globals._diagnosticCollection;
  }

}
