


interface IAnalyzeThemedContext {
  index: number;
  yaml: IThemedYaml;
  currentKey?: string | undefined;
  path: string[];


}

export type IThemedYaml = {
  [key: string]: IThemedYaml;
};


/**
 * The context to analyze a file.
 */
export class AnalyzeThemedContext implements IAnalyzeThemedContext {

  constructor(context: IAnalyzeThemedContext) {
    this.index = context.index;
    this.yaml = context.yaml;
    this.currentKey = context.currentKey;
    this.path = context.path;
  }
  readonly path: string[];
  readonly currentKey?: string | undefined;
  readonly index: number;
  readonly yaml: IThemedYaml;

  private _keys: string[] | undefined;

  /**
   * Returns `true` if the yaml is a collection.
   */
  get isCollection() {
    return !this.yaml.hasOwnProperty('.type');
  }

  /**
   * Returns the current key that is being analyzed.
   */
  get key(): string {
    return this.path.length ? this.path[this.path.length - 1] : this.currentKey!;
  }

  /**
   * Returns the keys of the yaml.
   */
  get keys(): string[] {
    return this._keys ??= Object.keys(this.yaml);
  }

  /**
   * Returns the last key of the yaml file.
   */
  get lastKey() {
    return this.keys[this.keys.length - 1];
  }



}
