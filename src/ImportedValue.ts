import { ItemTypeKey } from "./utils/ItemType";

export abstract class ImportedValue {
  constructor(
    readonly type: ItemTypeKey,
  ) { }

}

export class ImportedSharedValue extends ImportedValue {
  constructor(
    type: ItemTypeKey,
  ) {
    super(type);
  }

}
export class ImportedThemedValue extends ImportedValue {
  constructor(
    type: ItemTypeKey,
  ) {
    super(type);
  }
}
