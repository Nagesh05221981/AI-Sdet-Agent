// tools/schemas.js
// JSON schemas for OpenAI Structured Outputs (strict: true).
// All properties must be in required. Use arrays instead of dynamic-key objects.

export const PO_DEFINITION_SCHEMA = {
  name: "page_objects",
  strict: true,
  schema: {
    type: "object",
    properties: {
      pages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            className: { type: "string" },
            property: { type: "string" },
            file: { type: "string" },
            elements: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Element name e.g. loginTab" },
                  get: { type: "string", description: "CSS selector for cy.get()" },
                  find: { type: ["string", "null"], description: "Child selector or null" },
                  contains: { type: ["string", "null"], description: "Text for cy.contains() or null" },
                  param: { type: "boolean", description: "If true, takes a parameter" },
                },
                required: ["name", "get", "find", "contains", "param"],
                additionalProperties: false,
              },
            },
            actions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Method name e.g. clickLogIn" },
                  params: { type: "array", items: { type: "string" } },
                  code: { type: ["string", "null"], description: "Raw Cypress code for complex scoped actions. If not null, steps are ignored." },
                  steps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        element: { type: "string" },
                        do: { type: "string", enum: ["click", "clear-type", "type"] },
                        value: { type: ["string", "null"] },
                      },
                      required: ["element", "do", "value"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["name", "params", "code", "steps"],
                additionalProperties: false,
              },
            },
            verifications: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Method name e.g. verifyGridVisible" },
                  params: { type: "array", items: { type: "string" } },
                  code: { type: ["string", "null"], description: "Raw Cypress code for complex verifications. If not null, steps are ignored." },
                  steps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        element: { type: "string" },
                        assert: { type: "string" },
                        value: { type: ["string", "null"] },
                      },
                      required: ["element", "assert", "value"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["name", "params", "code", "steps"],
                additionalProperties: false,
              },
            },
          },
          required: ["className", "property", "file", "elements", "actions", "verifications"],
          additionalProperties: false,
        },
      },
    },
    required: ["pages"],
    additionalProperties: false,
  },
};

export const SPEC_DEFINITION_SCHEMA = {
  name: "test_spec",
  strict: true,
  schema: {
    type: "object",
    properties: {
      spec: { type: "string" },
      feature: { type: "string" },
      tests: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  call: { type: "string" },
                  args: { type: "array", items: { type: "string" } },
                },
                required: ["call", "args"],
                additionalProperties: false,
              },
            },
          },
          required: ["id", "title", "steps"],
          additionalProperties: false,
        },
      },
    },
    required: ["spec", "feature", "tests"],
    additionalProperties: false,
  },
};
