import { Prisma } from "../../prisma/generated/client";
import { createSoftDeleteExtension } from "../../src";
import { MockClient } from "./utils/mockClient";

describe("findUniqueOrThrow", () => {
  it("does not change findUniqueOrThrow params if model is not in the list", async () => {
    const client = new MockClient();
    const extendedClient = client.$extends(
      createSoftDeleteExtension({ models: {}, dmmf: Prisma.dmmf })
    );

    await extendedClient.user.findUniqueOrThrow({
      where: { id: 1 },
    });

    // params have not been modified
    expect(extendedClient.user.findUniqueOrThrow.query).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  it("does not modify findUniqueOrThrow results", async () => {
    const client = new MockClient();
    const extendedClient = client.$extends(
      createSoftDeleteExtension({ models: { User: true }, dmmf: Prisma.dmmf })
    );

    const queryResult = { id: 1, deleted: true };
    // Prisma 7+: findUniqueOrThrow is not converted to findFirstOrThrow anymore
    // because unique field info is not available in DMMF
    extendedClient.user.findUniqueOrThrow.query.mockImplementation(
      () => Promise.resolve(queryResult) as any
    );

    const result = await extendedClient.user.findUniqueOrThrow({
      where: { id: 1 },
    });

    expect(result).toEqual({ id: 1, deleted: true });
  });

  // Prisma 7+: unique field info (isId, isUnique) is not available in DMMF
  // The extension now adds deleted filter directly to findUniqueOrThrow instead of
  // converting to findFirstOrThrow. This is supported in Prisma 7+ where findUniqueOrThrow
  // can filter by non-unique fields in the where clause.
  it("adds deleted filter to findUniqueOrThrow and excludes deleted records", async () => {
    const client = new MockClient();
    const extendedClient = client.$extends(
      createSoftDeleteExtension({
        models: { User: true },
        dmmf: Prisma.dmmf,
      })
    );

    await extendedClient.user.findUniqueOrThrow({
      where: { id: 1 },
    });

    // Prisma 7+: params are modified but operation stays findUniqueOrThrow
    expect(extendedClient.user.findUniqueOrThrow.query).toHaveBeenCalledWith({
      where: {
        id: 1,
        deleted: false,
      },
    });
  });

  it("allows explicitly querying for deleted records using findUniqueOrThrow", async () => {
    const client = new MockClient();
    const extendedClient = client.$extends(
      createSoftDeleteExtension({
        models: { User: true },
        dmmf: Prisma.dmmf,
      })
    );

    await extendedClient.user.findUniqueOrThrow({
      where: { id: 1, deleted: true },
    });

    // Prisma 7+: params are modified to include explicit deleted value
    expect(extendedClient.user.findUniqueOrThrow.query).toHaveBeenCalledWith({
      where: {
        id: 1,
        deleted: true,
      },
    });
  });

  it("adds deleted filter to findUniqueOrThrow when no args passed", async () => {
    const client = new MockClient();
    const extendedClient = client.$extends(
      createSoftDeleteExtension({
        models: { User: true },
        dmmf: Prisma.dmmf,
      })
    );

    // @ts-expect-error testing if user doesn't pass args accidentally
    await extendedClient.user.findUniqueOrThrow(undefined);

    // Prisma 7+: deleted filter is added even with undefined args
    expect(extendedClient.user.findUniqueOrThrow.query).toHaveBeenCalledWith({
      where: {
        deleted: false,
      },
    });
  });

  it("adds deleted filter to findUniqueOrThrow when invalid where passed", async () => {
    const client = new MockClient();
    const extendedClient = client.$extends(
      createSoftDeleteExtension({
        models: { User: true },
        dmmf: Prisma.dmmf,
      })
    );

    // @ts-expect-error testing if user doesn't pass where accidentally
    await extendedClient.user.findUniqueOrThrow({});
    expect(extendedClient.user.findUniqueOrThrow.query).toHaveBeenCalledWith({
      where: {
        deleted: false,
      },
    });
    extendedClient.user.findUniqueOrThrow.query.mockClear();

    // expect empty where to add deleted filter
    // @ts-expect-error testing if user passes where without unique field
    await extendedClient.user.findUniqueOrThrow({ where: {} });
    expect(extendedClient.user.findUniqueOrThrow.query).toHaveBeenCalledWith({
      where: {
        deleted: false,
      },
    });
    extendedClient.user.findUniqueOrThrow.query.mockClear();

    // expect where with undefined id field to add deleted filter
    await extendedClient.user.findUniqueOrThrow({ where: { id: undefined } });
    expect(extendedClient.user.findUniqueOrThrow.query).toHaveBeenCalledWith({
      where: { id: undefined, deleted: false },
    });
    extendedClient.user.findUniqueOrThrow.query.mockClear();

    // expect where with undefined unique field to add deleted filter
    await extendedClient.user.findUniqueOrThrow({
      where: { email: undefined },
    });
    expect(extendedClient.user.findUniqueOrThrow.query).toHaveBeenCalledWith({
      where: { email: undefined, deleted: false },
    });
    extendedClient.user.findUniqueOrThrow.query.mockClear();

    // expect where with undefined unique index field to add deleted filter
    await extendedClient.user.findUniqueOrThrow({
      where: { name_email: undefined },
    });
    expect(extendedClient.user.findUniqueOrThrow.query).toHaveBeenCalledWith({
      where: { name_email: undefined, deleted: false },
    });
    extendedClient.user.findUniqueOrThrow.query.mockClear();

    // expect where with defined non-unique field to add deleted filter
    // @ts-expect-error intentionally incorrect where
    await extendedClient.user.findUniqueOrThrow({ where: { name: "test" } });
    expect(extendedClient.user.findUniqueOrThrow.query).toHaveBeenCalledWith({
      where: { name: "test", deleted: false },
    });
    extendedClient.user.findUniqueOrThrow.query.mockClear();

    // expect where with defined non-unique field and undefined id field to add deleted filter
    await extendedClient.user.findUniqueOrThrow({
      where: { id: undefined, name: "test" },
    });
    expect(extendedClient.user.findUniqueOrThrow.query).toHaveBeenCalledWith({
      where: { id: undefined, name: "test", deleted: false },
    });
  });
});
