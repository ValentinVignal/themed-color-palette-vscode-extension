import type { IItemYaml } from "../AnalyzeContext";

export type Theme = {
  name: keyof IItemYaml;
  import?: keyof IItemYaml;
};
