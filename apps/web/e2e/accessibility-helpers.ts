import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

function formatViolations(
  violations: Array<{
    id: string;
    impact?: string | null;
    help: string;
    nodes: Array<{ target: unknown }>;
  }>
) {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .slice(0, 3)
        .map((node) => JSON.stringify(node.target))
        .join(" | ");
      return `${violation.impact ?? "unknown"} ${violation.id}: ${violation.help}${targets ? ` [${targets}]` : ""}`;
    })
    .join("\n");
}

export async function expectNoSeriousAccessibilityViolations(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).analyze();
  const seriousViolations = result.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical"
  );

  expect(
    seriousViolations,
    `${label} had serious accessibility violations:\n${formatViolations(
      seriousViolations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map((node) => ({ target: node.target }))
      }))
    )}`
  ).toEqual([]);
}
