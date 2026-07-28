import { PrismaClient, Prisma, User } from "../../prisma/generated/client";
import { faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";

import { createSoftDeleteExtension } from "../../src";
import client from "./client";

/**
 * A soft delete rewrites the operation from `delete` to `update`. That rewrite must run on the
 * client the caller used, so a soft delete issued inside an interactive transaction takes part in
 * it and a rollback undoes it.
 */
describe("transactions", () => {
  let testClient: any;

  beforeAll(() => {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    testClient = new PrismaClient({ adapter }).$extends(
      createSoftDeleteExtension({ models: { User: true }, dmmf: Prisma.dmmf })
    );
  });

  afterEach(async () => {
    await client.user.deleteMany({});
  });

  afterAll(async () => {
    await testClient.$disconnect();
  });

  async function createUser(): Promise<User> {
    return client.user.create({ data: { email: faker.internet.email(), name: faker.person.fullName() } });
  }

  it("rolls back a soft delete when the transaction fails", async () => {
    const user = await createUser();

    await expect(
      testClient.$transaction(async (tx: any) => {
        await tx.user.delete({ where: { id: user.id } });
        throw new Error("abort");
      })
    ).rejects.toThrow("abort");

    const stored = await client.user.findUnique({ where: { id: user.id } });
    expect(stored?.deleted).toBe(false);
  });

  it("rolls back a soft deleteMany when the transaction fails", async () => {
    const user = await createUser();

    await expect(
      testClient.$transaction(async (tx: any) => {
        await tx.user.deleteMany({ where: { id: user.id } });
        throw new Error("abort");
      })
    ).rejects.toThrow("abort");

    const stored = await client.user.findUnique({ where: { id: user.id } });
    expect(stored?.deleted).toBe(false);
  });

  it("commits a soft delete when the transaction succeeds", async () => {
    const user = await createUser();

    await testClient.$transaction(async (tx: any) => {
      await tx.user.delete({ where: { id: user.id } });
    });

    const stored = await client.user.findUnique({ where: { id: user.id } });
    expect(stored?.deleted).toBe(true);
  });

  it("sees a soft delete made earlier in the same transaction", async () => {
    const user = await createUser();

    const found = await testClient.$transaction(async (tx: any) => {
      await tx.user.delete({ where: { id: user.id } });
      return tx.user.findUnique({ where: { id: user.id } });
    });

    expect(found).toBeNull();
  });
});
