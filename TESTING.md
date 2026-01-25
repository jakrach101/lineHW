# Testing checklist

## Manual
- Import a full LINE log (header + meds + history) and confirm:
  - Header fields populate.
  - Current meds list shows all items.
  - Meds update date is set.
  - Admission orders populate One Day/Continuous (when present).
  - Meds history modal shows "adjust meds" entries.
- Meds search:
  - Search hits and misses both work.
  - Clearing the search restores the full list.
  - Switching tabs does not lose the full list.
- Meds change flow:
  - Open "Adjust meds", edit, save.
  - History shows the new action.
  - "Active meds" excludes stopped items.

## Persistence
- Reload the page and confirm:
  - Meds list is intact.
  - History modal still shows entries.
  - Search still starts from the full list.

## Data checks (optional)
Run in DevTools Console:
```js
JSON.parse(localStorage.getItem('patientLog_medsStore') || 'null');
JSON.parse(localStorage.getItem('patientLog_medsHistory') || '[]').length;
JSON.parse(localStorage.getItem('patientLog_medsHistoryLog') || '[]').length;
```

## Notes
- Meds source-of-truth: `patientLog_medsStore`
- Legacy keys are still synced for compatibility.
