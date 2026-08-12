import { z } from "zod";
import { sectionTypes } from "@/lib/site/types";

export const sectionInstanceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(sectionTypes),
  variant: z.string().min(1),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const sectionConfigSchema = z.array(sectionInstanceSchema);

export type SectionInstanceInput = z.infer<typeof sectionInstanceSchema>;
