import { render, screen } from '@testing-library/react';
import { PercentagePreview } from './PercentagePreview';

describe('PercentagePreview', () => {
  it('announces the computed percentage accessibly', () => {
    render(<PercentagePreview value={29.2} />);
    expect(screen.getByText('29.2%')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
