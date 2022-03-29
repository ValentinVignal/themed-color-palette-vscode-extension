import { load } from 'js-yaml';
import * as vscode from 'vscode';
import { AnalyzeThemedContext, IThemedYaml } from './AnalyzeContext';
import { Globals } from './globals';
import { KeyRegExp } from './utils/KeyRegExp';


interface IGlobalYaml {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '.themed': IThemedYaml;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '.themes': string[];
}


/**
 * A document instance.
 */
export class DocumentInstance {
  /**
   * `true` if the document has been disposed.
   */
  private disposed: boolean = false;
  private text: string = '';
  private yaml: IGlobalYaml = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '.themed': {},
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '.themes': []
  };

  /**
   * All the diagnostics of the document.
   */
  private diagnostics: vscode.Diagnostic[] = [];

  constructor(
    public readonly document: vscode.TextDocument,
  ) {
    const listener = vscode.workspace.onDidChangeTextDocument(({ document }) => this.update(document));
  };

  /**
   * Returns the default theme.
   */
  private get defaultTheme(): string {
    return this.yaml['.themes'][0];
  }




  /**
   * To call when the document is being updated
   */
  update(document: vscode.TextDocument = this.document): void {
    if (this.disposed) {
      // Don't do anything if the instance has been disposed.
      return;
    }
    if (this.document.uri.toString() !== document.uri.toString()) {
      // Don't do anything if this is not the current instance.
      return;
    }

    // Cleat the state.
    this.diagnostics = [];
    Globals.diagnosticCollection.set(this.document.uri, this.diagnostics);

    this.text = this.document.getText();
    this.yaml = load(this.text) as IGlobalYaml;
    // TODO: Call analyze shared
    this.analyzeShared();

    const themedIndex = /^\.themed\:/gm.exec(this.text)!.index;  // Themed index.
    this.analyzeThemed(new AnalyzeThemedContext({
      index: themedIndex,
      yaml: this.yaml['.themed'],
      currentKey: '.themed',
      path: [],
    }));

    // Send the diagnostics to VSCode.
    Globals.diagnosticCollection.set(this.document.uri, this.diagnostics);
  }

  /**
   * To call when the document is being disposed.
   */
  dispose(): void {
    this.disposed = true;
    Globals.diagnosticCollection.set(this.document.uri, []);
  }

  /**
   * Analyzes the shared part of the document.
   */
  private analyzeShared(): void {


  }

  /**
   * Analyzes the themed part of the document.
   */
  private analyzeThemed(context: AnalyzeThemedContext): AnalyzeThemedContext['index'] {
    if (context.isCollection) {
      let index = context.index;
      for (const key in context.yaml) {
        if (key.startsWith('.')) {
          continue;
        }
        const keyRegExp = new KeyRegExp(key);
        const match = keyRegExp.exec(this.text.substring(index));
        const indexOffset = match!.index;
        // Updates the index to be sure to skip the all collection.
        index = this.analyzeThemed(new AnalyzeThemedContext({
          index: index + indexOffset,
          yaml: context.yaml[key],
          path: [...context.path, key],
        }));
      }
      return index;
    } else {
      const text = this.text.substring(context.index);
      if (!context.yaml.hasOwnProperty(this.defaultTheme)) {
        // The default theme is not specified.
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(
            ...this.keyPositionsFromIndex(context.index),
          ),
          `The default theme "${this.defaultTheme}" must be defined.`,
          vscode.DiagnosticSeverity.Error,
        );
        this.diagnostics.push(diagnostic);
      }

      // Once we are done with the object, we move to the context to the last key.
      const lastKeyRegExp = new KeyRegExp(context.lastKey);
      const match = lastKeyRegExp.exec(text)!;
      return match.index;
    }

  }

  /**
   * Returns the position corresponding to the index.
   */
  private keyPositionsFromIndex(index: number): [vscode.Position, vscode.Position] {
    const match = this.text.substring(0, index).match(/\r\n|\r|\n/g)!;
    const line = match.length;
    const keyMatch = this.text.substring(index).match(/[a-z][a-zA-z0-9]*/)!;

    return [
      new vscode.Position(line, keyMatch.index!),
      new vscode.Position(line, keyMatch.index! + keyMatch[0].length),
    ];
  }
}
