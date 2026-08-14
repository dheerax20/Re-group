import { z } from "zod";

const optionalPositiveInt = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return Number.NaN;
  return n;
}, z.number().int().min(1, "Must be at least 1").max(100000, "That number looks too large").optional());

export const churchInfoSchema = z.object({
  name: z.string().min(2, "Church name is required").max(120),
  denomination: z.string().max(80).optional().or(z.literal("")),
  congregationSize: optionalPositiveInt,
  primaryContactName: z.string().max(120).optional().or(z.literal("")),
  primaryContactEmail: z
    .string()
    .email("Must be a valid email")
    .optional()
    .or(z.literal("")),
  primaryContactPhone: z.string().max(30).optional().or(z.literal("")),
  tagline: z.string().max(160).optional().or(z.literal("")),
  city: z.string().max(80).optional().or(z.literal("")),
  worshipStyle: z.string().max(80).optional().or(z.literal("")),
  serviceTimes: z.string().max(160).optional().or(z.literal("")),
  pastorName: z.string().max(120).optional().or(z.literal("")),
  mission: z.string().max(400).optional().or(z.literal("")),
  values: z.string().max(240).optional().or(z.literal("")),
});

export type ChurchInfoInput = z.infer<typeof churchInfoSchema>;
