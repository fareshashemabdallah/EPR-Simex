# EPR-Simex platform test checklist

Use fictional cases and synthetic documents only. Do **not** say these cases passed until executed against a real Supabase project.

| ID | Test / scenario | Expected outcome |
|---|---|---|
| AUTH-01 | Sign up and confirm email | Account can sign in |
| AUTH-02 | Unverified email attempts invitation | Rejected |
| TEN-01 | Alice in Agency A and Bob in Agency B | Neither can list other agency data |
| TEN-02 | Guess another organization's UUID via API | No rows |
| ROLE-01 | A participant requests facilitator private_notes via API | No rows / forbidden |
| ROLE-02 | A participant attempts to update exercise status | Forbidden |
| ROLE-03 | A participant attempts to create injects or invite facilitator | Forbidden |
| TEAMS-01 | A user assigned Team Alpha requests Team Beta submissions | No rows / forbidden |
| TEAMS-02 | Support-cell actor sends authorized simulated reply | Works only in assigned scope |
| INJ-01 | Unreleased inject requested by participant | No rows |
| INJ-02 | Released inject targeted to Team Alpha | Alpha sees, Beta does not |
| INJ-03 | Participant attempts to release an inject | Forbidden |
| INJ-04 | Facilitator tries to release before exercise live | Rejected |
| SUB-01 | Team participant saves/submits decision | Only their team/facilitator can read |
| SUB-02 | Participant tries to approve own response | Rejected |
| SUB-03 | Facilitator returns submitted response | Team can revise and resubmit |
| PPT-01 | Present text slides in full screen | Slides advance, no private notes leaked |
| PPT-02 | Uploaded PPTX | Stored privately, download only; no false native playback claim |
| DOC-01 | Staff uploads synthetic PDF | Only authorized users can download |
| DOC-02 | Other agency guesses object path | Forbidden |
| DOC-03 | Invalid file type or oversized file | Rejected by UI/database/storage |
| INV-01 | Verified user accepts invitation for own email | Joins specified org/exercise/team |
| INV-02 | Different email or reused invitation token | Rejected |
| XSS-01 | HTML/script payload in titles and injects | Rendered as text, not executed |
| REL-01 | Network interrupted while submitting | Clear error; verify idempotency/recovery |
| REL-02 | Refresh after signup, session expiry | Safe re-auth or token refresh |
| EXP-01 | CSV export of decisions | Correct team-limited/scope-authorized data |
| AAR-01 | Record 30/60/90 actions | Saved and visible only to authorized users |
| CRUD-01 | Facilitator edits team, stage, draft inject and target team | Changes persist after refresh and are scoped to current exercise |
| CRUD-02 | Facilitator edits training day, session, slide and speaker notes | Presentation reflects changes; notes stay facilitator-only |
| CRUD-03 | Facilitator edits reference link and deletes it | Changes persist; deletion removes the link only |
| CRUD-04 | Original uploader deletes a stored synthetic training file | Object removed through Storage API; document record no longer visible |
| CRUD-05 | Delete a team, stage or training day with dependent records | Blocked with clear instructions; existing data preserved |
| CRUD-06 | Original director deletes own draft exercise with no collaborators/evidence | Requires exact-name confirmation; no other exercise data affected |
| CRUD-07 | Other member attempts to delete a draft exercise or an organization | Rejected |
| CRUD-08 | Participant edits/deletes own draft response then submits | Draft changes persist; submitted response cannot be deleted |
| CRUD-09 | Facilitator tries to edit/delete released inject | Blocked; follow-up inject required |
| CRUD-10 | Staff edits/deletes 30/60/90-day AAR action | Only permitted staff can modify the item |
| CRUD-11 | Facilitator revokes a pending invitation | Old private link cannot be redeemed; accepted membership unaffected |
| CRUD-12 | Attempt direct REST deletion of another organization's or team's record | Forbidden / zero rows |
| CRUD-13 | Mobile Safari opens edit panel, saves, cancels and confirms deletion | All controls accessible, no accidental form submission |


Record test date, account/role, exact request, expected/actual response, server logs, and defect numbers. Independent penetration testing is required for production.
