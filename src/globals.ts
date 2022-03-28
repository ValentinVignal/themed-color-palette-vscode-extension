
import * as vscode from 'vscode';

export const diagnosticCollection = vscode.languages.createDiagnosticCollection('themed-yaml');

export const colorRegExp = /\b[a-f0-9]{8}\b/g;

export const camelCaseRegExp = /[a-z][a-zA-Z0-9]*/g;
