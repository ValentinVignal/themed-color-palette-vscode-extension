/**
 * A regular expression for matching a key.
 */
export class KeyRegExp extends RegExp {
  constructor(key: string) {
    super(`^(\t| )*${key.replace('.', '\\.')}:`, 'gm');

  }
}
