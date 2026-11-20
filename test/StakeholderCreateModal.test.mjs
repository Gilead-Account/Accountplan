import React from 'react';
import { describe, test, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';

import StakeholderCreateModal, {
  validateCreateForm,
  matchesRecordTypeName,
  recordTypeLabel,
  filterAllowedRecordTypes,
  findDefaultRecordTypeId,
} from '../StakeholderCreateModal.jsx';

jest.mock('@/pages/AccountProfile/AccountLookupField', () => ({
  __esModule: true,
  default: () => <div data-testid="account-lookup-field">Lookup</div>,
}));

describe('StakeholderCreateModal Helpers', () => {
  test('matchesRecordTypeName', () => {
    const rt = {
      name: 'Prescriber New',
      developerName: 'Prescriber_New_vod',
    };

    expect(
      matchesRecordTypeName(rt, 'Prescriber New')
    ).toBe(true);
  });

  test('recordTypeLabel', () => {
    expect(
      recordTypeLabel({ name: 'Prescriber New' })
    ).toBe('New Prescriber');
  });

  test('filterAllowedRecordTypes', () => {
    const options = [
      { id: '1', name: 'Prescriber New' },
      { id: '2', name: 'Non Prescriber' },
      { id: '3', name: 'Other' },
    ];

    const result = filterAllowedRecordTypes(options);

    expect(result).toHaveLength(2);
  });

  test('findDefaultRecordTypeId', () => {
    const options = [
      { id: '1', name: 'Prescriber New' },
      { id: '2', name: 'Non Prescriber' },
    ];

    expect(
      findDefaultRecordTypeId(options, 'Non Prescriber')
    ).toBe('2');
  });
});

describe('validateCreateForm', () => {
  test('required validations', () => {
    const errors = validateCreateForm({}, []);

    expect(errors.recordTypeId).toBeDefined();
    expect(errors.firstName).toBeDefined();
    expect(errors.lastName).toBeDefined();
    expect(errors.country).toBeDefined();
    expect(errors.credential).toBeDefined();
  });

  test('NPI required validation', () => {
    const form = {
      recordTypeId: '1',
      firstName: 'John',
      lastName: 'Doe',
      credential: 'MD',
      country: 'US',
      npiRequired: true,
      npi: '',
    };

    const errors = validateCreateForm(form);

    expect(errors.npi).toBe('NPI # is required');
  });

  test('manual address validation passes', () => {
    const form = {
      recordTypeId: '1',
      firstName: 'John',
      lastName: 'Doe',
      credential: 'MD',
      country: 'US',
      useParent: false,
      addrCountry: 'USA',
      addrLine1: '123 Main',
      addrCity: 'Dallas',
      addrState: 'TX',
      addrZip: '75001',
    };

    expect(validateCreateForm(form)).toEqual({});
  });
});

describe('StakeholderCreateModal Component', () => {
  const props = {
    salutationOptions: ['Mr'],
    credentialOptions: ['MD'],
    countryOptions: ['US'],
    recordTypeOptions: [
      {
        id: '1',
        name: 'Prescriber New',
        developerName: 'Prescriber_New_vod',
      },
      {
        id: '2',
        name: 'Non Prescriber',
        developerName: 'Non_Prescriber_vod',
      },
    ],
    searchSites: jest.fn(),
    loadAddresses: jest.fn().mockResolvedValue([]),
    onClose: jest.fn(),
    onCreate: jest.fn(),
  };

  test('renders modal', () => {
    render(<StakeholderCreateModal {...props} />);

    expect(
      screen.getByText('Create Stakeholder')
    ).toBeInTheDocument();
  });

  test('cancel button triggers onClose', () => {
    render(<StakeholderCreateModal {...props} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(props.onClose).toHaveBeenCalled();
  });
});