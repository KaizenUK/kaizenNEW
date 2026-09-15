import React, { type ReactNode, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";

// Keep the editor's theme while Radix owns focus containment and Escape.
// The explicit fallback also handles Preview first replacing the publish dialog.
export default function EditorDialog({
  children,
  className,
  onClose,
  returnFocus,
  initialFocus,
  hasDescription = false,
}: {
  children: ReactNode;
  className: string;
  onClose: () => void;
  returnFocus: RefObject<HTMLElement | null>;
  initialFocus?: RefObject<HTMLElement | null>;
  hasDescription?: boolean;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Content
        className={className}
        {...(hasDescription ? {} : { "aria-describedby": undefined })}
        onOpenAutoFocus={(event) => {
          if (initialFocus?.current) {
            event.preventDefault();
            initialFocus.current.focus();
          }
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // Another dialog may have opened during this one's close.
          if (
            !globalThis.document.querySelector(
              '[role="dialog"][data-state="open"]',
            )
          )
            returnFocus.current?.focus();
        }}
      >
        {children}
      </Dialog.Content>
    </Dialog.Root>
  );
}

export const EditorDialogTitle = Dialog.Title;
export const EditorDialogDescription = Dialog.Description;
