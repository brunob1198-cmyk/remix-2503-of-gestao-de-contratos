
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Simulating the normalization logic that should be in the edge function or view
// Based on the user request, we need to test:
// 1. costCenter.id extraction
// 2. category.name extraction
// 3. comments extraction
// 4. Fallback for description (comments or category.name)

function normalizeTransaction(payload: any) {
  const costCenterId = payload.costCenter?.id || payload.costCenterId || null;
  const categoryName = payload.category?.name || payload.categoryName || null;
  const comments = payload.comments || null;
  
  // Logic for description as requested: priority to 'description', then 'comments', then 'category.name'
  const description = payload.description || comments || categoryName || "Sem descrição";

  return {
    cost_center_id: costCenterId,
    category: categoryName,
    comments: comments,
    description: description,
    type: payload.type || null
  };
}

Deno.test("normalizeTransaction - full payload", () => {
  const payload = {
    costCenter: { id: "CC123", name: "Marketing" },
    category: { id: "CAT1", name: "Viagem" },
    comments: "Viagem a trabalho",
    description: "Voo SP-RJ",
    type: "EXPENSE"
  };
  
  const result = normalizeTransaction(payload);
  assertEquals(result.cost_center_id, "CC123");
  assertEquals(result.category, "Viagem");
  assertEquals(result.comments, "Viagem a trabalho");
  assertEquals(result.description, "Voo SP-RJ");
});

Deno.test("normalizeTransaction - missing nested objects", () => {
  const payload = {
    costCenterId: "CC_LEGACY",
    categoryName: "Alimentação",
    comments: "Almoço cliente",
    type: "EXPENSE"
  };
  
  const result = normalizeTransaction(payload);
  assertEquals(result.cost_center_id, "CC_LEGACY");
  assertEquals(result.category, "Alimentação");
  assertEquals(result.comments, "Almoço cliente");
  assertEquals(result.description, "Almoço cliente"); // Fallback to comments
});

Deno.test("normalizeTransaction - nulls and empty strings", () => {
  const payload = {
    costCenter: null,
    category: { name: "" },
    comments: "",
    description: null,
    type: null
  };
  
  const result = normalizeTransaction(payload);
  assertEquals(result.cost_center_id, null);
  assertEquals(result.category, "");
  assertEquals(result.comments, "");
  assertEquals(result.description, "Sem descrição");
});

Deno.test("normalizeTransaction - category name fallback for description", () => {
  const payload = {
    category: { name: "Uber" },
    comments: null,
    description: null
  };
  
  const result = normalizeTransaction(payload);
  assertEquals(result.category, "Uber");
  assertEquals(result.description, "Uber");
});
