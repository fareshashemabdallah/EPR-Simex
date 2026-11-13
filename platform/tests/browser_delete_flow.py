"""Chromium test for creator-owned draft cleanup on local/published preview.

The Supabase API is intercepted with fictional responses. No real data is deleted.
Actual backend deletion permissions are separately checked in rls_draft_cleanup.sql.
"""
import browser_e2e as sim
from playwright.sync_api import sync_playwright

def run():
    sim.state.update({
        "org": True,
        "orgName": "Fictional Agency",
        "acting_role": "director",
        "exercise": {
            "id": "ex-1", "org_id": "org-1", "created_by": sim.USER["id"],
            "title": "Scratch Exercise", "description": "Disposable test data", "status": "draft",
            "num_days": 3,
        },
        "teams": [{
            "id": "teams-1", "org_id": "org-1", "exercise_id": "ex-1",
            "name": "Draft team", "kind": "team",
        }],
        "team_memberships": [{
            "id": "team_memberships-1", "team_id": "teams-1",
            "user_id": "10000000-0000-4000-8000-000000000066", "exercise_id": "ex-1", "org_id": "org-1",
        }],
        "invitations": [{
            "id": "invitations-1", "exercise_id": "ex-1", "org_id": "org-1", "status": "pending",
        }],
        "messages": [{
            "id": "messages-1", "exercise_id": "ex-1", "org_id": "org-1", "body": "Fictional rehearsal",
        }],
        "injects": [],
        "submissions": [{
            "id": "submissions-1", "exercise_id": "ex-1", "org_id": "org-1",
            "team_id": "teams-1", "body": "A decision that must be preserved", "status": "draft"
        }],
        "document_records": [],
    })
    with sync_playwright() as play:
        browser = play.chromium.launch(headless=True)
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.route(f"https://{sim.BACKEND}/**", sim.handler)
        page.goto(sim.URL, wait_until="load")
        page.locator('button[data-cmd="auth-mode"][data-mode="signin"]').click()
        page.locator('form[data-form="auth"] input[name="email"]').fill(sim.USER["email"])
        page.locator('form[data-form="auth"] input[name="password"]').fill("fictional-password-only")
        page.locator('form[data-form="auth"] button[value="signin"]').click()
        page.locator('button[data-cmd="delete-record"][data-table="exercises"]').click()
        blocker = page.locator(".edit-dialog .notice.error")
        blocker.wait_for(timeout=7000)
        assert "recorded team decisions" in blocker.inner_text()
        assert page.locator('form[data-form="delete-record"] button[type="submit"]').is_disabled()
        assert sim.state["exercise"] is not None, "Protected exercise was deleted"
        page.locator('button[data-cmd="delete-cancel"]').click()

        # Removing the synthetic blocker permits a typed confirmation and deletion.
        sim.state["submissions"].clear()
        page.locator('button[data-cmd="delete-record"][data-table="exercises"]').click()
        page.locator('form[data-form="delete-record"] input[name="confirmation"]').fill("Scratch Exercise")
        page.locator('form[data-form="delete-record"] button[type="submit"]').click()
        page.get_by_text("No exercises are visible", exact=False).wait_for(timeout=7000)
        assert sim.state["exercise"] is None, "Scratch exercise did not delete"
        assert not errors, f"Browser errors: {errors}"
        print("PASS: blocked decision-bearing deletion; authorized draft exercise deleted after typed confirmation")
        browser.close()

if __name__ == "__main__":
    run()
