# EPR-Simex: learning design and common terminology

**Prototype only.** No public or organization-specific release is approved yet. All training content in the test environment must be fictional.

## The learning cycle

EPR-Simex's existing Training Studio is the learning system. There is no separate LMS.

1. **Teach:** a presentation or guided discussion introduces a topic and a measurable learning goal.
2. **Practise:** a linked scenario stage presents information that requires a team decision.
3. **Reflect:** facilitators and evaluators discuss what happened, why, and how to improve.

A course may span several days. A session belongs to one day and may link to a **stage** using the existing `agenda_sessions.stage_id` field. Events belong to stages. In the UI, "event" or "situation update" is preferred; **inject** appears only as an explained specialist term. The link is optional. Never pretend a linked event automatically releases: facilitators still control release and the database guards exercise state transitions.

## Universal terminology

| Interface language | Meaning / commonly used alternative |
| --- | --- |
| Teaching programme | Training Studio, course agenda |
| Presentation | Instructor-led teaching activity |
| Group activity | Practical exercise task |
| Situation update | Inject; event in the master scenario events list (MSEL) |
| Stage | Phase of the simulated emergency (not a teaching day) |
| Team decision | Response or submission to a situation update |
| Debrief & evaluation | Reflection, observation, after-action review (AAR) |
| Role-player | Exercise support cell / fictional stakeholder |

Avoid requiring familiarity with UN-specific labels, command structures or acronyms.

## Role-focused workspaces

- **Exercise lead / facilitator:** overview and preparation checklist, teaching programme and slides, event drafting and release, teams, decisions, evidence and improvement actions.
- **Participant:** task-first overview, authorized scenario updates, programme, draft/submitted team decisions, communications and resources. No facilitator configuration controls.
- **Evaluator:** evidence-first overview; can record scoped observations (category, optional rating, example, linked team and event) and use them in the debrief. Cannot alter the teaching programme.
- **Role-player:** only permitted programme, fictional messages and scenario updates; does not manage exercise controls.

All role authorization is enforced by server RLS and API policies. UI hiding alone is not authorization.

## Data and privacy boundaries

- Session learning objectives and participant instructions are ordinary course data.
- **Facilitator cues** are stored separately in `private_notes` with `subject_type='session'`; slide speaker notes are similarly private with `subject_type='slide'`. Do not place private notes in `agenda_sessions.instructions`.
- Evaluator evidence is stored in `observations`. Only permitted oversight roles may insert/read it; observers cannot change training material.
- Document permissions and released update visibility stay enforced by PostgreSQL RLS.
- Submissions and released updates are protected exercise evidence; not freely editable or deletable.

## Design principles

- One primary action per screen; plain language, optional glossary.
- Preparatory scaffolding and clear next steps for newcomers.
- During simulation, show the current situation and relevant team decisions without distracting instructor administration.
- Ask for observable evidence; avoid relying on confidence scores or generic right/wrong judgments.
- Debrief each meaningful stage using **What happened? Why? What next?**
- Provide accessible feedback, avoid unnecessary clicks, and make low-bandwidth operation possible.

## Still required before external organizational use

The current code has **no automatic branching/consequence engine, realtime updates, timed releases, mature evaluation reports, SSO/MFA enforcement or independently deployable production package**. These are future engineering work, not features available in the prototype. Maintain local browser and transactional PostgreSQL RLS tests and test with actual accounts before agency adoption. Independent security review, file malware scanning, backup/restore tests and an open-source licence remain required.
