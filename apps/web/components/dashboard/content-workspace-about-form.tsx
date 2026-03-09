"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import {
  createId,
  getStringValue,
  parseAboutSections,
  type AboutSectionDraft
} from "@/components/dashboard/store-experience-form-utils";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { setAtPath, useStoreExperienceSection } from "@/components/dashboard/use-store-experience-section";
import { Button } from "@/components/ui/button";

type ContentWorkspaceAboutFormProps = {
  header?: ReactNode;
};

type StoreExperienceImageUploadResponse = {
  imageUrl?: string;
  error?: string;
};

type AboutSectionImagePickerProps = {
  imageUrl: string;
  disabled?: boolean;
  uploading?: boolean;
  onSelectFile: (file: File) => void;
  onRemove: () => void;
};

function AboutSectionImagePicker({ imageUrl, disabled = false, uploading = false, onSelectFile, onRemove }: AboutSectionImagePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canInteract = !disabled && !uploading;

  return (
    <div className="space-y-1">
      <div className="relative w-fit">
        <div
          role="button"
          tabIndex={canInteract ? 0 : -1}
          aria-label={imageUrl ? "Replace section image" : "Upload section image"}
          onClick={() => {
            if (canInteract) {
              inputRef.current?.click();
            }
          }}
          onKeyDown={(event) => {
            if (!canInteract) {
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`group relative h-24 w-24 overflow-hidden rounded-md border border-border bg-muted/15 transition-transform ${canInteract ? "cursor-pointer hover:scale-[1.02]" : "cursor-not-allowed opacity-70"} ${!imageUrl ? "border-dashed bg-muted/10 text-muted-foreground hover:border-primary/45 hover:bg-muted/25 hover:text-foreground" : ""}`}
        >
          {imageUrl ? <Image src={imageUrl} alt="Section image preview" fill unoptimized className="object-cover" /> : null}
          {imageUrl ? (
            <>
              <div className="pointer-events-none absolute inset-0 bg-black/25 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                <Pencil className="h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]" />
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Plus className="h-5 w-5" />
            </div>
          )}
          {uploading ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white">
              Uploading...
            </div>
          ) : null}
        </div>
        {imageUrl ? (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute right-1 top-1 z-10 h-6 w-6 rounded-full p-0"
            disabled={!canInteract}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            aria-label="Remove section image"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {imageUrl ? "Click tile to replace." : "Click tile to upload."}
      </p>
      <p className="text-xs text-muted-foreground">
        PNG, JPG, WEBP, or SVG up to 5MB.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="sr-only"
        disabled={!canInteract}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onSelectFile(file);
          }
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}

export function ContentWorkspaceAboutForm({ header }: ContentWorkspaceAboutFormProps) {
  const formId = "content-workspace-about-form";
  const { loading, saving, draft, setDraft, error, isDirty, save, discard } = useStoreExperienceSection("aboutPage");
  const aboutSections = parseAboutSections(draft.aboutSections);
  const [imageUploadingSectionId, setImageUploadingSectionId] = useState<string | null>(null);
  const [imageUploadMessage, setImageUploadMessage] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  const patchAboutSections = (next: AboutSectionDraft[]) => {
    setDraft((current) => setAtPath(current, "aboutSections", next));
  };

  const updateAboutSection = (sectionId: string, updater: (section: AboutSectionDraft) => AboutSectionDraft) => {
    const next = aboutSections.map((entry) => (entry.id === sectionId ? updater(entry) : entry));
    patchAboutSections(next);
  };

  const uploadAboutSectionImage = async (sectionId: string, file: File) => {
    setImageUploadingSectionId(sectionId);
    setImageUploadError(null);
    setImageUploadMessage(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "about");

    try {
      const response = await fetch("/api/store-experience/image", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as StoreExperienceImageUploadResponse;
      if (!response.ok || !payload.imageUrl) {
        throw new Error(payload.error ?? "Unable to upload image.");
      }
      updateAboutSection(sectionId, (section) => ({ ...section, imageUrl: payload.imageUrl ?? "" }));
      setImageUploadMessage("Image uploaded. Save to publish this change.");
    } catch (uploadError) {
      setImageUploadError(uploadError instanceof Error ? uploadError.message : "Unable to upload image.");
    } finally {
      setImageUploadingSectionId(null);
    }
  };

  const moveAboutSection = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= aboutSections.length) {
      return;
    }
    const next = [...aboutSections];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) {
      return;
    }
    next.splice(toIndex, 0, moved);
    patchAboutSections(next);
  };

  return (
    <form
      id={formId}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.value === "discard") {
          discard();
          return;
        }
        void save();
      }}
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:p-4">
        {header}
        {loading ? <p className="text-sm text-muted-foreground">Loading section...</p> : null}

        <SectionCard title="About Article" description="Long-form brand story content shown on the About page.">
          <FormField label="Article Content" description="Main rich text section for your brand narrative and mission.">
            <RichTextEditor
              value={getStringValue(draft, "aboutArticleHtml", "<p></p>")}
              onChange={(nextValue) => setDraft((current) => setAtPath(current, "aboutArticleHtml", nextValue))}
              placeholder="Tell your brand story..."
              rows={14}
            />
          </FormField>
        </SectionCard>

        <SectionCard title="Structured About Sections" description="Ordered story blocks with optional image and layout control.">
          <div className="space-y-3">
            {aboutSections.map((sectionDraft, index) => (
              <div key={sectionDraft.id} className="space-y-2 rounded-md border border-border/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Section {index + 1}</p>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => moveAboutSection(index, index - 1)}>
                      Up
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={index === aboutSections.length - 1}
                      onClick={() => moveAboutSection(index, index + 1)}
                    >
                      Down
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = aboutSections.filter((entry) => entry.id !== sectionDraft.id);
                        patchAboutSections(next);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                <FormField label="Title" description="Headline for this structured section.">
                  <Input
                    value={sectionDraft.title}
                    onChange={(event) => {
                      updateAboutSection(sectionDraft.id, (section) => ({ ...section, title: event.target.value }));
                    }}
                  />
                </FormField>
                <FormField label="Body" description="Supporting paragraph content for this section.">
                  <Textarea
                    rows={3}
                    value={sectionDraft.body}
                    onChange={(event) => {
                      updateAboutSection(sectionDraft.id, (section) => ({ ...section, body: event.target.value }));
                    }}
                  />
                </FormField>
                <div className="grid gap-2 sm:grid-cols-2">
                  <FormField label="Section Image" description="Click the image tile to upload or replace this section image.">
                    <AboutSectionImagePicker
                      imageUrl={sectionDraft.imageUrl}
                      uploading={imageUploadingSectionId === sectionDraft.id}
                      disabled={saving || loading}
                      onSelectFile={(file) => void uploadAboutSectionImage(sectionDraft.id, file)}
                      onRemove={() => updateAboutSection(sectionDraft.id, (section) => ({ ...section, imageUrl: "" }))}
                    />
                  </FormField>
                  <FormField label="Layout" description="Choose whether the image appears on the left, right, or not at all.">
                    <Select
                      value={sectionDraft.layout}
                      onChange={(event) => {
                        updateAboutSection(sectionDraft.id, (section) => ({
                          ...section,
                          layout: event.target.value as AboutSectionDraft["layout"]
                        }));
                      }}
                    >
                      <option value="image_right">Image right</option>
                      <option value="image_left">Image left</option>
                      <option value="full">Full width text</option>
                    </Select>
                  </FormField>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const next: AboutSectionDraft[] = [
                  ...aboutSections,
                  {
                    id: createId("section"),
                    title: "",
                    body: "",
                    imageUrl: "",
                    layout: "image_right"
                  }
                ];
                patchAboutSections(next);
              }}
            >
              Add about section
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="About Copy"
          description="Edit customer-facing headings and supporting copy used across the About page."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Story Heading" description="Section title for your brand story block.">
              <Input
                value={getStringValue(draft, "copy.about.ourStoryHeading")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.about.ourStoryHeading", event.target.value))}
              />
            </FormField>
            <FormField label="Philosophy Heading" description="Heading for values, principles, or creative approach copy.">
              <Input
                value={getStringValue(draft, "copy.about.whatShapesOurWorkHeading")}
                onChange={(event) =>
                  setDraft((current) => setAtPath(current, "copy.about.whatShapesOurWorkHeading", event.target.value))
                }
              />
            </FormField>
            <FormField className="sm:col-span-2" label="Questions Heading" description="Title above the FAQ-style questions section.">
              <Input
                value={getStringValue(draft, "copy.about.questionsHeading")}
                onChange={(event) => setDraft((current) => setAtPath(current, "copy.about.questionsHeading", event.target.value))}
              />
            </FormField>
          </div>
        </SectionCard>

        <FeedbackMessage type="success" message={imageUploadMessage} />
        <FeedbackMessage type="error" message={imageUploadError} />
      </div>
      <DashboardFormActionBar
        formId={formId}
        saveLabel="Save"
        savePendingLabel="Saving..."
        discardLabel="Discard"
        savePending={saving}
        saveDisabled={!isDirty || saving || loading}
        discardDisabled={!isDirty || saving || loading}
        statusMessage={error}
        statusVariant="error"
      />
    </form>
  );
}
