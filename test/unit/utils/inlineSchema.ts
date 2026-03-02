import fs from "fs";
import path from "path";

// Read the Prisma-generated schema.prisma file so tests can pass it as
// `inlineSchema` to withNestedOperations.  This gives accurate isList values
// for Prisma 7 where DMMF no longer includes that metadata.
export const TEST_INLINE_SCHEMA: string = fs.readFileSync(
  path.join(process.cwd(), "prisma", "generated", "client", "schema.prisma"),
  "utf8"
);
