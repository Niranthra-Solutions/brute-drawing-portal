import { z } from "zod";
import { isValidNumber, maskHint } from "@/lib/util";

export const required = (msg: string) => z.string().trim().min(1, msg);
/** BRD: dimensions are numeric, 3 to 4 digits. */
export const dim = (label: string) =>
  z.string().regex(/^\d{3,4}$/, `${label}: enter 3 or 4 digits.`);
export const optionalDim = (label: string) =>
  z.string().regex(/^(\d{3,4})?$/, `${label}: enter 3 or 4 digits.`);
export const drawingNumber = (mask: string, example: string) =>
  z
    .string()
    .refine(
      (v) => isValidNumber(v, mask),
      `Use the format ${maskHint(mask)} (example ${example}).`,
    );

export const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your e-mail address.")
    .email("Enter a valid e-mail address."),
});
export const userSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the full name.").max(120),
  email: z
    .string()
    .trim()
    .min(1, "Enter an e-mail address.")
    .email("Enter a valid e-mail address."),
  department: z.string().max(120).optional(),
  role: z.enum(["User", "Admin"]),
  isActive: z.boolean(),
});
export const settingsSchema = z
  .object({
    numberMask: z
      .string()
      .min(3, "The mask needs at least 3 characters.")
      .max(40),
    toleranceLengthMm: z.string().regex(/^\d{1,3}$/, "0–500"),
    toleranceWidthMm: z.string().regex(/^\d{1,3}$/, "0–500"),
    toleranceHeightMm: z.string().regex(/^\d{1,3}$/, "0–500"),
  })
  .refine(
    (v) =>
      [v.toleranceLengthMm, v.toleranceWidthMm, v.toleranceHeightMm].every(
        (x) => Number(x) <= 500,
      ),
    { message: "Tolerances must be 0–500 mm.", path: ["toleranceLengthMm"] },
  );
export const documentSchema = z.object({
  title: z.string().trim().min(2, "Enter a title.").max(200),
  category: z.string().trim().min(1, "Enter a category.").max(80),
  description: z.string().max(1000).optional(),
});
export const noteSchema = (requiredNote: boolean) =>
  z.object({
    note: requiredNote
      ? z.string().trim().min(3, "Please give a reason.")
      : z.string().max(2000).optional(),
  });
export const commentSchema = z.object({
  body: z.string().trim().min(1, "Write a message first.").max(4000),
});

export const masterSchemas = {
  named: z.object({
    name: z.string().trim().min(1, "Enter a name.").max(120),
    sortOrder: z.string().regex(/^\d{0,5}$/, "Numbers only"),
    isActive: z.boolean(),
  }),
  voltage: z.object({
    valueV: z.string().regex(/^\d{1,4}$/, "Enter the voltage in volts."),
    isActive: z.boolean(),
  }),
  ah: z.object({
    value: z.string().regex(/^\d{1,6}$/, "Enter the Ah value."),
    standard: z.string().max(20).optional(),
    isActive: z.boolean(),
  }),
  model: z.object({
    makeId: required("Select a make."),
    vehicleTypeId: required("Select a vehicle type."),
    categoryId: required("Select a category."),
    name: required("Enter the model.").pipe(z.string().max(120)),
    capacity: required("Enter the capacity.").pipe(z.string().max(40)),
    isActive: z.boolean(),
  }),
};
