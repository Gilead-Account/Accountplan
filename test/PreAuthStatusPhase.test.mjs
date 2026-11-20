import React from 'react';
import { describe, test, expect, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';

jest.mock('../../lib/helper/utils', () => ({
  formatDate: jest.fn(),
  formatDateLabel: jest.fn(() => '01-Jan-2026'),
}));

import PreAuthStatusPhase from '../index.jsx';

describe('PreAuthStatusPhase', () => {
  test('renders header', () => {
    render(
      <PreAuthStatusPhase
        currentPhase="Evaluating"
        dryRunDate="2026-01-01"
      />
    );

    expect(
      screen.getByText(/Pre-Authorization Status & Phase/i)
    ).toBeInTheDocument();
  });

  test('shows dry run date', () => {
    render(
      <PreAuthStatusPhase
        currentPhase="Evaluating"
        dryRunDate="2026-01-01"
      />
    );

    expect(
      screen.getByText(/01-Jan-2026/)
    ).toBeInTheDocument();
  });

  test('shows current phase label', () => {
    render(
      <PreAuthStatusPhase
        currentPhase="Evaluating"
        dryRunDate="2026-01-01"
      />
    );

    expect(
      screen.getByText(/Current Phase: Evaluating/)
    ).toBeInTheDocument();
  });

  test('supports alias evaluation', () => {
    render(
      <PreAuthStatusPhase
        currentPhase="evaluation"
        dryRunDate="2026-01-01"
      />
    );

    expect(
      screen.getByText(/Current Phase: Evaluating/)
    ).toBeInTheDocument();
  });

  test('unknown phase handled', () => {
    render(
      <PreAuthStatusPhase
        currentPhase="Unknown"
        dryRunDate="2026-01-01"
      />
    );

    expect(
      screen.getByText(/Current Phase:/)
    ).toBeInTheDocument();
  });
});