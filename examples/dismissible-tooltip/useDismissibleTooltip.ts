import { useCallback, useState } from "react";

type DismissibleTooltip = {
  active: false | undefined;
  dismissedId: string | null;
  dismiss(id: string): void;
  enter(id: string): void;
  reset(): void;
};

function requireStableId(id: string): void {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("Tooltip IDs must be non-empty strings");
  }
}

export function useDismissibleTooltip(
  { suspended = false }: { suspended?: boolean } = {},
): DismissibleTooltip {
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const dismiss = useCallback((id: string) => {
    requireStableId(id);
    setDismissedId((current) => current === id ? current : id);
  }, []);

  const enter = useCallback((id: string) => {
    requireStableId(id);
    setDismissedId((current) => {
      if (suspended || current === null || current === id) return current;
      return null;
    });
  }, [suspended]);

  const reset = useCallback(() => {
    setDismissedId(null);
  }, []);

  return {
    active: suspended || dismissedId !== null ? false : undefined,
    dismissedId,
    dismiss,
    enter,
    reset,
  };
}
