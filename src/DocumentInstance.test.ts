/* eslint-disable @typescript-eslint/naming-convention */
const mockVSCode = {
  workspace: {
    onDidChangeTextDocument: jest.fn(),
  },
  languages: {
    createDiagnosticCollection: jest.fn(),
  },
  window: {
    visibleTextEditors: [],
  }
};
jest.mock('vscode', () => mockVSCode);

import { dump } from 'js-yaml';
import * as vscode from 'vscode';
import { DocumentInstance } from './DocumentInstance';

describe('DocumentInstance', () => {
  beforeEach(() => {
    mockVSCode.window.visibleTextEditors = [];
  });
  it('should do work for a file with no values', () => {
    const yaml = {
      '.shared': {},
      '.themed': {}
    };
    const textDocument: Partial<vscode.TextDocument> = {
      uri: {} as vscode.Uri,
      getText: () => dump(yaml),
    };
    const documentInstance = new DocumentInstance(
      textDocument as vscode.TextDocument,
    );
    const mockDiagnosticCollection: Partial<vscode.DiagnosticCollection> = {
      set: jest.fn(),
    };
    mockVSCode.languages.createDiagnosticCollection.mockReturnValue(mockDiagnosticCollection as vscode.DiagnosticCollection);

    documentInstance.update(textDocument as vscode.TextDocument);


  });
});
