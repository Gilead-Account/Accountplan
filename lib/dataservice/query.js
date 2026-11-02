// Thin wrappers around the Veeva data service (`window.ds`).
//
// Every function here is one Veeva primitive. They return raw VOD-shaped
// objects (each field is `{ value: <thing> }`). Higher-level composers in
// accountPlan/*.js are responsible for flattening these into the shapes the
// UI wants.
//
// This file has no domain knowledge of the account plan. Keep it that way.

import { ds, isOnline } from '@/lib/dataservice/client';

const runQueryInFlight = new Map();
const currentObjectInFlight = new Map();
const picklistInFlight = new Map();
const objectMetadataInFlight = new Map();

const requestKey = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

/**
 * `IN (...)` clause builder that handles online vs offline VQL syntax.
 * Online: ('a','b'). Offline iPad: {'a','b'}.
 */
export const inClause = (values) => {
  if (!values || !values.length) {
    return isOnline() ? '()' : '{}';
  }
  const joined = values.map((v) => `'${v}'`).join(',');
  return isOnline() ? `(${joined})` : `{${joined}}`;
};

// iPad offline VQL can't resolve cross-object references (`Owner.Name`,
// `Account_vod__r.Name`, etc.). A single dotted field in the SELECT list
// causes the whole query to be rejected and we silently get zero rows.
// Strip them at the boundary so this can never bite again, regardless of
// what a future caller puts in their FIELDS list.
const stripDottedFields = (fields) => {
  if (!Array.isArray(fields)) return fields;
  return fields.filter((f) => typeof f === 'string' && f.indexOf('.') === -1);
};

const safeQueryParams = (params) => {
  if (!params || typeof params !== 'object') return params;
  const { allowDottedFields, ...safeParams } = params;
  if (!Array.isArray(safeParams.fields)) return safeParams;
  if (allowDottedFields) return safeParams;
  const stripped = stripDottedFields(safeParams.fields);
  if (stripped.length === safeParams.fields.length) return safeParams;
  return { ...safeParams, fields: stripped };
};

// Veeva's offline rejection shape varies (Error / plain object / string). The
// page-level error banner reads `.message`, so coerce everything to a real
// Error with a readable message before rethrowing.
const toReadableError = (context, params, err) => {
  const detail =
    (err && (err.message || err.errorMessage || err.msg)) ||
    (typeof err === 'string' ? err : null) ||
    'unknown error';
  const objectName = params && params.object ? ` on ${params.object}` : '';
  const wrapped = new Error(`${context}${objectName}: ${detail}`);
  wrapped.cause = err;
  return wrapped;
};

/**
 * SOQL/VQL-style read. `params = { object, fields, where?, sort?, limit? }`
 * Returns the raw result.data array. Rejects (does not swallow) on error so
 * callers see the real reason for a failure instead of an empty array that
 * looks like "no rows".
 */
export const runQuery = (params) => {
  const safeParams = safeQueryParams(params);
  const key = requestKey(safeParams);
 
  if (key && runQueryInFlight.has(key)) return runQueryInFlight.get(key);
  const request = ds.runQuery(safeParams).then(
    (result) => {
      if (key) runQueryInFlight.delete(key);
    //    return[
    //   {
    //     Id:'a0Cib000003KkTCEA0',
    //     Name:'FY26 - Mock Cancer Center Plan',
    //     Account_vod__r:{KPH_Potential_ATC__c:true},
    //   }
    // ]
     return (result && result.data) || [];
    },
    (err) => {
      if (key) runQueryInFlight.delete(key);
      console.error('[query.runQuery] failed', safeParams, err);
      throw toReadableError('Query failed', safeParams, err);
    }
  );
  if (key) runQueryInFlight.set(key, request);
  return request;
};

/**
 * Single-record read.
 */
export const queryRecord = (params) => {
  return ds.queryRecord(safeQueryParams(params)).then(
    (result) => result && result.data,
    (err) => {
      console.warn('[query.queryRecord] failed', params, err);
      return null;
    }
  );
};

// ── current-object resolution ──────────────────────────────────────────────
//
// Veeva's response shape for `getDataForCurrentObject` varies between
// online CRM and the iPad offline container:
//
//   • Online (sandbox/prod):   { Account_Plan_vod__c: { Id: 'a0X...' } }
//   • iPad offline (some):     { Account_Plan: { Id: { value: 'a0X...' } } }
//   • iPad offline (other):    { data: { ... } } / { response: { ... } }
//   • Sometimes no top-level key at all — the field lives at the root.
//
// extractCurrentObjectField walks all of those shapes. It mirrors the
// legacy app's `extractCurrentObjectFieldValue` in data-repositories.js.

const candidateContainerKeys = (objectApi) =>
  [
    objectApi,
    objectApi && objectApi.replace(/__c$/, ''),
    objectApi && objectApi.replace(/_vod__c$/, ''),
    objectApi && objectApi.replace(/__v$/, ''),
    objectApi && objectApi.replace(/_vod$/, ''),
  ].filter((v, i, arr) => v && arr.indexOf(v) === i);

const unwrapCell = (cell, depth = 0) => {
  if (!cell || typeof cell !== 'object' || depth > 8) return cell;
  if ('value' in cell) return unwrapCell(cell.value, depth + 1);
  if ('display' in cell) return unwrapCell(cell.display, depth + 1);
  return cell;
};

const findNestedValue = (root, fieldApi, depth = 0) => {
  if (!root || depth > 4 || typeof root !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(root, fieldApi)) {
    return unwrapCell(root[fieldApi]);
  }
  for (const key of Object.keys(root)) {
    const found = findNestedValue(root[key], fieldApi, depth + 1);
    if (found !== undefined && found !== null && found !== '') return found;
  }
  return undefined;
};

const parseResponsePayload = (resp) => {
  if (!resp || typeof resp !== 'object') return resp;
  if (resp.data && typeof resp.data === 'object') return resp.data;
  if (resp.response && typeof resp.response === 'object') return resp.response;
  return resp;
};

const extractCurrentObjectField = (resp, objectApi, fieldApi) => {
  const payload = parseResponsePayload(resp);
  if (!payload || typeof payload !== 'object') return null;

  // 1. Try every container-key variant.
  for (const key of candidateContainerKeys(objectApi)) {
    if (payload[key] && typeof payload[key] === 'object') {
      const direct = payload[key][fieldApi];
      if (direct !== undefined && direct !== null && direct !== '') {
        return unwrapCell(direct);
      }
    }
  }

  // 2. Fall through to the root.
  if (payload[fieldApi] !== undefined) {
    const direct = unwrapCell(payload[fieldApi]);
    if (direct !== null && direct !== '') return direct;
  }

  // 3. Recursive search as a last resort.
  const found = findNestedValue(payload, fieldApi);
  if (found !== undefined && found !== null && found !== '') return found;

  // 4. Some iPad responses use lowercase `id` when the request asked for `Id`.
  if (fieldApi === 'Id') {
    const lower = findNestedValue(payload, 'id');
    if (lower !== undefined && lower !== null && lower !== '') return lower;
  }

  return null;
};

/**
 * Returns the value of `field` on the object currently in context inside
 * Veeva CRM. Resilient to the different response shapes between online and
 * iPad offline runtimes.
 */
export const getDataForCurrentObject = (object, field) => {
  const key = requestKey({ object, field });
  if (key && currentObjectInFlight.has(key)) return currentObjectInFlight.get(key);

  const request = ds.getDataForCurrentObject(object, field).then(
    (result) => {
      if (key) currentObjectInFlight.delete(key);
      return extractCurrentObjectField(result, object, field);
    },
    (err) => {
      if (key) currentObjectInFlight.delete(key);
      console.warn('[query.getDataForCurrentObject] failed', { object, field }, err);
      return null;
    }
  );
  if (key) currentObjectInFlight.set(key, request);
  return request;
};

/**
 * Smart-link navigation: opens the native CRM record view.
 */
export const viewRecord = (object, recordId) => {
  return ds.viewRecord({ object, fields: { Id: recordId } });
};

/**
 * Update a single CRM record through Veeva's DataService.
 */
export const updateRecord = (object, recordId, fields) => {
  return ds.updateRecord({ object, id: recordId, fields });
};

/**
 * Create a single CRM record through Veeva's DataService.
 */
export const createRecord = (object, fields) => {
  return ds.createRecord({ object, fields });
};

/**
 * Delete a single CRM record through Veeva's DataService.
 */
export const deleteRecord = (object, recordId) => {
  if (typeof ds.deleteRecord !== 'function') {
    return Promise.reject(new Error(`Delete not supported by current runtime for ${object}.`));
  }
  return ds.deleteRecord({ object, id: recordId });
};

/**
 * Returns translated picklist labels for an object/field combination.
 */
export const getPicklistValueLabels = (object, field) => {
  const key = requestKey({ object, field });
  if (key && picklistInFlight.has(key)) return picklistInFlight.get(key);

  const request = ds.getPicklistValueLabels(object, field).then(
    (result) => {
      if (key) picklistInFlight.delete(key);
      return (result && result[object] && result[object][field]) || {};
    },
    () => {
      if (key) picklistInFlight.delete(key);
      return {};
    }
  );
  if (key) picklistInFlight.set(key, request);
  return request;
};

/**
 * Returns object metadata from the Veeva runtime when the bridge exposes it.
 * The exact payload shape is runtime-owned, so callers parse defensively.
 */
export const getObjectMetadata = (object) => {
  const key = requestKey({ object });
  if (key && objectMetadataInFlight.has(key)) return objectMetadataInFlight.get(key);

  const request = ds.getObjectMetadata({ object }).then(
    (result) => {
      if (key) objectMetadataInFlight.delete(key);
      return result || null;
    },
    (err) => {
      if (key) objectMetadataInFlight.delete(key);
      console.info('[query.getObjectMetadata] unavailable', { object }, err);
      return null;
    }
  );
  if (key) objectMetadataInFlight.set(key, request);
  return request;
};

/**
 * Unwrap a VOD record `{ Id: { value: 'x' }, Name: { value: 'y' } }` to a
 * flat `{ Id: 'x', Name: 'y' }`. Convenience for the composers.
 */
export const unwrap = (record) => {
  if (!record) return null;
  const out = {};
  for (const key of Object.keys(record)) {
    out[key] = unwrapCell(record[key]);
  }
  return out;
};

export const unwrapAll = (records) => (records || []).map(unwrap);

// ── Salesforce ID helpers ──────────────────────────────────────────────────
//
// Veeva on iPad and Veeva online don't agree on whether record IDs come back
// as 15 or 18 characters. A WHERE clause that exact-matches the wrong
// variant returns zero rows. These helpers let callers OR both variants in.

const ID_SUFFIX_TRIPLET_LOOKUP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';

/**
 * Convert a 15-character case-sensitive Salesforce ID to its 18-character
 * case-insensitive form by appending the standard checksum suffix.
 */
const to18CharId = (id15) => {
  if (!id15 || id15.length !== 15) return id15;
  const triplets = [id15.slice(0, 5), id15.slice(5, 10), id15.slice(10, 15)];
  return (
    id15 +
    triplets
      .map((triplet) => {
        let index = 0;
        for (let i = 0; i < 5; i += 1) {
          if (/[A-Z]/.test(triplet[i])) index |= 1 << i;
        }
        return ID_SUFFIX_TRIPLET_LOOKUP[index];
      })
      .join('')
  );
};

const SF_ID_PATTERN = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;

const isLikelySalesforceId = (value) =>
  typeof value === 'string' && SF_ID_PATTERN.test(value.trim());

/**
 * Returns the canonical 18-character form, or the original if already 18.
 * Null-safe.
 */
export const toCanonicalSalesforceId = (value) => {
  if (!isLikelySalesforceId(value)) return null;
  const trimmed = value.trim();
  return trimmed.length === 15 ? to18CharId(trimmed) : trimmed;
};

/**
 * Returns the unique set of forms an ID could appear in (15-char + 18-char).
 * Use this when building a WHERE clause that matches an ID from an unknown
 * runtime, so both forms hit:
 *
 *   buildIdMatchWhere('Id', planId) → "(Id = '15char' OR Id = '18char')"
 */
export const salesforceIdVariants = (value) => {
  const canonical = toCanonicalSalesforceId(value);
  if (!canonical) return [];
  const seen = new Set();
  const out = [];
  for (const candidate of [canonical, canonical.slice(0, 15), value]) {
    if (!candidate || typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
};

const escapeSoqlString = (value) => String(value).replace(/'/g, "\\'");

/**
 * Build a "(field = 'X' OR field = 'Y')" clause covering both 15 and
 * 18-character forms of a Salesforce ID. For non-canonical IDs (e.g.,
 * mock-fixture IDs that don't follow the 15/18-char shape) it falls back
 * to a plain `field = 'value'` exact match so local dev still filters.
 * Returns null only when `value` is empty.
 */
export const buildIdMatchWhere = (fieldApi, value) => {
  if (value === null || value === undefined || value === '') return null;
  const variants = salesforceIdVariants(value);
  if (variants.length === 0) {
    return `${fieldApi} = '${escapeSoqlString(value)}'`;
  }
  if (variants.length === 1) {
    return `${fieldApi} = '${escapeSoqlString(variants[0])}'`;
  }
  return (
    '(' +
    variants.map((v) => `${fieldApi} = '${escapeSoqlString(v)}'`).join(' OR ') +
    ')'
  );
};
