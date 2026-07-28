import { Prisma } from "@prisma/client/extension";
import type { BaseDMMF } from "@prisma/client/runtime/client";
import {
  NestedOperation,
  withNestedOperations,
} from "@candoimage/prisma-extension-nested-operations";
import {
  createAggregateParams,
  createCountParams,
  createDeleteManyParams,
  createDeleteParams,
  createFindFirstParams,
  createFindFirstOrThrowParams,
  createFindManyParams,
  createFindUniqueParams,
  createFindUniqueOrThrowParams,
  createIncludeParams,
  createSelectParams,
  createUpdateManyParams,
  createUpdateParams,
  createUpsertParams,
  createWhereParams,
  createGroupByParams,
  CreateParams,
  createContext,
} from "./helpers/createParams";

import { Config, Context, ModelConfig } from "./types";
import { ModifyResult, modifyReadResult } from "./helpers/modifyResult";

/**
 * Run an operation the extension rewrote, for example a `delete` turned into an `update`.
 *
 * The rewritten operation has to reach the database on the same connection as the original one.
 * Calling `client.model.operation()` would leave an interactive transaction, because that client is
 * the one the extension was built on and knows nothing about the transaction the caller opened. The
 * soft delete would then be committed on its own and survive a rollback.
 *
 * Prisma passes the transaction it is running in through `__internalParams`. Handing those back to
 * `_request` with the new action keeps the operation inside it. Clients without `_request` fall back
 * to the model call, which still writes but does not join the transaction.
 */
async function runChangedOperation(
  client: any,
  initialParams: any,
  params: { model?: PropertyKey; operation: string; args: any }
): Promise<any> {
  const internalParams = initialParams.__internalParams;

  if (typeof client._request === "function" && internalParams) {
    return client._request({
      ...internalParams,
      action: params.operation,
      args: params.args,
    });
  }

  const model = params.model as string;
  return client[model[0].toLowerCase() + model.slice(1)][params.operation](params.args);
}

/**
 * Extract DMMF from Prisma client instance
 */
function extractDmmfFromClient(client: any): BaseDMMF | null {
  // Try to get from _runtimeDataModel (Prisma 7+)
  if (client._runtimeDataModel) {
    return {
      datamodel: {
        models: Object.entries(client._runtimeDataModel.models).map(
          ([name, model]: [string, any]) => ({
            name,
            fields: model.fields || [],
            uniqueFields: model.uniqueFields || [],
            uniqueIndexes: model.uniqueIndexes || [],
            primaryKey: model.primaryKey,
            dbName: model.dbName ?? null,
            schema: model.schema ?? null,
          })
        ),
        enums: [],
        types: [],
      },
    };
  }
  return null;
}

type ConfigBound<F> = F extends (
  c: Context,
  x: ModelConfig,
  ...args: infer P
) => infer R
  ? (...args: P) => R
  : never;

export function createSoftDeleteExtension({
  models,
  defaultConfig = {
    field: "deleted",
    createValue: Boolean,
    allowToOneUpdates: false,
    allowCompoundUniqueIndexWhere: false,
  },
  dmmf: explicitDmmf,
}: Config) {
  if (!defaultConfig.field) {
    throw new Error(
      "prisma-extension-soft-delete: defaultConfig.field is required"
    );
  }
  if (!defaultConfig.createValue) {
    throw new Error(
      "prisma-extension-soft-delete: defaultConfig.createValue is required"
    );
  }

  const modelConfig: Record<string, ModelConfig> = {};

  Object.keys(models).forEach((model) => {
    const config = models[model];
    if (config) {
      modelConfig[model] =
        typeof config === "boolean" && config ? defaultConfig : config;
    }
  });

  return Prisma.defineExtension((client) => {
    // Resolve DMMF: use explicit if provided, otherwise extract from client
    const dmmf = explicitDmmf ?? extractDmmfFromClient(client);

    if (!dmmf) {
      throw new Error(
        "prisma-extension-soft-delete: Could not extract DMMF from client. " +
          "Please pass dmmf explicitly: createSoftDeleteExtension({ dmmf: Prisma.dmmf, ... })"
      );
    }

    const inlineSchema = (client as any)._engineConfig?.inlineSchema as string | undefined;

    const context = createContext(dmmf);

    const createParamsByModel = Object.keys(modelConfig).reduce<
      Record<string, Record<string, ConfigBound<CreateParams> | undefined>>
    >((acc, model) => {
      const config = modelConfig[model]!;
      return {
        ...acc,
        [model]: {
          delete: createDeleteParams.bind(null, context, config),
          deleteMany: createDeleteManyParams.bind(null, context, config),
          update: createUpdateParams.bind(null, context, config),
          updateMany: createUpdateManyParams.bind(null, context, config),
          upsert: createUpsertParams.bind(null, context, config),
          findFirst: createFindFirstParams.bind(null, context, config),
          findFirstOrThrow: createFindFirstOrThrowParams.bind(
            null,
            context,
            config
          ),
          findUnique: createFindUniqueParams.bind(null, context, config),
          findUniqueOrThrow: createFindUniqueOrThrowParams.bind(
            null,
            context,
            config
          ),
          findMany: createFindManyParams.bind(null, context, config),
          count: createCountParams.bind(null, context, config),
          aggregate: createAggregateParams.bind(null, context, config),
          where: createWhereParams.bind(null, context, config),
          include: createIncludeParams.bind(null, context, config),
          select: createSelectParams.bind(null, context, config),
          groupBy: createGroupByParams.bind(null, context, config),
        },
      };
    }, {});

    const modifyResultByModel = Object.keys(modelConfig).reduce<
      Record<string, Record<string, ConfigBound<ModifyResult> | undefined>>
    >((acc, model) => {
      const config = modelConfig[model]!;
      return {
        ...acc,
        [model]: {
          include: modifyReadResult.bind(null, context, config),
          select: modifyReadResult.bind(null, context, config),
        },
      };
    }, {});

    return client.$extends({
      query: {
        $allModels: {
          // @ts-ignore - withNestedOperations types not compatible with Prisma 7
          $allOperations: withNestedOperations({
            dmmf,
            inlineSchema,
            async $rootOperation(initialParams: any) {
              const createParams =
                createParamsByModel[initialParams.model || ""]?.[
                  initialParams.operation
                ];

              if (!createParams) return initialParams.query(initialParams.args);

              const { params, ctx } = createParams(initialParams);

              const operationChanged =
                params.operation !== initialParams.operation;

              const result = operationChanged
                ? await runChangedOperation(client, initialParams, params)
                : await params.query(params.args);

              const modifyResult =
                modifyResultByModel[params.model as string || ""]?.[params.operation as string];

              if (!modifyResult) return result;

              return modifyResult(result, params, ctx);
            },
            async $allNestedOperations(initialParams: any) {
              const createParams =
                createParamsByModel[initialParams.model || ""]?.[
                  initialParams.operation
                ];

              if (!createParams) return initialParams.query(initialParams.args);

              const { params, ctx } = createParams(initialParams);

              const result = await params.query(
                params.args,
                params.operation as NestedOperation
              );

              const modifyResult =
                modifyResultByModel[params.model as string || ""]?.[params.operation as string];

              if (!modifyResult) return result;

              return modifyResult(result, params, ctx);
            },
          }),
        },
      },
    });
  });
}
