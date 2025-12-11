import { createSoftDeleteExtension } from "../../src";
import { MockClient } from "./utils/mockClient";
import { Prisma } from "../../prisma/generated/client";

describe("findUnique", () => {
  it("does not change findUnique params if model is not in the list", async () => {
    const client = new MockClient();
    const extendedClient = client.$extends(
      createSoftDeleteExtension({ models: {}, dmmf: Prisma.dmmf })
    );

    await extendedClient.user.findUnique({
      where: { id: 1 },
    });

    // params have not been modified
    expect(extendedClient.user.findUnique.query).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  it("does not modify findUnique results", async () => {
    const client = new MockClient();
    const extendedClient = client.$extends(
      createSoftDeleteExtension({ models: { User: true }, dmmf: Prisma.dmmf })
    );

    const queryResult = { id: 1, deleted: true };
    // Prisma 7+: findUnique is not converted to findFirst anymore
    // because unique field info is not available in DMMF
    extendedClient.user.findUnique.query.mockImplementation(
      () => Promise.resolve(queryResult) as any
    );

    const result = await extendedClient.user.findUnique({
      where: { id: 1 },
    });

    expect(result).toEqual(queryResult);
  });

  // Prisma 7+: unique field info (isId, isUnique) is not available in DMMF
  // The extension now adds deleted filter directly to findUnique instead of
  // converting to findFirst. This is supported in Prisma 7+ where findUnique
  // can filter by non-unique fields in the where clause.
  it("adds deleted filter to findUnique and excludes deleted records", async () => {
    const client = new MockClient();
    const extendedClient = client.$extends(
      createSoftDeleteExtension({
        models: { User: true },
        dmmf: Prisma.dmmf,
      })
    );

    await extendedClient.user.findUnique({
      where: { id: 1 },
    });

    // Prisma 7+: params are modified but operation stays findUnique
    expect(extendedClient.user.findUnique.query).toHaveBeenCalledWith({
      where: {
        id: 1,
        deleted: false,
      },
    });
  });

  it("allows explicitly querying for deleted records using findUnique", async () => {
    const client = new MockClient();
    const extendedClient = client.$extends(
      createSoftDeleteExtension({
        models: { User: true },
        dmmf: Prisma.dmmf,
      })
    );

    await extendedClient.user.findUnique({
      where: { id: 1, deleted: true },
    });

    // Prisma 7+: params are modified to include explicit deleted value
    expect(extendedClient.user.findUnique.query).toHaveBeenCalledWith({
      where: {
        id: 1,
        deleted: true,
      },
    });
  });

  // Prisma 7+: compound unique index validation is skipped because uniqueFields
  // info is not available in DMMF. The query will pass through with deleted filter.
  it("adds deleted filter to findUnique with compound unique index field", async () => {
    const client = new MockClient();
    const extendedClient = client.$extends(
      createSoftDeleteExtension({
        models: { User: true },
        dmmf: Prisma.dmmf,
      })
    );

    await extendedClient.user.findUnique({
      where: {
        name_email: {
          name: "test",
          email: "test@test.com",
        },
      },
    });

    // Prisma 7+: deleted filter is added without throwing error
    expect(extendedClient.user.findUnique.query).toHaveBeenCalledWith({
      where: {
        name_email: {
          name: "test",
          email: "test@test.com",
        },
        deleted: false,
      },
    });
  });

  it('adds deleted filter to findUnique when "allowCompoundUniqueIndexWhere" is set to true', async () => {
    const client = new MockClient();
    const extendedClient = client.$extends(
      createSoftDeleteExtension({
        models: {
          User: {
            field: "deleted",
            createValue: Boolean,
            allowCompoundUniqueIndexWhere: true,
          },
        },
        dmmf: Prisma.dmmf,
      })
    );

    await extendedClient.user.findUnique({
      where: {
        name_email: {
          name: "test",
          email: "test@test.com",
        },
      },
    });

    // Prisma 7+: deleted filter is added
    expect(extendedClient.user.findUnique.query).toHaveBeenCalledWith({
      where: {
        name_email: {
          name: "test",
          email: "test@test.com",
        },
        deleted: false,
      },
    });
  });

  it("adds deleted filter to findUnique when no args where passed", async () => {
    const client = new MockClient();
    const extendedClient = client.$extends(
      createSoftDeleteExtension({
        models: { User: true },
        dmmf: Prisma.dmmf,
      })
    );

    // @ts-expect-error testing if user doesn't pass args accidentally
    await extendedClient.user.findUnique(undefined);

    // Prisma 7+: deleted filter is added even with undefined args
    expect(extendedClient.user.findUnique.query).toHaveBeenCalledWith({
      where: {
        deleted: false,
      },
    });
  });

  it("adds deleted filter to findUnique when invalid where passed", async () => {
    const client = new MockClient();
    const extendedClient = client.$extends(
      createSoftDeleteExtension({
        models: { User: true },
        dmmf: Prisma.dmmf,
      })
    );

    // @ts-expect-error testing if user doesn't pass where accidentally
    await extendedClient.user.findUnique({});
    expect(extendedClient.user.findUnique.query).toHaveBeenCalledWith({
      where: {
        deleted: false,
      },
    });
    extendedClient.user.findUnique.query.mockClear();

    // expect empty where to add deleted filter
    // @ts-expect-error testing if user passes where without unique field
    await extendedClient.user.findUnique({ where: {} });
    expect(extendedClient.user.findUnique.query).toHaveBeenCalledWith({
      where: {
        deleted: false,
      },
    });
    extendedClient.user.findUnique.query.mockClear();

    // expect where with undefined id field to add deleted filter
    await extendedClient.user.findUnique({ where: { id: undefined } });
    expect(extendedClient.user.findUnique.query).toHaveBeenCalledWith({
      where: { id: undefined, deleted: false },
    });
    extendedClient.user.findUnique.query.mockClear();

    // expect where with undefined unique field to add deleted filter
    await extendedClient.user.findUnique({ where: { email: undefined } });
    expect(extendedClient.user.findUnique.query).toHaveBeenCalledWith({
      where: { email: undefined, deleted: false },
    });
    extendedClient.user.findUnique.query.mockClear();

    // expect where with undefined unique index field to add deleted filter
    await extendedClient.user.findUnique({ where: { name_email: undefined } });
    expect(extendedClient.user.findUnique.query).toHaveBeenCalledWith({
      where: { name_email: undefined, deleted: false },
    });
    extendedClient.user.findUnique.query.mockClear();

    // expect where with defined non-unique field to add deleted filter
    // @ts-expect-error intentionally incorrect where
    await extendedClient.user.findUnique({ where: { name: "test" } });
    expect(extendedClient.user.findUnique.query).toHaveBeenCalledWith({
      where: { name: "test", deleted: false },
    });
    extendedClient.user.findUnique.query.mockClear();

    // expect where with defined non-unique field and undefined id field to add deleted filter
    await extendedClient.user.findUnique({
      where: { id: undefined, name: "test" },
    });
    expect(extendedClient.user.findUnique.query).toHaveBeenCalledWith({
      where: { id: undefined, name: "test", deleted: false },
    });
  });
});
