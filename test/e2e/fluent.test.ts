import { Prisma, PrismaClient, Profile, User } from "../../prisma/generated/client";
import { faker } from '@faker-js/faker';

import { createSoftDeleteExtension } from "../../src";
import client from "./client";
import {PrismaPg} from "@prisma/adapter-pg";

describe("fluent", () => {
  let testClient: any;
  let profile: Profile;
  let user: User;

  beforeAll(async () => {
    const adapter = new PrismaPg({connectionString: process.env.DATABASE_URL!});
    testClient = new PrismaClient({adapter});
    testClient = testClient.$extends(
      createSoftDeleteExtension({
        models: { Comment: true, Profile: true },
        dmmf: Prisma.dmmf,
      })
    );

    profile = await client.profile.create({
      data: {
        bio: "foo",
      },
    });
    user = await client.user.create({
      data: {
        email: faker.internet.email(),
        name: faker.person.fullName(),
        profileId: profile.id,
      },
    });
  });
  afterAll(async () => {
    // disconnect test client
    await testClient.$disconnect();

    // delete user and related data
    await client.user.update({
      where: { id: user.id },
      data: { profile: { delete: true } },
    });
    await client.user.delete({ where: { id: user.id } });
  });

  it("supports fluent API", async () => {
    const userProfile = await testClient.user
      .findFirst({ where: { id: user.id } })
      .profile();

    expect(userProfile).toEqual(profile);
  });
});
