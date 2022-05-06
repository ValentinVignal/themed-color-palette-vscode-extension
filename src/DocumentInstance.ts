import { load } from 'js-yaml';
import * as vscode from 'vscode';
import { AnalyzeContext, Color, IImportedValue, IItemYaml, IThemedCollectionYaml } from './AnalyzeContext';
import { DecorationsMap } from './DecorationMap';
import { Globals } from './globals';
import { ImportedSharedValue, ImportedThemedValue, ImportedValue } from './ImportedValue';
import { ItemType } from './utils/ItemType';
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
  /**
   * The text of the document.
   */
  private text: string = '';
  /**
   * The parsed yaml of the document.
   */
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
  /**
   * The decorations applied on the documents.
   */
  private decorations = new DecorationsMap();
  /**
   * The ranges for single color decoration (when a value is hardcoded/imported).
   */
  private singleColorDecorationRangeMap = new Map<Color, vscode.Range[]>();
  /**
   * The ranges of multiple colors decoration (for the themed keys).
   */
  private multipleColorsDecorationRangeMap = new Map<Color, vscode.Range[]>();
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
    for (const color of this.singleColorDecorationRangeMap.keys()) {
      // The empty array will remove the decoration of a removed color in the editor.setDecorations below.
      this.singleColorDecorationRangeMap.set(color, []);
    }
    for (const colors of this.multipleColorsDecorationRangeMap.keys()) {
      // The empty array will remove the decoration of a removed color in the editor.setDecorations below.
      this.multipleColorsDecorationRangeMap.set(colors, []);
    }
    this.values.clear();

    this.text = this.document.getText();
    this.yaml = load(this.text) as IGlobalYaml;

    // Start by analyzing the shared items.
    const sharedIndex = /^\.shared\:/gm.exec(this.text)!.index;  // Shared index.
    this.analyze(new AnalyzeContext(
      {
        index: sharedIndex,
        yaml: this.yaml['.shared'],
        path: ['.shared'],
        platforms: this.yaml['.platforms'] ?? [],
      }

    ));

    // After we analyzed the shared items, we can analyze the themed items.
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
      for (const color of this.singleColorDecorationRangeMap.keys()) {
        const ranges = this.singleColorDecorationRangeMap.get(color)!;
        const decorationType = this.decorations.getSingleColor(color);
        if (decorationType !== null) {
          editor.setDecorations(decorationType, ranges);
        }
      }
      for (const color of this.multipleColorsDecorationRangeMap.keys()) {
        const ranges = this.multipleColorsDecorationRangeMap.get(color)!;
        const decorations = this.decorations.getMultipleColors(color);
        for (const decoration of decorations) {
          editor.setDecorations(decoration, ranges);
        }
      }
    }
    // Apply the decorations if any.
    for (const color of this.singleColorDecorationRangeMap.keys()) {
      const ranges = this.singleColorDecorationRangeMap.get(color)!;
      if (!ranges.length) {
        this.singleColorDecorationRangeMap.delete(color);
      }
    }
    for (const colors of this.multipleColorsDecorationRangeMap.keys()) {
      const ranges = this.multipleColorsDecorationRangeMap.get(colors)!;
      if (!ranges.length) {
        this.singleColorDecorationRangeMap.delete(colors);
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
      // If it is a collection, we recursively analyze the items inside.
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
    let values: {
      [key: string]: ItemType | undefined,
    } = {};
    for (const key of this.getValueKeys(yaml, context.isShared, false)) {
      // key is either `'.value'` (for shared) or all the themes (for themed).
      let index = context.index;
      let value: ItemType | undefined;
      const subYaml: any = yaml[key] ?? (yaml as any)[this.defaultTheme]; // If a theme is not specified, we use the value/logic of the default theme.
      const delegateToDefaultTheme = !yaml[key];
      if (typeof subYaml === 'object') {
        // It means it is imported (or a color with the key word `'value'`).
        const _subYaml = subYaml as IImportedValue;
        const importPath = _subYaml['import'];
        if (importPath) {
          const diagnosticMessages: string[] = [];
          if (!this.values.has(importPath)) {
            diagnosticMessages.push(`The value \`${importPath}\` does not exist. Make sure the item has been defined ABOVE in the file.`);
          } else {
            const importedValue = this.values.get(importPath)!;
            if (importedValue.type !== yaml['.type']) {
              diagnosticMessages.push(`The value \`${importPath}\` is not of type \`${yaml['.type']}\` but \`${importedValue.type}\`.`);
            }
          }
          if (!delegateToDefaultTheme) {
            // We only need to lint the value if it is not delegated to the
            // default theme. The default theme should have been handle before
            // already.
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
            if (diagnosticMessages.length) {
              continue;
            }
          }
          // Get the imported value
          const importedValue = this.values.get(importPath);
          value = importedValue?.getValue(key);   // Get opacity if needed 
        } else {
          // The path could not exist because the user did something wrong or
          // because he specified a value instead.
          if (_subYaml['value'] !== undefined) {
            value = _subYaml['value'];
          } else {
            // The user might have done something wrong;
            continue;
          }
        }
        if (yaml['.type'] === 'color' && subYaml['withOpacity'] !== undefined) {
          // We need to do the same work for the `'withOpacity'` parameter. It
          // modifies the imported (or hardcoded) value. It might also be
          // imported.
          let newOpacityString: string = (value as Color | undefined)?.substring(0, 2) ?? '';
          if (typeof _subYaml['withOpacity'] === 'number') {
            newOpacityString = Math.round(255 * _subYaml['withOpacity']).toString(16);
          } else if ((_subYaml['withOpacity'] as { import: string })['import']) {
            const importPath: string = (_subYaml['withOpacity'] as { import: string })['import'];
            // This is imported.
            const diagnosticMessages: string[] = [];
            if (!this.values.has(importPath)) {
              diagnosticMessages.push(`The value \`${importPath}\` does not exist. Make sure the item has been defined ABOVE in the file.`);
            } else {
              const importedValue = this.values.get(importPath)!;
              if (importedValue.type !== 'double') {
                diagnosticMessages.push(`The value \`${importPath}\` is not of type \`double\` but \`${importedValue.type}\`.`);
              } else {
                const newOpacityDouble = importedValue.getValue(key)! as number;
                if (!(0 <= newOpacityDouble && newOpacityDouble <= 1)) {
                  if (context.isShared) {
                    diagnosticMessages.push(`The value \`${importPath}\` is \`${newOpacityDouble}\` but it must be between 0 and 1.`);
                  } else {
                    diagnosticMessages.push(`The value \`${importPath}\` for the theme \`${key}\` is \`${newOpacityDouble}\` but it must be between 0 and 1.`);
                  }
                } else {
                  newOpacityString = Math.round(255 * (importedValue.getValue(key)! as number)).toString(16);
                }
              }
            }
            if (!delegateToDefaultTheme) {
              // We only need to lint the value if it is not delegated to the
              // default theme. The default theme should have been handle before
              // already.
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
          }
          value = `${newOpacityString}${(value as Color | undefined)?.substring(2)}`;
        }
      } else {
        value = subYaml as ItemType;
      }
      values[key] = value;
    }
    let valueToRegister: ImportedValue | undefined;
    if (context.isShared) {
      valueToRegister = new ImportedSharedValue(
        yaml['.type'],
        values['.value'],
      );
    } else {
      valueToRegister = new ImportedThemedValue(
        yaml['.type'],
        values,
      );
    }
    this.values.set(context.pathKey, valueToRegister);
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

  /**
   *
   * @param onlySpecified If `true`, it returns only the specified keys in the
   * yaml. If `false`, it returns all the themes for a themed value.
   */
  private getValueKeys(yaml: IItemYaml, isShared: boolean, onlySpecified: boolean = true): (keyof IItemYaml)[] {
    if (isShared) {
      return ['.value' as keyof IItemYaml];
    } else {
      if (onlySpecified) {
        return Object.keys(yaml).filter(key => !key.startsWith('.')) as (keyof IItemYaml)[];
      } else {
        return this.yaml['.themes'] as string[] as (keyof IItemYaml)[];
      }
    }
  }

  /**
   * - Adds the decorations to the "single" colors (where the values are
   *   specified or imported. It highlight them and adds a colored box in front
   *   of the values.
   * - Add the decoration to the "multiple"/themed color. It adds a box of the
   *   color in each theme after the key.
   */
  private addDecorationIfColor(context: AnalyzeContext): void {
    const yaml = context.yaml as IItemYaml;
    if (yaml['.type'] === 'color') {
      let index = context.index;
      for (const key of this.getValueKeys(yaml, context.isShared)) {
        let color: Color | undefined;
        let stringToDecorate: string | undefined;
        if ((typeof yaml[key]) !== 'string') {
          const subYaml = yaml[key] as IImportedValue;
          // The color is not hardcoded.
          if (subYaml['value']) {
            color = subYaml['value'];
            stringToDecorate = color;
          } else if (subYaml['import']) {
            stringToDecorate = subYaml['import']!;
            color = this.values.get(subYaml['import']!)?.getValue(key) as Color;
          }
        } else {
          // At this point, it the value should be a color of the form `aarrggbb`.
          color = yaml[key] as Color;
          stringToDecorate = color;
        }

        const themeRegExp = new KeyRegExp(key);
        const match = themeRegExp.exec(this.text.substring(index))!;
        index += match.index;
        index += this.text.substring(index).indexOf(stringToDecorate!);
        const position = this.document.positionAt(index);

        const range = new vscode.Range(
          position,
          new vscode.Position(position.line, position.character + stringToDecorate!.length),
        );
        if (!this.singleColorDecorationRangeMap.has(color!)) {
          this.singleColorDecorationRangeMap.set(color!, [range]);
        } else {
          this.singleColorDecorationRangeMap.get(color!)!.push(range);
        }
      }
      if (!context.isShared) {
        // Displays the boxes after the key for all the themes.
        const value = this.values.get(context.pathKey);
        if (!value) {
          return;
        }
        const colors = this.yaml['.themes'].map(theme => value.getValue(theme)).join(',');
        const range = new vscode.Range(...this.keyPositionsFromIndex(context.index));
        if (!this.multipleColorsDecorationRangeMap.has(colors)) {
          this.multipleColorsDecorationRangeMap.set(colors, [range]);
        } else {
          this.multipleColorsDecorationRangeMap.get(colors)!.push(range);
        }
      }
    }
  }

  /**
   * Returns the position corresponding to the index.
   */
  private keyPositionsFromIndex(index: number): [vscode.Position, vscode.Position] {
    const documentPosition = this.document.positionAt(index);
    const keyMatch = this.text.substring(index).match(/[a-z][a-zA-z0-9]*/)!;

    return [
      new vscode.Position(documentPosition.line, keyMatch.index!),
      new vscode.Position(documentPosition.line, keyMatch.index! + keyMatch[0].length),
    ];
  }
}
