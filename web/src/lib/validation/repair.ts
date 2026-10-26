import { z } from "zod";

export const issueUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        url.hostname === "github.com" &&
        /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/[1-9]\d*\/?$/.test(
          url.pathname,
        ) &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  }, "Enter a GitHub issue URL, e.g. https://github.com/owner/repo/issues/123");

export const environmentKeySchema = z
  .string()
  .regex(
    /^[A-Za-z_][A-Za-z0-9_]*$/,
    "Use letters, numbers, and underscores; do not start with a number",
  );
