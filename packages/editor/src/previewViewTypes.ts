export type PreviewViewProps = {
  "aria-label"?: string;
  documentId: string;
  imageBaseUrl?: string | undefined;
  rawText: string;
  resolvedTheme: "dark" | "light";
  onError?: (error: Error) => void;
  onOpenLinkRequest: (url: string) => void;
};
