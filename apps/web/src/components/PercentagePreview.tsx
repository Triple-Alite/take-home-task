interface PercentagePreviewProps { value: number }

export function PercentagePreview({ value }: PercentagePreviewProps) {
  return (
    <div className="percentage-preview" role="status" aria-live="polite" aria-atomic="true">
      <span className="eyebrow">Products per user</span>
      <strong>{value.toFixed(1)}%</strong>
    </div>
  );
}
