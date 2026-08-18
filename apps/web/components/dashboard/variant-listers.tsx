"use client";

import { Badge } from "@/components/ui/badge";
import {
  Lister,
  ListerActionsMenu,
  ListerEmpty,
  ListerRow,
  ListerRowBody,
  ListerRowControls,
  ListerRowLabel,
  ListerRowMain,
  ListerRowMeta,
  ListerRows,
  type ListerAction,
} from "@/components/dashboard/lister";

/**
 * The variants of a product and the options under one variant. Both the create
 * and edit flows show these, and they behaved identically already - this is the
 * one copy of that behaviour.
 */

export type VariantGroupEntry = {
  key: string;
  label: string;
  optionCount: number;
  archived: boolean;
};

export function VariantsLister({
  groups,
  optionNoun,
  error,
  onAdd,
  onEdit,
  onToggleArchived,
  onDelete,
}: {
  groups: VariantGroupEntry[];
  /** What a second tier is called here, e.g. "size options". */
  optionNoun: (group: VariantGroupEntry) => string;
  error?: string | null;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onToggleArchived: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  return (
    <Lister
      title="Variants"
      addLabel="Add variant"
      onAdd={onAdd}
      description="Create variants, then define option names and values inside each variant."
      error={error}
    >
      {groups.length === 0 ? (
        <ListerEmpty>No variants yet.</ListerEmpty>
      ) : (
        <ListerRows label="Variants">
          {groups.map((group, index) => (
            <ListerRow key={`${group.key}-${index}`} label={group.label}>
              <ListerRowBody>
                <ListerRowMain>
                  <ListerRowLabel title="Edit this variant" onClick={() => onEdit(index)}>
                    {group.label}
                  </ListerRowLabel>
                  <ListerRowMeta>{optionNoun(group)}</ListerRowMeta>
                </ListerRowMain>
                <ListerRowControls>
                  {group.archived ? <Badge variant="secondary">archived</Badge> : null}
                  <ListerActionsMenu
                    label={group.label}
                    actions={[
                      { label: "Edit", onSelect: () => onEdit(index) },
                      { label: group.archived ? "Unarchive" : "Archive", onSelect: () => onToggleArchived(index) },
                      { label: "Delete", onSelect: () => onDelete(index), destructive: true },
                    ]}
                  />
                </ListerRowControls>
              </ListerRowBody>
            </ListerRow>
          ))}
        </ListerRows>
      )}
    </Lister>
  );
}

export type OptionEntry = {
  index: number;
  label: string;
  summary: string;
  archived: boolean;
};

export function OptionsLister({
  options,
  description,
  addDisabled = false,
  onAdd,
  onEdit,
  onToggleArchived,
  onDelete,
}: {
  options: OptionEntry[];
  description: string;
  addDisabled?: boolean;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onToggleArchived: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  return (
    <Lister title="Options" addLabel="Add option" onAdd={onAdd} addDisabled={addDisabled} description={description}>
      {options.length === 0 ? (
        <ListerEmpty>No options yet.</ListerEmpty>
      ) : (
        <ListerRows label="Options">
          {options.map((option) => {
            const actions: ListerAction[] = [
              { label: "Edit", onSelect: () => onEdit(option.index) },
              { label: option.archived ? "Unarchive" : "Archive", onSelect: () => onToggleArchived(option.index) },
              { label: "Delete", onSelect: () => onDelete(option.index), destructive: true },
            ];
            return (
              <ListerRow key={`option-${option.index}`} label={option.label}>
                <ListerRowBody>
                  <ListerRowMain>
                    <ListerRowLabel title="Edit this option" onClick={() => onEdit(option.index)}>
                      {option.label}
                    </ListerRowLabel>
                    <ListerRowMeta>{option.summary}</ListerRowMeta>
                  </ListerRowMain>
                  <ListerRowControls>
                    {option.archived ? <Badge variant="secondary">archived</Badge> : null}
                    <ListerActionsMenu label={option.label} actions={actions} />
                  </ListerRowControls>
                </ListerRowBody>
              </ListerRow>
            );
          })}
        </ListerRows>
      )}
    </Lister>
  );
}
