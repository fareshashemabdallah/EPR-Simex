# Portable EPR-Simex course-pack format (v1)

This is a draft format for independently deployed training foundations. It transfers instructional structure and exercise draft events, not private documents, images or original PowerPoint assets.

The source is a local JSON file. It is NOT committed or copied to the public repository. A facilitator must review and confirm installation into a new, empty, RLS-protected draft exercise.

## Minimal example (all details fictional)

~~~json
{
 "format":"epr-simex-course-pack",
 "format_version":1,
 "title":"Fictional Emergency Training",
 "notice":"Exercise-only information",
 "learning_objectives":"Respond to an evolving emergency",
 "teams":[{"key":"alpha","name":"Team Alpha","kind":"team","description":"Practice team"}],
 "stages":[{"key":"t0","name":"Activation","code":"T0","description":"Emergency begins"}],
 "days":[{"day_number":1,"title":"Foundations","sessions":[{
   "key":"s01","title":"Emergency requirements","session_type":"presentation",
   "start_time":"08:30","end_time":"09:15",
   "learning_objectives":"Convert needs into supply requirements",
   "instructions":"Prepare a requirement sheet",
   "facilitator_notes":"Private teaching prompt",
   "stage_key":"t0",
   "slides":[{"title":"Start with the intervention","body":"What is needed and by when?"}]
 }]}],
 "events":[{
   "key":"event01","stage_key":"t0","release_hint":"09:30",
   "title":"Road closure","body":"A fictional bridge is closed",
   "response_prompt":"Decide how to adapt the logistics plan",
   "facilitator_notes":"Release only after exercise start",
   "target":"all"
 }]
}
~~~

## Import behavior

1. The target exercise must be a fresh draft, with no existing teams, teaching days, slides, stages or events.
2. The JSON is validated locally, including field limits and references to teams and stages.
3. The application creates teams, stages, course days, activities, text slides, private notes, draft scenario events, and authorized recipients.
4. Course learning goals populate a new exercise only when it has no goals already.
5. Participants, credentials, membership, real confidential documents and external resources are NOT imported.
6. All scenario events stay in draft. A suggested release time is private guidance for the facilitator, not automatic scheduling.

**Caution:** Installation makes multiple authenticated API calls; the operation is not transactional. If interrupted, some records may remain. Do not import again into the same exercise. Create a fresh exercise and retry. Atomic server-side import is future work.

## Privacy and permissions

- The local JSON file does not get uploaded to GitHub. Confirmed content is sent to the organization's configured database through its authenticated API.
- Database row-level security remains authoritative. UI-only role hiding is not a security boundary.
- Facilitator notes and release hints are separate restricted records.
- Organizations must review data rights, retention, auditing, backups and production security.

## Common language

Training day is part of the real workshop schedule; scenario stage is a phase in the fictional emergency. An event is an inject. A team decision is not automatically reflected in physical inventory or transport capacities in the current prototype.
