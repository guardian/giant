import { useState } from "react";

type ControlledOpenProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

export function useControlledOpen(props: ControlledOpenProps) {
  const controlled = props.isOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? props.isOpen! : internalOpen;
  const setOpen = controlled
    ? (v: boolean) => {
        if (!v && props.onClose) props.onClose();
        if (v) setInternalOpen(v);
      }
    : setInternalOpen;

  return { open, setOpen, controlled };
}
