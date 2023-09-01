import * as vscode from 'vscode';
import { DocumentInstance } from './DocumentInstance';
import { Globals } from './globals';


/**
 * List of the active documents.
 */
let activeDocumentInstances: DocumentInstance[] = [];


export function activate(context: vscode.ExtensionContext) {

  Globals.diagnosticCollection; // Initialize the diagnostic collection.

  vscode.window.onDidChangeVisibleTextEditors(onOpenEditor, null, context.subscriptions);

  onOpenEditor(vscode.window.visibleTextEditors);

  vscode.languages.registerHoverProvider('yaml', {
    provideHover(document, position, _) {
      if (!isValidDocument(document)) { return; }
      const documentInstance = activeDocumentInstances.find(({ document: instanceDocument }) => instanceDocument === document);
      if (!documentInstance) { return; }
      return documentInstance.provideHover(position);
    }
  });
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
