import { load } from 'js-yaml';
import * as vscode from 'vscode';
import { AnalyzeContext, Color, IImportedValue, IItemYaml, IThemedCollectionYaml } from './AnalyzeContext';
import { DecorationsMap } from './DecorationMap';
import { Globals } from './globals';
import { ImportedSharedValue, ImportedThemedValue, ImportedValue } from './ImportedValue';
import { KeyRegExp } from './utils/KeyRegExp';


interface IGlobalYaml {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '.themes': string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '.platforms': string[] | undefined;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '.shared': IThemedCollectionYaml;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '.themed': IThemedCollectionYaml;
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
    '.themes': [],
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '.platforms': [],
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '.shared': {},
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '.themed': {},
  };

  /**
   * All the diagnostics of the document.
   */
  private diagnostics: vscode.Diagnostic[] = [];
  private listener: vscode.Disposable | null = null;
  private decorations = new DecorationsMap();
  private rangeMap = new Map<Color, vscode.Range[]>();
  /**
   * The map of imported values.
   */
  private values = new Map<string, ImportedValue>();

  constructor(
    public readonly document: vscode.TextDocument,
  ) {
    this.listener = vscode.workspace.onDidChangeTextDocument(({ document }) => this.update(document));
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
    for (const color of this.rangeMap.keys()) {
      // The empty array will remove the decoration of a removed color in the editor.setDecorations below.
      this.rangeMap.set(color, []);
    }
    this.values.clear();

    this.text = this.document.getText();
    this.yaml = load(this.text) as IGlobalYaml;


    const sharedIndex = /^\.shared\:/gm.exec(this.text)!.index;  // Shared index.
    this.analyze(new AnalyzeContext(
      {
        index: sharedIndex,
        yaml: this.yaml['.shared'],
        path: ['.shared'],
        platforms: this.yaml['.platforms'] ?? [],
      }

    ));

    const themedIndex = /^\.themed\:/gm.exec(this.text)!.index;  // Themed index.
    this.analyze(new AnalyzeContext({
      index: themedIndex,
      yaml: this.yaml['.themed'],
      path: [],
      platforms: this.yaml['.platforms'] ?? [],
    }));

    // Send the diagnostics to VSCode.
    Globals.diagnosticCollection.set(this.document.uri, this.diagnostics);
    for (const editor of vscode.window.visibleTextEditors.filter(editor => editor.document.uri === this.document.uri)) {
      for (const color of this.rangeMap.keys()) {
        const ranges = this.rangeMap.get(color)!;
        editor.setDecorations(this.decorations.get(color), ranges);
      }
    }
    for (const color of this.rangeMap.keys()) {
      const ranges = this.rangeMap.get(color)!;
      if (!ranges.length) {
        this.rangeMap.delete(color);
      }
    }

  }

  /**
   * To call when the document is being disposed.
   */
  dispose(): void {
    this.disposed = true;
    this.listener?.dispose();
    this.listener = null;
    this.decorations.dispose();
    Globals.diagnosticCollection.set(this.document.uri, []);
  }


  /**
   * Analyzes the themed part of the document.
   */
  private analyze(context: AnalyzeContext): AnalyzeContext['index'] {

    this.verifyPlatforms(context);

    if (context.isCollection) {
      let index = context.index;
      for (const key in context.yaml) {
        if (key.startsWith('.')) {
          continue;
        }

        const keyRegExp = new KeyRegExp(key);
        const match = keyRegExp.exec(this.text.substring(index))!;
        const indexOffset = match.index;

        // Updates the index to be sure to skip the all collection.
        index = this.analyze(new AnalyzeContext({
          index: index + indexOffset,
          yaml: (context.yaml as IThemedCollectionYaml)[key]!,
          path: [...context.path, key],
          platforms: context.yaml['.platforms'] ?? context.platforms,
        }));
      }
      return index;
    } else {
      const text = this.text.substring(context.index);

      if (!context.isShared) {
        this.verifyDefaultTheme(context);
        this.verifyThemeExistence(context);
      }
      this.registerValue(context);
      this.addDecorationIfColor(context);



      // Once we are done with the object, we move to the context to the last
      // key.
      const lastKeyRegExp = new KeyRegExp(context.lastKey);
      const match = lastKeyRegExp.exec(text)!;
      return context.index + match.index;
    }
  }

  /**
   * Register the value and verifies the imports.
   */
  private registerValue(context: AnalyzeContext): void {
    const yaml = context.yaml as IItemYaml;
    for (const key of DocumentInstance.getValueKeys(yaml, context.isShared)) {
      let index = context.index;
      if (typeof yaml[key] === 'object') {
        const importPath = (yaml[key] as any as IImportedValue)['import'];
        if (!importPath) {
          console.log('yaml', yaml);
          continue;
        }
        const diagnosticMessages: string[] = [];
        if (!this.values.has(importPath)) {
          diagnosticMessages.push(`The value \`${importPath}\` does not exist. Make sure the item has been defined ABOVE in the file.`);
        } else {
          const importedValue = this.values.get(importPath)!;
          if (importedValue.type !== yaml['.type']) {
            diagnosticMessages.push(`The value \`${importPath}\` is not of type \`${yaml['.type']}\` but \`${importedValue.type}\`.`);
          }
        }
        const keyRegExp = new KeyRegExp(key);
        const match = keyRegExp.exec(this.text.substring(index))!;
        index += match.index;
        index += this.text.substring(index).indexOf(importPath);
        const position = this.document.positionAt(index);
        for (const diagnosticMessage of diagnosticMessages) {
          this.diagnostics.push(new vscode.Diagnostic(
            new vscode.Range(
              position,
              new vscode.Position(position.line, position.character + importPath.length)
            ),
            diagnosticMessage,
            vscode.DiagnosticSeverity.Error
          ));
        }

      }
      let value: ImportedValue | undefined;
      if (context.isShared) {
        value = new ImportedSharedValue(yaml['.type']);
      } else {
        value = new ImportedThemedValue(yaml['.type']);
      }
      this.values.set(context.pathKey, value);
    }
  }

  /**
   * Verifies the default theme is always specified in a themed item.
   */
  private verifyDefaultTheme(context: AnalyzeContext): void {
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
  }

  /**
   * Verifies that all specified themes of the themed item exist.
   */
  private verifyThemeExistence(context: AnalyzeContext): void {
    for (const key in context.yaml) {
      if (!key.startsWith('.')) {
        // It should be a themed key
        if (!this.yaml['.themes'].includes(key)) {
          // The theme does not exist.
          const keyRegExp = new KeyRegExp(key);
          const match = keyRegExp.exec(this.text.substring(context.index))!;
          const indexOffset = match.index;

          const diagnostic = new vscode.Diagnostic(
            new vscode.Range(
              ...this.keyPositionsFromIndex(context.index + indexOffset),
            ),
            `Unknown theme: "${key}".\nAll the themes must be defined in the \`.themes\` array.`,
            vscode.DiagnosticSeverity.Error,
          );
          this.diagnostics.push(diagnostic);
        }
      }
    }
  }

  /**
   * Check the specified platforms:
   * - Are valid and defined.
   * - Are included in the parent context.
   */
  private verifyPlatforms(context: AnalyzeContext): void {
    const platforms = context.yaml['.platforms'];
    if (platforms) {
      const definedPlatforms = this.yaml['.platforms'];
      const platformsRegExp = new KeyRegExp('.platforms');
      const platformsMatch = platformsRegExp.exec(this.text.substring(context.index))!;
      const platformsIndexOffset = platformsMatch.index;
      let currentIndex = context.index + platformsIndexOffset;
      for (const platform of platforms) {
        if (!definedPlatforms?.includes(platform)) {
          // The platform is valid and defined.
          currentIndex += this.text.substring(currentIndex).indexOf(platform);
          const position = this.document.positionAt(currentIndex);
          const diagnostic = new vscode.Diagnostic(
            new vscode.Range(
              position,
              new vscode.Position(position.line, position.character + platform.length),
            ),
            `Unknown platform: "${platform}".\nAll the platforms must be defined in the \`.platforms\` array.`,
            vscode.DiagnosticSeverity.Error,
          );
          this.diagnostics.push(diagnostic);
        } else if (!context.platforms.includes(platform)) {
          // The platform has been filtered out by a parent and can't be used.
          currentIndex += this.text.substring(currentIndex).indexOf(platform);
          const position = this.document.positionAt(currentIndex);
          const diagnostic = new vscode.Diagnostic(
            new vscode.Range(
              position,
              new vscode.Position(position.line, position.character + platform.length),
            ),
            `The platform "${platform}" is not accessible in \`${context.path.join('.')}\`.\nA parent collection must have filtered it out. Verify ${platform} was included in all the parent collections \`.platforms\` list.`,
            vscode.DiagnosticSeverity.Error,
          );
          this.diagnostics.push(diagnostic);
        }
      }
    }

  }

  private static getValueKeys(yaml: IItemYaml, isShared: boolean): (keyof IItemYaml)[] {
    if (isShared) {
      return ['.value' as keyof IItemYaml];
    } else {
      return Object.keys(yaml).filter(key => !key.startsWith('.')) as (keyof IItemYaml)[];
    }
  }

  private addDecorationIfColor(context: AnalyzeContext): void {
    const yaml = context.yaml as IItemYaml;
    if (yaml['.type'] === 'color') {
      let index = context.index;
      for (const key of DocumentInstance.getValueKeys(yaml, context.isShared)) {
        if ((typeof yaml[key]) !== 'string') {
          // The color is not hardcoded.
          // TODO: Support it
          continue;
        }

        // At this point, it the value should be a color of the form `aarrggbb`.
        const color = yaml[key] as Color;


        const themeRegExp = new KeyRegExp(key);
        const match = themeRegExp.exec(this.text.substring(index))!;
        index += match.index;
        index += this.text.substring(index).indexOf(color);
        const position = this.document.positionAt(index);

        const range = new vscode.Range(
          position,
          new vscode.Position(position.line, position.character + color.length),
        );
        if (!this.rangeMap.has(color)) {
          this.rangeMap.set(color, [range]);
        } else {
          this.rangeMap.get(color)!.push(range);
        }

      }
    }
  }

  /**
   * Returns the position corresponding to the index.
   */
  private keyPositionsFromIndex(index: number): [vscode.Position, vscode.Position] {
    // TODO: Maybe better to use `this.document.positionAt`.
    const match = this.text.substring(0, index).match(/\r\n|\r|\n/g)!;
    const line = match.length;
    const keyMatch = this.text.substring(index).match(/[a-z][a-zA-z0-9]*/)!;

    return [
      new vscode.Position(line, keyMatch.index!),
      new vscode.Position(line, keyMatch.index! + keyMatch[0].length),
    ];
  }




}
