"use client";

import { AlertCircle, MapPinned, PackageCheck, PackageOpen, PanelLeftClose, PanelLeftOpen, Truck, UserRound, XCircle } from "lucide-react";
import { StorefrontStudioColorField } from "@/components/dashboard/storefront-studio-color-field";
import { StorefrontStudioEditorTargetMenu } from "@/components/dashboard/storefront-studio-editor-target-menu";
import { StorefrontStudioStorefrontEditorPanelTabContainer } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-container";
import { StorefrontStudioStorefrontEditorPanelTabSection } from "@/components/dashboard/storefront-studio-storefront-editor-panel-tab-section";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  type EmailStudioDocument,
  type EmailStudioTemplateId,
  type EmailStudioThemeRadius
} from "@/lib/email-studio/model";
import { cn } from "@/lib/utils";

const templateIcons = {
  customerConfirmation: PackageCheck,
  ownerNewOrder: UserRound,
  pickupUpdated: MapPinned,
  failed: AlertCircle,
  cancelled: XCircle,
  shipped: Truck,
  delivered: PackageOpen
} as const;

type EmailStudioSidePanelProps = {
  document: EmailStudioDocument;
  activeTemplateId: EmailStudioTemplateId;
  collapsed: boolean;
  onSelectTemplate: (templateId: EmailStudioTemplateId) => void;
  onCollapsedChange: (collapsed: boolean) => void;
  onDocumentChange: (value: EmailStudioDocument) => void;
};

function updateThemeColor(document: EmailStudioDocument, key: keyof EmailStudioDocument["theme"], value: string) {
  return {
    ...document,
    theme: {
      ...document.theme,
      [key]: value
    }
  };
}

export function EmailStudioSidePanel({
  document,
  activeTemplateId,
  collapsed,
  onSelectTemplate,
  onCollapsedChange,
  onDocumentChange
}: EmailStudioSidePanelProps) {
  const activeTemplate = document.templates[activeTemplateId];
  const customerItems = [
    document.templates.customerConfirmation,
    document.templates.pickupUpdated,
    document.templates.failed,
    document.templates.cancelled,
    document.templates.shipped,
    document.templates.delivered
  ];
  const ownerItems = [document.templates.ownerNewOrder];
  const allTemplates = [...customerItems, ...ownerItems];

  return (
    <aside
      className={cn(
        "shrink-0 overflow-hidden rounded-xl border border-border/70 bg-white shadow-sm transition-[width] duration-200 ease-out",
        collapsed ? "xl:w-[4.75rem]" : "xl:w-[23rem]"
      )}
    >
      <div className="flex h-full min-h-[32rem] flex-col">
        <div
          className={cn(
            "border-b border-border/70 px-3 py-3",
            collapsed ? "flex justify-center" : "flex items-center justify-between gap-4"
          )}
        >
          {collapsed ? (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Expand Email Studio rail"
                    className="hidden h-10 w-10 items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition hover:bg-muted/40 xl:inline-flex"
                    onClick={() => onCollapsedChange(false)}
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Expand panel</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <p className="text-sm font-semibold">Control Panel</p>
          )}
          {!collapsed ? (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Collapse Email Studio rail"
                    className="hidden h-10 w-10 items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition hover:bg-muted/40 xl:inline-flex"
                    onClick={() => onCollapsedChange(true)}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Collapse panel</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {collapsed ? (
            <TooltipProvider delayDuration={100}>
              <div className="flex flex-col items-center space-y-2">
                {allTemplates.map((template) => {
                  const Icon = templateIcons[template.id];
                  const button = (
                    <button
                      type="button"
                      aria-label={`Edit ${template.label}`}
                      aria-pressed={template.id === activeTemplateId}
                      onClick={() => onSelectTemplate(template.id)}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl border transition",
                        template.id === activeTemplateId
                          ? "border-primary/30 bg-primary text-primary-foreground shadow-sm"
                          : "border-border/70 bg-white text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );

                  return (
                    <Tooltip key={template.id}>
                      <TooltipTrigger asChild>{button}</TooltipTrigger>
                      <TooltipContent side="right">{template.label}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          ) : (
            <StorefrontStudioStorefrontEditorPanelTabContainer>
              <StorefrontStudioEditorTargetMenu
                activeTargetId={activeTemplate.id}
                activeTargetLabel={activeTemplate.label}
                activeTargetDescription={activeTemplate.description}
                activeTargetIcon={templateIcons[activeTemplate.id]}
                sections={[
                  {
                    label: "Customer emails",
                    items: customerItems.map((template) => ({
                      id: template.id,
                      label: template.label,
                      description: template.description,
                      icon: templateIcons[template.id]
                    }))
                  },
                  {
                    label: "Store owner emails",
                    items: ownerItems.map((template) => ({
                      id: template.id,
                      label: template.label,
                      description: template.description,
                      icon: templateIcons[template.id]
                    }))
                  }
                ]}
                onSelect={(targetId) => onSelectTemplate(targetId as EmailStudioTemplateId)}
              />

              <StorefrontStudioStorefrontEditorPanelTabSection title="Email appearance">
                <div className="space-y-3">
                  <FormField label="Canvas color">
                    <StorefrontStudioColorField
                      value={document.theme.canvasColor}
                      fallback="#F4F1EC"
                      onChange={(value) => onDocumentChange(updateThemeColor(document, "canvasColor", value))}
                    />
                  </FormField>
                  <FormField label="Card color">
                    <StorefrontStudioColorField
                      value={document.theme.cardColor}
                      fallback="#FFFFFF"
                      onChange={(value) => onDocumentChange(updateThemeColor(document, "cardColor", value))}
                    />
                  </FormField>
                  <FormField label="Text color">
                    <StorefrontStudioColorField
                      value={document.theme.textColor}
                      fallback="#1F2937"
                      onChange={(value) => onDocumentChange(updateThemeColor(document, "textColor", value))}
                    />
                  </FormField>
                  <FormField label="Muted text">
                    <StorefrontStudioColorField
                      value={document.theme.mutedColor}
                      fallback="#6B7280"
                      onChange={(value) => onDocumentChange(updateThemeColor(document, "mutedColor", value))}
                    />
                  </FormField>
                  <FormField label="Accent color">
                    <StorefrontStudioColorField
                      value={document.theme.accentColor}
                      fallback="#7C5C3B"
                      onChange={(value) => onDocumentChange(updateThemeColor(document, "accentColor", value))}
                    />
                  </FormField>
                  <FormField label="Button text color">
                    <StorefrontStudioColorField
                      value={document.theme.buttonTextColor}
                      fallback="#FFFFFF"
                      onChange={(value) => onDocumentChange(updateThemeColor(document, "buttonTextColor", value))}
                    />
                  </FormField>
                  <FormField label="Corner style">
                    <Select
                      value={document.theme.borderRadius}
                      onChange={(event) =>
                        onDocumentChange({
                          ...document,
                          theme: {
                            ...document.theme,
                            borderRadius: event.target.value as EmailStudioThemeRadius
                          }
                        })
                      }
                    >
                      <option value="sharp">Sharp</option>
                      <option value="rounded">Rounded</option>
                      <option value="pill">Pill</option>
                    </Select>
                  </FormField>
                </div>
              </StorefrontStudioStorefrontEditorPanelTabSection>
            </StorefrontStudioStorefrontEditorPanelTabContainer>
          )}
        </div>
      </div>
    </aside>
  );
}
