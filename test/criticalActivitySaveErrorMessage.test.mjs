import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  formatCriticalActivitySaveError,
} from '../src/lib/dataservice/accountPlan/errorMessages.js';

const criticalActivitiesPagePath = new URL('../src/pages/CriticalActivities/index.jsx', import.meta.url);
const barriersDriversPagePath = new URL('../src/pages/BarriersDrivers/index.jsx', import.meta.url);
const overviewPagePath = new URL('../src/pages/Overview/index.jsx', import.meta.url);
const editModalCssPath = new URL('../src/styles/edit-modal.css', import.meta.url);

test('formatCriticalActivitySaveError includes nested Aura error details', () => {
  const error = {
    actions: [
      {
        state: 'ERROR',
        error: [
          {
            event: {
              descriptor: 'markup://aura:serverActionError',
              attributes: {
                values: {
                  error: {
                    message: 'Barrier_and_Tactical_Action__c is required',
                    data: {
                      message: 'Barrier_and_Tactical_Action__c is required',
                      statusCode: 400,
                      errorCode: 'REQUIRED_FIELD_MISSING',
                    },
                  },
                },
              },
            },
          },
        ],
      },
    ],
  };

  const message = formatCriticalActivitySaveError(error);

  assert.match(message, /^Unable to save critical activity\./);
  assert.match(message, /Exact error:/);
  assert.match(message, /Barrier_and_Tactical_Action__c is required/);
  assert.match(message, /REQUIRED_FIELD_MISSING/);
  assert.match(message, /"statusCode": 400/);
});

test('formatCriticalActivitySaveError includes wrapped DataService cause', () => {
  const error = new Error('Create failed on KPH_Critical_Activity__c: unknown error');
  error.cause = {
    data: {
      message: 'bad value for restricted picklist field: Portfolio',
      errorCode: 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST',
    },
  };

  const message = formatCriticalActivitySaveError(error);

  assert.match(message, /Create failed on KPH_Critical_Activity__c: unknown error/);
  assert.match(message, /bad value for restricted picklist field: Portfolio/);
  assert.match(message, /INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST/);
});

test('Critical Activity save handlers use exact error formatter only for save failures', async () => {
  const [criticalActivitiesPage, barriersDriversPage, overviewPage, editModalCss] = await Promise.all([
    readFile(criticalActivitiesPagePath, 'utf8'),
    readFile(barriersDriversPagePath, 'utf8'),
    readFile(overviewPagePath, 'utf8'),
    readFile(editModalCssPath, 'utf8'),
  ]);

  assert.match(criticalActivitiesPage, /formatCriticalActivitySaveError/);
  assert.match(criticalActivitiesPage, /setSaveError\(formatCriticalActivitySaveError\(error\)\)/);
  assert.match(criticalActivitiesPage, /setCreateError\(formatCriticalActivitySaveError\(error\)\)/);
  assert.match(barriersDriversPage, /setActivityError\(formatCriticalActivitySaveError\(error\)\)/);
  assert.match(overviewPage, /setActivityError\(formatCriticalActivitySaveError\(error\)\)/);
  assert.match(editModalCss, /\.critical-activity-edit-error\s*\{[\s\S]*?white-space:\s*pre-wrap/);

  assert.match(criticalActivitiesPage, /setSaveError\(error && error\.message \? error\.message : 'Unable to delete critical activity\.'\)/);
  assert.match(barriersDriversPage, /setActivityError\(error && error\.message \? error\.message : 'Unable to delete critical activity\.'\)/);
  assert.match(overviewPage, /setActivityError\(error\?\.message \|\| 'Unable to delete critical activity\.'\)/);
});
