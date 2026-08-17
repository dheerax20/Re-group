import { z } from "zod";

export const navigationItemSchema = z.object({
  label: z.string().trim().min(1).max(40),
  href: z
    .string()
    .regex(/^\/[a-z0-9/-]*$/, "Use an internal path like /about"),
});

export const navigationConfigSchema = z
  .array(navigationItemSchema)
  .min(1)
  .max(12)
  .refine((items) => items.some((item) => item.href === "/"), {
    message: "Home (/) must stay in navigation",
  })
  .refine(
    (items) => new Set(items.map((item) => item.href)).size === items.length,
    { message: "Duplicate page links are not allowed" }
  );
