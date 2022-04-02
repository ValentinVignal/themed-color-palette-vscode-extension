
/**
 * The structure of an object in the yaml file.
 */
export interface IYaml {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '.platforms'?: string[] | undefined;
}


/**
 * The different supported types.
 */
export type ItemType = 'int' | 'double' | 'color' | 'fontWeight' | 'bool' | 'brightness';

/**
 * The structure of an item in the yaml file.
 */
export interface IItemYaml extends IYaml {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '.type': ItemType
}


/**
 * The structure of an themed item in the yaml file
 */
export type IThemedItemYaml = {
  [key: string]: any;
} & IItemYaml;

export interface ISharedItemYaml extends IItemYaml {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '.value': any
}


/**
 * The structure of a themed collection in the yaml file.
 */
export type IThemedCollectionYaml = {
  [key: string]: IYaml | IThemedItemYaml | undefined;
} & IYaml;


export type Color = string;

interface IAnalyzeThemedContext {
  index: number;
  yaml: IYaml;
  currentKey?: string | undefined;
  path: string[];
  platforms: string[];

}

/**
 * The context to analyze a file.
 */
export class AnalyzeContext implements IAnalyzeThemedContext {

  constructor(context: IAnalyzeThemedContext) {
    this.index = context.index;
    this.yaml = context.yaml;
    this.path = context.path;
    this.platforms = context.platforms;
  }
  readonly platforms: string[];
  readonly path: string[];
  readonly index: number;
  readonly yaml: IYaml;

  private _keys: string[] | undefined;

  /**
   * Returns `true` if the yaml is a collection.
   */
  get isCollection() {
    return !this.yaml.hasOwnProperty('.type');
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
  get lastKey(): string {
    return this.keys[this.keys.length - 1];
  }


  /**
   * @returns `true` if this is a shared context (and not a themed one).
   */
  get isShared(): boolean {
    return !!this.path.length && this.path[0] === '.shared';
  }
}
