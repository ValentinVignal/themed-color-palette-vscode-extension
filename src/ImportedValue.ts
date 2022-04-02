import { ItemType, ItemTypeKey } from "./utils/ItemType";

export abstract class ImportedValue {
  constructor(
    readonly type: ItemTypeKey,
  ) { }

  /**
   * @param key : The theme key. Always `'.value'` for shared.
   *
   * It can return `undefined` if there the item imported a non-found value.
   */
  abstract getValue(key: string): ItemType | undefined;

}

export class ImportedSharedValue extends ImportedValue {
  constructor(
    type: ItemTypeKey,
    readonly value: ItemType | undefined,
  ) {
    super(type);
  }

  getValue(): ItemType | undefined {
    return this.value;
  }
}
export class ImportedThemedValue extends ImportedValue {
  constructor(
    type: ItemTypeKey,
    readonly values: {
      [key: string]: ItemType | undefined,
    }
  ) {
    super(type);
  }

  getValue(key: string): ItemType | undefined {
    return this.values[key];
  }


}
