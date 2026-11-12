# Stakeholder UI-to-CRM Field Mapping Guide

Use this guide when adding a field to the Stakeholder add/edit modal and mapping it to Salesforce/Veeva CRM.

This guide is specific to the current Stakeholder implementation in this repository. Stakeholder records are stored on:

```text
KPH_Stakeholder_Map__c
```

The complete data path is:

```text
KPH_Stakeholder_Map__c.<CRM_Field__c>
  -> STAKEHOLDER_FIELDS query
  -> toStakeholder() CRM-to-UI mapping
  -> StakeholderEditModal form key
  -> buildStakeholderWriteFields() UI-to-CRM mapping
  -> updateStakeholder() or createStakeholder()
  -> updateRecord() or createRecord()
```

## 1. Confirm the CRM contract before editing

Collect and verify all of the following:

| Item | Example |
| --- | --- |
| CRM object | `KPH_Stakeholder_Map__c` |
| CRM field API name | `KPH_New_Field__c` |
| UI label | `New Field` |
| React form key | `newField` |
| CRM data type | Text, Long Text Area, Picklist, Checkbox, Number, Date, etc. |
| Maximum length | For example, `255` |
| Editable on create? | Yes or no |
| Editable on update? | Yes or no |
| Required? | Yes or no |
| Picklist source | CRM metadata field, if applicable |

Do not infer the object or API name from the UI label. Confirm the exact case-sensitive API name in CRM metadata. Confirm that the deployed user profiles have object read/update access and field-level read/edit access.

The worked examples below use placeholders:

```text
CRM field: KPH_New_Field__c
UI key:    newField
UI label:  New Field
```

Replace all three with the approved real values.

## 2. Add the field to the CRM query

Open:

```text
src/lib/dataservice/accountPlan/shared.js
```

Add the exact API name once to `STAKEHOLDER_FIELDS`:

```js
export const STAKEHOLDER_FIELDS = [
  'Id',
  // existing fields...
  'KPH_New_Field__c',
];
```

`fetchStakeholders()` queries `KPH_Stakeholder_Map__c` using this array. If the field is absent here, deployed CRM data cannot reach the UI.

Keep this list unique. A duplicate field can cause the Veeva Data Service query to fail.

## 3. Map the CRM value into the UI model

In the same file, add the field to `toStakeholder()`:

### Text, textarea, picklist, number, or date

```js
export const toStakeholder = (row, accountNameById = null) => {
  const r = unwrap(row);
  if (!r) return null;

  return {
    // existing mappings...
    newField: r.KPH_New_Field__c ?? null,
  };
};
```

Use `?? null` when `0`, `false`, or an empty string could have meaning. Do not use `|| null` for a numeric or boolean field because it would replace valid falsy values.

### Checkbox

```js
newField: normalizeCrmBoolean(r.KPH_New_Field__c),
```

The property name `newField` is the React form key. Use exactly the same key in the modal and write payload.

## 4. Add the field to the Stakeholder modal

Open:

```text
src/pages/Stakeholders/StakeholderEditModal.jsx
```

Add the field descriptor to the section where it should appear:

- `IDENTITY_FIELDS`: Details section
- `DLBCL_FIELDS`: DLBCL section
- `MM_FIELDS`: MM section
- `DLBCL_CHAMPION_FIELDS` or `MM_CHAMPION_FIELDS`: only for the existing champion checkbox-card treatment

### Editable text field

```js
{ label: 'New Field', key: 'newField', readOnly: false },
```

Text is the default type, so `type: 'text'` is optional.

### Editable long-text field

```js
{ label: 'New Field', key: 'newField', readOnly: false, type: 'textarea' },
```

### Editable picklist

```js
{ label: 'New Field', key: 'newField', readOnly: false, type: 'select' },
```

Do not stop after adding `type: 'select'`. Complete the CRM metadata work described in section 7. The current generic select routing sends non-role selects to the shared influence options, which is wrong for an unrelated picklist.

### Editable checkbox

For a standard checkbox, extend the generic `Field` renderer deliberately. The existing checkbox renderer is styled specifically as a clinical/administrative champion card. Only add a field to a champion array when that visual and business meaning are correct.

### Read-only display field

```js
{ label: 'New Field', key: 'newField', readOnly: true, alwaysReadOnly: true },
```

Do not add a read-only field to the CRM write payload.

### Optional help text

Add a help entry:

```js
const STAKEHOLDER_FIELD_HELP = {
  // existing help...
  newField: 'Explain what the user should enter.',
};
```

Then reference it in the descriptor:

```js
{
  label: 'New Field',
  key: 'newField',
  readOnly: false,
  help: STAKEHOLDER_FIELD_HELP.newField,
},
```

`buildInitialForm()` automatically includes the new key when its descriptor is added to one of the existing field arrays.

## 5. Map the form value into the CRM save payload

Open `buildStakeholderWriteFields()` in:

```text
src/lib/dataservice/accountPlan/shared.js
```

This function is the allowlist used by both `updateStakeholder()` and `createStakeholder()`. Add the new mapping using the correct type conversion.

### Text, textarea, or picklist

```js
const buildStakeholderWriteFields = (form) => {
  const fields = {
    // existing fields...
    KPH_New_Field__c: cleanedTextOrNull(form.newField),
  };

  // existing logic...
  return fields;
};
```

`cleanedTextOrNull()` trims text and sends `null` when the user clears the field, allowing CRM to clear the stored value.

### Checkbox

```js
KPH_New_Field__c: normalizeCrmBoolean(form.newField) === true,
```

This always sends a real boolean.

### Number

Use an explicit conversion that preserves zero and clears blank input:

```js
KPH_New_Field__c:
  form.newField === '' || form.newField == null
    ? null
    : Number(form.newField),
```

Validate `Number.isFinite()` before saving if free-form input is possible.

### Date

Send the CRM-supported date value in `YYYY-MM-DD` format or `null`:

```js
KPH_New_Field__c: cleanedTextOrNull(form.newField),
```

### Multi-select picklist

Use the CRM API values joined with semicolons:

```js
KPH_New_Field__c: Array.isArray(form.newField)
  ? form.newField.filter(Boolean).join(';') || null
  : cleanedTextOrNull(form.newField),
```

Do not send display labels when the CRM API values differ from the labels.

## 6. Understand what happens when Save is clicked

No extra Save handler is needed for a normal field added through the existing form.

The current flow is:

1. `StakeholderEditModal` stores the value in `form.newField`.
2. Its Save button calls `onSave(stakeholder.id, form)`.
3. `src/pages/Stakeholders/index.jsx` chooses:
   - `updateStakeholder(id, form)` for an existing row; or
   - `createStakeholder(planId, form)` for a new row.
4. Both operations call `buildStakeholderWriteFields(form)`.
5. The data-service wrapper sends the allowlisted payload to `KPH_Stakeholder_Map__c`.

For an existing Stakeholder, the effective write is:

```js
updateRecord('KPH_Stakeholder_Map__c', stakeholderId, {
  KPH_New_Field__c: value,
});
```

For a new Stakeholder, the same mapped field is included in `createRecord()` together with `KPH_Account_Plan__c` and the required Stakeholder Account lookup.

If the field must be update-only or create-only, do not put it unconditionally in the shared builder. Add explicit operation-specific payload logic and tests.

## 7. Additional steps for a CRM picklist

Picklist options must come from CRM metadata rather than a hard-coded array.

Open:

```text
src/lib/dataservice/accountPlan/stakeholders.js
```

Add the field to `fetchStakeholderPicklists()`:

```js
const [
  // existing results...
  newFieldOptions,
] = await Promise.all([
  // existing requests...
  fetchPicklistOptions('KPH_New_Field__c'),
]);
```

Return it in the picklist object:

```js
return {
  // existing option groups...
  newFieldOptions,
};
```

Pass `newFieldOptions` through:

```text
loadStakeholders()
  -> src/pages/Stakeholders/index.jsx
  -> StakeholderEditModal
  -> optionsForField()
```

Update `optionsForField()` so only this form key uses these options:

```js
const optionsForField = (field) => {
  if (field.key === 'role') return mergeSortedOptions(form[field.key], roleOptions);
  if (field.key === 'newField') return mergeSortedOptions(form[field.key], newFieldOptions);
  return field.type === 'select' ? mergeOptions(form[field.key], influenceOptions) : [];
};
```

This prevents an unrelated picklist from accidentally showing Clinical/Financial/Operational Influence values.

## 8. Update local mock data

Open:

```text
src/lib/mockData/fixtures.js
```

Add the CRM-shaped field to one or more rows under `KPH_Stakeholder_Map__c`:

```js
wrap({
  Id: 'a5E8C00000MockStk1',
  // existing fields...
  KPH_New_Field__c: 'Example local value',
}),
```

Use the CRM field API name in fixtures, not the React form key. The mock adapter wraps fixture values into the same cell shape expected by the query layer.

If it is a picklist, also add realistic metadata for `KPH_New_Field__c` to the mock picklist-label map used by the adapter/tests.

Local fixtures are only for `npm run dev`. Production builds use Veeva `window.ds` and do not fall back to these records.

## 9. Add focused tests

The closest existing regression file is:

```text
test/stakeholderLookupPicklists.test.mjs
```

At minimum, test all applicable boundaries.

### Query field

```js
assert.ok(mod.STAKEHOLDER_FIELDS.includes('KPH_New_Field__c'));
```

### CRM-to-UI mapping

```js
const stakeholder = mod.toStakeholder({
  Id: 'stk-001',
  KPH_New_Field__c: 'CRM value',
});

assert.equal(stakeholder.newField, 'CRM value');
```

### Update payload

```js
await mod.updateStakeholder('stk-001', {
  name: 'Elena Martin',
  profileRecordId: '0038C00000MockHcp1',
  newField: 'Updated value',
});

assert.equal(updates[0].object, 'KPH_Stakeholder_Map__c');
assert.equal(updates[0].fields.KPH_New_Field__c, 'Updated value');
```

### Create payload

```js
await mod.createStakeholder('plan-001', {
  name: 'Elena Martin',
  profileRecordId: '0038C00000MockHcp1',
  newField: 'Created value',
});

assert.equal(creates[0].object, 'KPH_Stakeholder_Map__c');
assert.equal(creates[0].fields.KPH_New_Field__c, 'Created value');
```

For a checkbox, assert exact `true` and `false`. For a number, assert a number rather than a numeric string. For a cleared field, assert `null`.

For a picklist, also assert that `getPicklistValueLabels()` receives:

```js
{
  object: 'KPH_Stakeholder_Map__c',
  field: 'KPH_New_Field__c',
}
```

## 10. Validate locally

Run the focused tests first:

```powershell
node --test --test-concurrency=1 test\stakeholderLookupPicklists.test.mjs test\stakeholderEditModalLayout.test.mjs
```

Start the local app:

```powershell
npm.cmd run dev -- --host=127.0.0.1
```

Open:

```text
http://127.0.0.1:5173/
```

Verify:

1. Open an Account Plan.
2. Open Stakeholders.
3. Add or edit a Stakeholder.
4. Confirm the field appears in the intended section.
5. Enter or select a value.
6. Click Save.
7. Reopen the Stakeholder and confirm the value remains in local state/mock data.
8. Test clearing the value, `false`, or `0` when applicable.
9. Check the browser console for errors.

Local verification proves the UI and mock path; it does not prove CRM field permissions or the Veeva bridge.

## 11. Build and validate the deployable package

Run:

```powershell
npm.cmd run build
```

The production build automatically excludes mock Stakeholder records and uses Veeva `window.ds`.

Before uploading the ZIP, verify:

- The build succeeds.
- The fresh `dist/index.html` contains `KPH_New_Field__c`.
- The fresh ZIP contains `index.html` at its root.
- The production bundle does not contain the example mock value.
- The exact CRM object and field API names are present.
- The user profile has read/edit FLS for the field.

Upload the newest timestamped ZIP under `dist` to Veeva CRM MyInsights. Launch it from a real Account Plan context, edit the field, click Save, refresh/reopen the record, and independently confirm the value on `KPH_Stakeholder_Map__c.KPH_New_Field__c`.

## 12. Special case: the field belongs to another object

Do not add a field from another object to `STAKEHOLDER_FIELDS` or write it with the Stakeholder record ID.

Instead:

1. Identify the owning object and its record ID.
2. Query that object separately.
3. Join the result to the Stakeholder UI model using an explicit lookup ID.
4. Save using `updateRecord('<Owning_Object__c>', owningRecordId, fields)`.
5. Add tests proving both the join key and the write target.

An Account ID, Account Plan ID, Stakeholder Map ID, and Account Profile ID are not interchangeable.

## 13. Completion checklist

- [ ] CRM object and exact field API name were confirmed.
- [ ] Field type, length, allowed values, null behavior, and FLS were confirmed.
- [ ] `STAKEHOLDER_FIELDS` contains the API field once.
- [ ] `toStakeholder()` maps CRM field to the UI key.
- [ ] The modal descriptor uses the same UI key.
- [ ] `buildStakeholderWriteFields()` maps the UI key back to the CRM field.
- [ ] Create/update scope is intentional.
- [ ] Picklist metadata is loaded and routed specifically, if applicable.
- [ ] Local fixtures use the CRM API field name.
- [ ] Read mapping and write payload tests pass.
- [ ] The field renders and saves locally.
- [ ] `git diff --check` passes.
- [ ] `npm.cmd run build` passes.
- [ ] The fresh production ZIP contains the API name and excludes mock values.
- [ ] Live Veeva save was tested with a user who has the required permissions.
