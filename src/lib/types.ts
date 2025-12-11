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
  /**
   * DMMF (Data Model Meta Format) - optional in Prisma 7+
   *
   * If not provided, the extension will try to extract it from the Prisma client.
   * You only need to pass this if auto-detection fails.
   *
   * @example
   * // Prisma 7+: No need to pass dmmf
   * createSoftDeleteExtension({ models: { User: true } })
   *
   * // Or explicitly pass it:
   * import { Prisma } from '@prisma/client'
   * createSoftDeleteExtension({ models: { User: true }, dmmf: Prisma.dmmf })
   */
  dmmf?: BaseDMMF;
};
