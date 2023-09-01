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
  },
  MarkdownString: jest.fn(),
  Hover: jest.fn(),
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
      mockVSCode.languages.createDiagnosticCollection.mockImplementation(() => {
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

    it('should provide a hover', () => {
      const yaml: IGlobalYaml = {
        '.themes': [
          'light',
          'dark',
        ],
        '.shared': {},
        '.themed': {
          color: {
            '.type': 'color',
            light: 'ffffffff',
            dark: 'ff000000',
          }
        }
      };
      const text = dump(yaml);
      const textDocument: Partial<vscode.TextDocument> = {
        uri: {} as vscode.Uri,
        getText: () => text,
        positionAt: jest.fn(),
      };
      const documentInstance = new DocumentInstance(
        textDocument as vscode.TextDocument,
      );
      const mockDiagnosticCollection: Partial<vscode.DiagnosticCollection> = {
        set: jest.fn(),
      };
      // mockVSCode.languages.createDiagnosticCollection.mockReturnValue(mockDiagnosticCollection as vscode.DiagnosticCollection);
      mockVSCode.languages.createDiagnosticCollection.mockImplementation(() => {
        return mockDiagnosticCollection as vscode.DiagnosticCollection;
      });
      (textDocument.positionAt! as jest.Mock).mockReturnValue({ line: 0 });

      const mockRange = {
        contains: (position: vscode.Position) => {
          if (position.line === 0) {
            return false;
          }
          else {
            return true;
          }
        }
      };

      mockVSCode.Range.mockImplementation(() => {
        return mockRange;
      });

      documentInstance.update(textDocument as vscode.TextDocument);

      expect(documentInstance.provideHover({ line: 0 } as vscode.Position)).toBeNull();
      expect(documentInstance.provideHover({ line: 1 } as vscode.Position)).not.toBeNull();

      expect(mockVSCode.MarkdownString).toHaveBeenCalledTimes(1);
      expect(mockVSCode.MarkdownString).toBeCalledWith(`<ul>
<li><b>light</b>: <span style="color:#000000ff;background-color:#ffffffff;">#ffffffff</span></li>
<li><b>dark</b>: <span style="color:#ffffffff;background-color:#000000ff;">#ff000000</span></li>
</ul>`
      );
      expect(mockVSCode.Hover).toHaveBeenCalledTimes(1);
    });
  });
});
