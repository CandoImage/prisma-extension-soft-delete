import type { BaseDMMF } from "@prisma/client/runtime/client";

export type Context = {
  uniqueFieldsByModel: Record<string, string[]>;
  uniqueIndexFieldsByModel: Record<string, string[]>;
};

export type ModelConfig = {
  field: string;
  createValue: (deleted: boolean) => any;
  allowToOneUpdates?: boolean;
  allowCompoundUniqueIndexWhere?: boolean;
};

// Use string keys instead of Prisma.ModelName since that requires a generated client
export type Config = {
  models: Record<string, ModelConfig | boolean>;
  defaultConfig?: ModelConfig;
  dmmf: BaseDMMF;
};
