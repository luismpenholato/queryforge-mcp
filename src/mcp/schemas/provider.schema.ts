import { z } from "zod";
import { DATABASE_PROVIDER_VALUES } from "../../core/providers/provider.types.js";

export const providerSchema = z.enum(["Auto", ...DATABASE_PROVIDER_VALUES]);
export const indexProviderSchema = z.enum([...DATABASE_PROVIDER_VALUES]);

export type ProviderInput = z.infer<typeof providerSchema>;
export type IndexProviderInput = z.infer<typeof indexProviderSchema>;
