"""Real Chromium smoke test with a fictional, intercepted Supabase API.

No real credentials, no test users, no records sent to the live test backend.
Run from repository root after serving files at localhost:8080:
    python -m playwright install chromium
    python platform/tests/browser_e2e.py
"""
import json
import os
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

URL = os.environ.get("EPR_APP_URL", "http://127.0.0.1:8080/platform/")
BACKEND = "rqspzcnkbftytldggezc.supabase.co"
USER = {"id": "10000000-0000-4000-8000-000000000099", "email": "facilitator@example.org"}

state = {
    "org": False, "orgName": "Fictional Agency", "signup_requests": 0, "resend_requests": 0, "acting_role": "director",
    "exercise": None,
    "teams": [], "team_memberships": [], "stages": [], "injects": [], "inject_targets": [],
    "agenda_days": [], "agenda_sessions": [], "slides": [], "private_notes": [], "submissions": [],
    "invitations": [], "messages": [], "reviews": [], "document_records": [], "action_items": [], "observations": []
}

def handler(route):
    request = route.request
    u = urlparse(request.url)
    method = request.method
    path = u.path
    response = []
    data = None
    if method in ("POST", "PATCH"):
        try:
            data = json.loads(request.post_data or "{}")
        except json.JSONDecodeError:
            data = {}
    if method == "OPTIONS":
        return route.fulfill(status=204, headers={
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
            "access-control-allow-headers": "apikey,authorization,content-type,prefer,x-upsert",
        })
    if path == "/auth/v1/signup":
        state["signup_requests"] += 1
        response = {"user": USER}
    elif path == "/auth/v1/resend":
        assert "redirect_to=" in u.query, "Resend email redirect URL not provided"
        state["resend_requests"] += 1
        assert data["type"] == "signup", "Resend request must be signup confirmation"
        assert data["email"] == USER["email"], "Resend target differs from registration"
        response = {}
    elif path.startswith("/auth/v1/token"):
        response = {"user": USER, "access_token": "test-access-token",
                    "refresh_token": "test-refresh-token", "expires_in": 3600}
    elif path == "/auth/v1/user":
        response = USER
    elif path == "/rest/v1/rpc/create_organization":
        state["org"] = True
        response = "org-1"
    elif path == "/rest/v1/organizations":
        if method == "PATCH":
            state["orgName"] = data.get("name",state["orgName"])
        if method == "DELETE":
            state["org"] = False
        response = [{"id":"org-1","name":state["orgName"],"description":"Test org"}] if state["org"] or method=="DELETE" else []
    elif path == "/rest/v1/org_memberships":
        response = ([{"org_id": "org-1", "role": "org_admin", "status": "active",
                      "organizations": {"id": "org-1", "name": state["orgName"], "created_by": USER["id"]}}]
                    if state["org"] else [])
    elif path == "/rest/v1/exercises":
        if method == "POST":
            state["exercise"] = dict(data, id="ex-1", status="draft")
            response = [state["exercise"]]
        elif method == "PATCH":
            state["exercise"].update(data)
            response = [state["exercise"]]
        elif method == "DELETE":
            response = [state["exercise"]] if state["exercise"] else []
            state["exercise"] = None
        else:
            response = [state["exercise"]] if state["exercise"] else []
    elif path == "/rest/v1/exercise_memberships":
        response = ([{"id": "membership-1", "exercise_id": "ex-1",
                       "user_id": USER["id"], "role": state["acting_role"]}]
                    if state["exercise"] else [])
    elif path.startswith("/rest/v1/"):
        table = path.split("/")[-1]
        if table in state and isinstance(state[table], list):
            if method == "POST":
                entry = dict(data, id=f"{table}-{len(state[table])+1}")
                if table == "submissions": entry["updated_by"] = USER["id"]
                if table == "invitations": entry.update(status="pending",token="fictional-invite-token")
                state[table].append(entry)
                response = [entry]
            elif method in ("PATCH","DELETE"):
                key = u.query.split("id=eq.")[-1].split("&")[0]
                entry = next((x for x in state[table] if x["id"] == key), None)
                if entry:
                    if method=="PATCH":
                        entry.update(data)
                    else:
                        state[table].remove(entry)
                    response = [entry]
                else:
                    response = []
            else:
                id_filter = parse_qs(u.query).get("id",[None])[0]
                if id_filter and id_filter.startswith("eq."):
                    key = id_filter[3:]
                    response = [x for x in state[table] if x["id"] == key]
                else:
                    response = state[table]
        else:
            response = []
    return route.fulfill(status=200, content_type="application/json",
                         headers={"access-control-allow-origin": "*"}, body=json.dumps(response))

def check_label(page, label):
    try:
        page.get_by_text(label, exact=False).first.wait_for(timeout=8000)
    except Exception:
        print("DIAGNOSTIC expected:", label)
        print("DIAGNOSTIC current screen:", page.locator("body").inner_text()[:4000])
        print("DIAGNOSTIC agenda state:", json.dumps({
            "days": state["agenda_days"], "sessions": state["agenda_sessions"], "slides": state["slides"]
        })[:3000])
        raise

def run():
    with sync_playwright() as play:
        browser = play.chromium.launch(headless=True)
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.route(f"https://{BACKEND}/**", handler)
        page.goto(URL, wait_until="load")
        check_label(page, "Create your account")
        page.locator('form[data-form="auth"] input[name="email"]').fill(USER["email"])
        page.locator('form[data-form="auth"] input[name="password"]').fill("fictional-password-only")
        page.locator('form[data-form="auth"] input[name="confirmPassword"]').fill("fictional-password-only")
        page.locator('form[data-form="auth"] button[value="signup"]').click()
        check_label(page, "Registration request received.")
        assert state["signup_requests"] == 1, "Create account never called the signup endpoint"
        page.locator('button[data-cmd="resend-confirmation"]').click()
        check_label(page, "Supabase accepted the verification request")
        assert state["resend_requests"] == 1, "Resend confirmation did not call the backend"

        page.locator('button[data-cmd="auth-mode"][data-mode="signin"]').click()
        check_label(page, "Sign in")
        page.locator('form[data-form="auth"] input[name="email"]').fill(USER["email"])
        page.locator('form[data-form="auth"] input[name="password"]').fill("fictional-password-only")
        page.locator('form[data-form="auth"] button[value="signin"]').click()
        check_label(page, "Create organization")

        # First-login onboarding is visible, can be completed, and remains restartable.
        page.locator("section.guide-panel").wait_for(timeout=8000)
        check_label(page, "Welcome to EPR-Simex")
        page.locator('button[data-cmd="guide-next"]').click()
        check_label(page, "Your organization")
        page.locator('button[data-cmd="guide-back"]').click()
        check_label(page, "Welcome to EPR-Simex")
        page.locator('button[data-cmd="guide-skip"]').click()
        page.locator('button[data-cmd="guide-start"]').click()
        check_label(page, "Welcome to EPR-Simex")
        page.locator('button[data-cmd="guide-skip"]').click()

        # Always-on Help describes each available section and is dismissible.
        page.locator('button[data-cmd="help-open"]').click()
        page.locator('[role="dialog"] #help-title').wait_for(timeout=8000)
        assert page.locator('[role="dialog"] .help-entry h3').filter(has_text="Situation updates & practice").count() == 1
        assert page.locator('button[data-cmd="help-go"][data-tab="scenario"]').is_disabled()
        page.locator('button[data-cmd="help-close"]').first.click()
        assert page.locator('[role="dialog"]').count() == 0

        page.locator('form[data-form="organization"] input[name="name"]').fill("Fictional Agency")
        page.locator('form[data-form="organization"] button').click()
        page.locator("h2").filter(has_text="Fictional Agency").first.wait_for(timeout=8000)
        page.locator('form[data-form="exercise"] input[name="title"]').fill("Riverland Flood SIMEX")
        page.locator('form[data-form="exercise"] button').click()
        check_label(page, "Riverland Flood SIMEX")

        page.locator(".feature-hint h2").filter(has_text="Overview & next steps").wait_for(timeout=8000)
        page.locator('button[data-cmd="hint-toggle"]').click()
        page.locator('.feature-hint ol li').first.wait_for(timeout=8000)
        page.locator('button[data-cmd="hint-toggle"]').click()
        page.locator('button[data-cmd="help-open"]').click()
        page.locator('button[data-cmd="help-go"][data-tab="scenario"]').click()
        page.locator(".feature-hint h2").filter(has_text="Situation updates & practice").wait_for(timeout=8000)
        page.locator('.feature-hint ol li').first.wait_for(timeout=8000)

        page.locator('nav.workspace-nav button[data-cmd="tab"][data-tab="teams"]').click()
        page.locator('form[data-form="team"] input[name="name"]').fill("Team Alpha")
        page.locator('form[data-form="team"] button').click()
        check_label(page, "Team Alpha")
        page.locator('button[data-cmd="edit-record"][data-table="teams"]').click()
        page.locator('form[data-form="edit-record"] input[name="name"]').fill("Team Alpha Updated")
        page.locator('form[data-form="edit-record"] button[type="submit"]').click()
        check_label(page,"Team Alpha Updated")
        assert state["teams"][0]["name"]=="Team Alpha Updated"

        page.locator('form[data-form="team"] input[name="name"]').fill("Disposable Team")
        page.locator('form[data-form="team"] button').click()
        check_label(page,"Disposable Team")
        page.locator('button[data-cmd="delete-record"][data-table="teams"][data-id="teams-2"]').click()
        page.locator('form[data-form="delete-record"] button[type="submit"]').click()
        assert len(state["teams"])==1, "Disposable team did not delete"


        page.locator('nav.workspace-nav button[data-cmd="tab"][data-tab="scenario"]').click()
        page.locator('form[data-form="stage"] input[name="name"]').fill("H0 Activate")
        page.locator('form[data-form="stage"] button').click()
        check_label(page, "H0 Activate")
        page.locator('button[data-cmd="edit-record"][data-table="stages"]').click()
        page.locator('form[data-form="edit-record"] input[name="name"]').fill("H0 Activation Updated")
        page.locator('form[data-form="edit-record"] button[type="submit"]').click()
        check_label(page, "H0 Activation Updated")

        page.locator('form[data-form="inject"] select[name="stage"]').select_option("stages-1")
        page.locator('form[data-form="inject"] input[name="title"]').fill("Bridge closure")
        page.locator('form[data-form="inject"] textarea[name="body"]').fill(
            "<img src=x onerror=window.__executed=true> Synthetic disruption."
        )
        page.locator('form[data-form="inject"] button').click()
        check_label(page, "Bridge closure")
        page.locator('button[data-cmd="edit-record"][data-table="injects"]').click()
        page.locator('form[data-form="edit-record"] input[name="title"]').fill("Bridge closure — updated")
        page.locator('form[data-form="edit-record"] button[type="submit"]').click()
        check_label(page, "Bridge closure — updated")

        assert page.locator("main img").count() == 0, "XSS: inject content rendered as HTML"
        assert page.evaluate("window.__executed === undefined"), "XSS event executed"

        page.locator('nav.workspace-nav button[data-cmd="tab"][data-tab="control"]').click()
        page.locator('button[data-cmd="status"][data-status="published"]').click()
        page.locator('button[data-cmd="status"][data-status="live"]').click()
        page.locator('nav.workspace-nav button[data-cmd="tab"][data-tab="scenario"]').click()
        page.locator('button[data-cmd="release"]').click()
        check_label(page, "released")
        assert state["injects"][0]["status"] == "released", "Release status not saved"

        page.locator('nav.workspace-nav button[data-cmd="tab"][data-tab="agenda"]').click()
        page.locator('form[data-form="day"] input[name="title"]').fill("Day 1 preparedness")
        page.locator('form[data-form="day"] button').click()
        page.locator('form[data-form="session"] select[name="day"]').select_option("agenda_days-1")
        page.locator('form[data-form="session"] input[name="title"]').fill("Supply readiness")
        page.locator('form[data-form="session"] select[name="stage"]').select_option("stages-1")
        page.locator('form[data-form="session"] textarea[name="objectives"]').fill("Identify a feasible alternative supply route")
        page.locator('form[data-form="session"] textarea[name="notes"]').fill("Facilitator confidential discussion prompt")
        page.locator('form[data-form="session"] button').click()
        check_label(page, "Activity added to the teaching programme.")
        assert state["agenda_sessions"][0]["stage_id"]=="stages-1"
        assert any(n["subject_type"]=="session" and "confidential" in n["body"] for n in state["private_notes"])
        page.locator('button[data-cmd="session-challenge"]').click()
        check_label(page, "Showing related practice")
        page.locator('button[data-cmd="show-all-events"]').click()
        page.locator('nav.workspace-nav button[data-cmd="tab"][data-tab="agenda"]').click()
        check_label(page, "Supply readiness")
        page.locator('form[data-form="slide"] select[name="session"]').select_option("agenda_sessions-1")
        page.locator('form[data-form="slide"] input[name="title"]').fill("Emergency routes")
        page.locator('form[data-form="slide"] button').click()
        page.locator('button[data-cmd="edit-record"][data-table="slides"]').click()
        page.locator('form[data-form="edit-record"] input[name="title"]').fill("Emergency routes revised")
        page.locator('form[data-form="edit-record"] button[type="submit"]').click()
        assert state["slides"][0]["title"] == "Emergency routes revised"
        page.locator('button[data-cmd="present"]').click()
        check_label(page, "Emergency routes revised")
        page.locator('button[data-cmd="close-present"]').click()
        check_label(page, "Course programme")
        page.locator('nav.workspace-nav button[data-cmd="tab"][data-tab="review"]').click()
        page.locator('form[data-form="action"] textarea[name="action"]').fill("Replace outdated contingency maps")
        page.locator('form[data-form="action"] button').click()
        page.locator('button[data-cmd="edit-record"][data-table="action_items"]').click()
        page.locator('form[data-form="edit-record"] textarea[name="action"]').fill("Update contingency maps")
        page.locator('form[data-form="edit-record"] button[type="submit"]').click()
        assert state["action_items"][0]["action"] == "Update contingency maps"
        page.locator('button[data-cmd="delete-record"][data-table="action_items"]').click()
        page.locator('form[data-form="delete-record"] button[type="submit"]').click()
        assert not state["action_items"], "AAR action should be deletable"

        # A participant can see assigned teams/injects and submit a decision.
        state["team_memberships"].append({
            "id": "team_memberships-1", "team_id": "teams-1", "exercise_id": "ex-1",
            "org_id": "org-1", "user_id": USER["id"]
        })
        page.locator('button[data-cmd="signout"]').click()
        state["acting_role"] = "participant"
        page.locator('button[data-cmd="auth-mode"][data-mode="signin"]').click()
        page.locator('form[data-form="auth"] input[name="email"]').fill(USER["email"])
        page.locator('form[data-form="auth"] input[name="password"]').fill("fictional-password-only")
        page.locator('form[data-form="auth"] button[value="signin"]').click()
        page.locator('button[data-cmd="open"][data-id="ex-1"]').click()
        page.locator('nav.workspace-nav button[data-cmd="tab"][data-tab="agenda"]').click()
        assert "Facilitator confidential discussion prompt" not in page.locator("main").inner_text()
        page.locator('nav.workspace-nav button[data-cmd="tab"][data-tab="control"]').click()
        page.locator('button[data-cmd="start-decision"]').first.click()
        check_label(page, "Your team's decisions")
        assert page.locator('form[data-form="response"]').count() == 1, "Participant response form is missing"
        page.locator('form[data-form="response"] select[name="team"]').select_option("teams-1")
        page.locator('form[data-form="response"] select[name="inject"]').select_option("injects-1")
        page.locator('form[data-form="response"] textarea[name="body"]').fill("Initial draft route")
        page.locator('form[data-form="response"] button[value="draft"]').click()
        assert len(state["submissions"]) == 1, "Draft decision was not saved"
        page.locator('button[data-cmd="edit-record"][data-table="submissions"]').click()
        page.locator('form[data-form="edit-record"] textarea[name="body"]').fill("Revised draft route")
        page.locator('form[data-form="edit-record"] button[type="submit"]').click()
        check_label(page,"decision draft updated successfully.")
        assert state["submissions"][0]["body"] == "Revised draft route", "Participant draft edit failed"
        page.locator('button[data-cmd="delete-record"][data-table="submissions"]').click()
        page.locator('form[data-form="delete-record"] button[type="submit"]').click()
        check_label(page,"decision draft deleted.")
        assert len(state["submissions"]) == 0, "Participant draft deletion failed"
        page.locator('form[data-form="response"] select[name="team"]').select_option("teams-1")
        page.locator('form[data-form="response"] select[name="inject"]').select_option("injects-1")
        page.locator('form[data-form="response"] textarea[name="body"]').fill("Use alternate road; logistics unit responsible.")
        page.locator('form[data-form="response"] button[value="submitted"]').click()
        check_label(page, "Decision submitted.")
        assert len(state["submissions"]) == 1, "Participant decision was not saved"
        assert state["submissions"][0]["status"] == "submitted"
        assert page.locator('button[data-cmd="delete-record"][data-table="submissions"]').count() == 0, "Submitted evidence must be locked"

        # Observers receive guidance but cannot submit team decisions.
        page.locator('button[data-cmd="signout"]').click()
        state["acting_role"] = "observer"
        page.locator('button[data-cmd="auth-mode"][data-mode="signin"]').click()
        page.locator('form[data-form="auth"] input[name="email"]').fill(USER["email"])
        page.locator('form[data-form="auth"] input[name="password"]').fill("fictional-password-only")
        page.locator('form[data-form="auth"] button[value="signin"]').click()
        page.locator('button[data-cmd="open"][data-id="ex-1"]').click()
        page.locator('nav.workspace-nav button[data-cmd="tab"][data-tab="responses"]').click()
        assert page.locator('form[data-form="response"]').count() == 0, "Observer must not submit decisions"
        assert "evidence" in page.locator(".feature-hint").inner_text().lower() or "observation" in page.locator(".feature-hint").inner_text().lower()
        page.locator('nav.workspace-nav button[data-cmd="tab"][data-tab="review"]').click()
        page.locator('form[data-form="observation"] select[name="team"]').select_option("teams-1")
        page.locator('form[data-form="observation"] select[name="rating"]').select_option("4")
        page.locator('form[data-form="observation"] textarea[name="note"]').fill("Team considered alternative routing before choosing.")
        page.locator('form[data-form="observation"] button').click()
        assert len(state["observations"]) == 1, "Evaluator observation not stored"
        assert state["observations"][0]["competency"] == "Decision quality"
        check_label(page, "Evidence from observers")
        assert not errors, f"Browser errors: {errors}"
        print("PASS: Chromium onboarding/Help, facilitator exercise, participant decisions, observer restrictions, slides and XSS checks")
        browser.close()

if __name__ == "__main__":
    run()
