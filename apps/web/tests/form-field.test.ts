import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

const FormFieldElement = FormField as unknown as (props: {
  label: string;
  description: string;
  children?: ReturnType<typeof createElement>;
}) => ReturnType<typeof createElement>;

function FormFieldFixture() {
  return createElement(
    FormFieldElement,
    {
      label: "Store name",
      description: "Visible to shoppers."
    },
    createElement(Input, { defaultValue: "Olive Mercantile" })
  );
}

describe("FormField", () => {
  test("associates labels and descriptions with direct controls", () => {
    const markup = renderToStaticMarkup(createElement(FormFieldFixture));

    const labelMatch = markup.match(/<label[^>]*for="([^"]+)"/);
    expect(labelMatch?.[1]).toBeTruthy();
    expect(markup).toContain(`id="${labelMatch?.[1]}"`);
    expect(markup).toContain("aria-describedby=");
    expect(markup).toContain("Visible to shoppers.");
  });
});
