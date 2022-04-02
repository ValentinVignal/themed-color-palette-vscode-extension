import { load } from 'js-yaml';
import * as vscode from 'vscode';
import { DocumentInstance } from './DocumentInstance';
import { Globals } from './globals';

const pattern = new RegExp(/\b[a-z0-9]{8}\b/);

let activeEditor: vscode.TextEditor | undefined;

let timeout: NodeJS.Timeout | null = null;


/**
 * List of the active documents.
 */
let activeDocumentInstances: DocumentInstance[] = [];


export function activate(context: vscode.ExtensionContext) {

  Globals.diagnosticCollection; // Initialize the diagnostic collection.

  vscode.window.onDidChangeVisibleTextEditors(onOpenEditor, null, context.subscriptions);

  onOpenEditor(vscode.window.visibleTextEditors);

  // activeEditor = vscode.window.activeTextEditor;



  // vscode.window.onDidChangeActiveTextEditor(function (editor) {
  //   activeEditor = editor;
  //   if (editor) {
  //     trigger(context);
  //   }
  // }, null, context.subscriptions);


  // vscode.workspace.onDidChangeTextDocument(function (event) {
  //   if (activeEditor && event.document === activeEditor.document) {
  //     trigger(context);
  //   }
  // }, null, context.subscriptions);

  // trigger(context);

}

export function deactivate() {
  Globals.diagnosticCollection.dispose();
}

/**
 * Callback called when a new editor is opened.
 */
function onOpenEditor(editors: readonly vscode.TextEditor[]): void {
  const documents = editors.map(({ document }) => document);
  const documentInstancesToDispose = activeDocumentInstances.filter(({ document }) => !documents.includes(document));

  activeDocumentInstances = activeDocumentInstances.filter(({ document }) => documents.includes(document));
  for (const documentInstanceToDispose of documentInstancesToDispose) {
    documentInstanceToDispose.dispose();
  }

  const validDocuments = documents.filter(isValidDocument);
  doLints(validDocuments);


}

/**
 * Returns `true` for the documents that can be linted.
 */
function isValidDocument(document: vscode.TextDocument): boolean {
  return document.languageId === 'yaml' && document.fileName.endsWith('theme.yaml');
}

/**
 * Creates and updates the lints on the given documents.
 */
async function doLints(documents: vscode.TextDocument[]): Promise<void> {
  if (documents.length) {
    const instances = await Promise.all(documents.map(findOrCreateInstance));
    instances.map(instance => instance.update());
  }
}

/**
 * Returns the existing {@link DocumentInstance} for the given document, or
 * creates a new one.
 */
function findOrCreateInstance(document: vscode.TextDocument): DocumentInstance {
  let instance = activeDocumentInstances.find(({ document: instanceDocument }) => instanceDocument === document);
  if (instance) {
    return instance;
  }
  instance = new DocumentInstance(document);
  activeDocumentInstances.push(instance);
  return instance;
}






function trigger(context: vscode.ExtensionContext) {
  if (timeout !== null) {
    clearTimeout(timeout);
  }
  timeout = setTimeout(
    () => {
      // displayColorDecoration(context);
      analyzeFile(context);
    },
    0,
  );
}


function displayColorDecoration(context: vscode.ExtensionContext): void {
  if (!activeEditor || !activeEditor.document) {
    return;
  }
  const text = activeEditor.document.getText();

  const matches = text.matchAll(Globals.colorRegExp);
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
      // TODO: See how color high-light handles the boxes and reloads https://github.dev/enyancc/vscode-ext-color-highlight/blob/6f84b8811a4b166a0a7bf66d5637a5bb0858d1ed/src/color-highlight.js#L93.
      // I can put the boxes before the colors
      // And also several of them after the name of an themed value.
      // before: {
      //   contentText: ' ',
      //   margin: '0.1em 0.2em 0 0.2em',
      //   width: '0.7em',
      //   height: '0.7em',
      //   backgroundColor: rgba,
      // },
      overviewRulerColor: rgba,
    });


    activeEditor.setDecorations(decorationType, [decoration]);
  }



}


interface IThemedRecursionParameters {
  subYaml: {
    [key: string]: any;
  };
  /**
   * The current path in the yaml: `['collectionName', 'itemName']`.
   */
  currentPath: string[];
}

function analyzeFile(context: vscode.ExtensionContext): void {
  if (!activeEditor || !activeEditor.document) {
    return;
  }
  const text = activeEditor.document.getText();
  const tabSize = activeEditor.options.tabSize;


  /**
   * All the items' values.
   *
   * The key is the path (`'collectionName.itemName'`) or
   * (`'.shared.collectionName.itemName'`).
   *
   * The value is the value of the item.
   */
  const values = new Map<String, any>();
  /**
   * The current index in the file.
   */
  let currentIndex = 0;

  /**
   * The yaml object.
   */
  const yaml = load(text) as {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '.themed': {
      [key: string]: any;
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '.shared': {},
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '.themes': string[]

  };
  const themes = yaml['.themes'];
  const defaultTheme = themes[0];
  console.log('yaml', yaml);
  currentIndex = /^\.themed\:/gm.exec(text)!.index;  // Themed index.


  function themedRecursion({ subYaml, currentPath }: IThemedRecursionParameters): void {
    const isCollection = !subYaml.hasOwnProperty('.type');
    if (isCollection) {
      for (const key in subYaml) {
        const keyRegExp = new RegExp(`^(\t| )*${key}:`, 'gm');
        const match = keyRegExp.exec(text.substring(currentIndex));
        const indexOffset = match!.index;
        currentIndex += indexOffset;
        const path = currentPath.concat(key);
        themedRecursion({ subYaml: subYaml[key], currentPath: path });
      }

    } else {
      if (!subYaml.hasOwnProperty(defaultTheme)) {
        const line = text.substring(0, currentIndex).match(/\r\n|\r|\n/g)!.length;
        const keyMatch = text.substring(currentIndex).match(/\w+/)!;

        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(
            new vscode.Position(line, keyMatch.index!),
            new vscode.Position(line, keyMatch.index! + keyMatch[0].length),
          ),
          `The default theme "${defaultTheme}" must be defined.`,
          vscode.DiagnosticSeverity.Error,
        );
        Globals.diagnosticCollection.set(
          activeEditor!.document.uri,
          [...Globals.diagnosticCollection.get(activeEditor!.document.uri) ?? [], diagnostic],
        );

      }

      const isColor = subYaml['.type'] === 'color';
      for (const theme in themes) {
        const path = currentPath.concat(theme);

        let themeValue = subYaml[theme] ?? subYaml[defaultTheme];
        if (typeof themeValue === 'object') {
          // The value is imported
          let importPath = (themeValue as { import: string }).import;
          if (!importPath.startsWith('.shared')) {
            importPath += `.${theme}`;
          }
          themeValue = values.get(importPath);
        }
        values.set(path.join('.'), themeValue); // Saves the value for future imports
      }


    }
  }

  themedRecursion({ subYaml: yaml['.themed'], currentPath: [] });
}



function verifyImportsRecursive(yaml: {}): void {
  // TODO: Try to implement everything in 1 iteration over the document.

  /**
   *  For each key in order:
   * - Check if there is an import.
   *    - If yes, check it is valid. -> If not, add an error decoration.
   * - Get the value for all the themes (if applicable)
   * - Check the platforms.
   * - Check the default theme is specified (if applicable).
   * - Get the line index of the current key.
   * - Store the visited path with:
   *    - The value(s)
   *    - The decoration (?) (I don't think it is necessary)
   */
}


/**
 * Returns true if the color is light, false if it is dark.
 */
function isColorLight(red: number, green: number, blue: number): boolean {

  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 125;
}

