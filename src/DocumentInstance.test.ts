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
  },
  Position: jest.fn(),
  Range: jest.fn(),
  Diagnostic: jest.fn(),
  DiagnosticSeverity: {
    Error: 0,
  }
};
jest.mock('vscode', () => mockVSCode);

import { dump } from 'js-yaml';
import * as vscode from 'vscode';
import { DocumentInstance, IGlobalYaml } from './DocumentInstance';
import { Globals } from './globals';

describe('DocumentInstance', () => {
  beforeEach(() => {
    mockVSCode.window.visibleTextEditors = [];
    // @ts-ignore
    Globals._diagnosticCollection = undefined;
  });
  it('should work for a file with no values', () => {
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

  describe('.themes', () => {
    it('should add a diagnostic if a theme is not a string', () => {
      const yaml: IGlobalYaml = {
        '.themes': [
          'light',
          'dark',
          // @ts-ignore. This is to test a bad value.
          9,
        ],
        '.shared': {},
        '.themed': {}
      };
      const textDocument: Partial<vscode.TextDocument> = {
        uri: {} as vscode.Uri,
        getText: () => dump(yaml),
        positionAt: jest.fn(),
      };
      const documentInstance = new DocumentInstance(
        textDocument as vscode.TextDocument,
      );
      const mockDiagnosticCollection: Partial<vscode.DiagnosticCollection> = {
        set: jest.fn(),
      };
      // mockVSCode.languages.createDiagnosticCollection.mockReturnValue(mockDiagnosticCollection as vscode.DiagnosticCollection);
      mockVSCode.languages.createDiagnosticCollection.mockReset();
      mockVSCode.languages.createDiagnosticCollection.mockImplementation(() => {
        console.timeLog('in mock');
        return mockDiagnosticCollection as vscode.DiagnosticCollection;
      });
      (textDocument.positionAt! as jest.Mock).mockReturnValue({ line: 0 });
      mockVSCode.Diagnostic.mockImplementation((_: vscode.Range, message: string) => {
        return { message };
      });

      documentInstance.update(textDocument as vscode.TextDocument);

      // Once for the cleaning/reset at the beginning, and once for the error.
      expect(mockDiagnosticCollection.set).toHaveBeenCalledTimes(2);
      expect(mockDiagnosticCollection.set).toHaveBeenLastCalledWith(
        textDocument.uri,
        [
          { message: 'Bad theme type: "9".\nAll the themes must be either a string or an object with a single entry: `{$themeName: {import: $themeToImport}}`' },
        ]
      );
    });
  });
});
