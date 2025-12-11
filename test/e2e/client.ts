import { PrismaClient } from "../../prisma/generated/client";
import {PrismaPg} from "@prisma/adapter-pg";

const adapter = new PrismaPg({connectionString: process.env.DATABASE_URL!});
export default new PrismaClient({adapter});
