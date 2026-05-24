import { z } from "zod";

export const inspectProjectStackSchema = z.object({
  projectPath: z
    .string()
    .min(1, { message: "projectPath is required." }),
});

export type InspectProjectStackInput = z.infer<typeof inspectProjectStackSchema>;

export const inspectProjectStackToolDefinition = {
  name: "inspect_project_stack",
  description:
    "Inspect a .NET project to detect EF/EF Core, Dapper, target frameworks, providers, and supported optimizations.",
  inputSchema: {
    type: "object",
    properties: {
      projectPath: {
        type: "string",
        description: "Absolute or relative path to the .NET project root.",
      },
    },
    required: ["projectPath"],
  },
} as const;
