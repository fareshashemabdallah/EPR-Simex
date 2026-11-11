"""Real Chromium smoke test with a fictional, intercepted Supabase API.

No real credentials, no test users, no records sent to the live test backend.
Run from repository root after serving files at localhost:8080:
    python -m playwright install chromium
    python platform/tests/browser_e2e.py
"""
import json
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8080/platform/"
BACKEND = "rqspzcnkbftytldggezc.supabase.co"
USER = {"id": "10000000-0000-4000-8000-000000000099", "email": "facilitator@example.org"}

state = {
    "org": False,
    "exercise": None,
    "teams": [], "stages": [], "injects": [], "inject_targets": [],
    "agenda_days": [], "agenda_sessions": [], "slides": [], "submissions": [],
    "invitations": [], "messages": [], "reviews": [], "document_records": [], "action_items": []
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
    if path.startswith("/auth/v1/token"):
        response = {"user": USER, "access_token": "test-access-token",
                    "refresh_token": "test-refresh-token", "expires_in": 3600}
    elif path == "/auth/v1/user":
        response = USER
    elif path == "/rest/v1/rpc/create_organization":
        state["org"] = True
        response = "org-1"
    elif path == "/rest/v1/org_memberships":
        response = ([{"org_id": "org-1", "role": "org_admin", "status": "active",
                      "organizations": {"id": "org-1", "name": "Fictional Agency"}}]
                    if state["org"] else [])
    elif path == "/rest/v1/exercises":
        if method == "POST":
            state["exercise"] = dict(data, id="ex-1", status="draft")
            response = [state["exercise"]]
        elif method == "PATCH":
            state["exercise"].update(data)
            response = [state["exercise"]]
        else:
            response = [state["exercise"]] if state["exercise"] else []
    elif path == "/rest/v1/exercise_memberships":
        response = ([{"id": "membership-1", "exercise_id": "ex-1",
                       "user_id": USER["id"], "role": "director"}]
                    if state["exercise"] else [])
    elif path.startswith("/rest/v1/"):
        table = path.split("/")[-1]
        if table in state and isinstance(state[table], list):
            if method == "POST":
                entry = dict(data, id=f"{table}-{len(state[table])+1}")
                state[table].append(entry)
                response = [entry]
            elif method == "PATCH":
                key = u.query.split("id=eq.")[-1].split("&")[0]
                entry = next((x for x in state[table] if x["id"] == key), None)
                if entry:
                    entry.update(data)
                    response = [entry]
                else:
                    response = []
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
        check_label(page, "Secure sign-in")
        page.locator('form[data-form="auth"] input[name="email"]').fill(USER["email"])
        page.locator('form[data-form="auth"] input[name="password"]').fill("fictional-password-only")
        page.locator('form[data-form="auth"] button[value="signin"]').click()
        check_label(page, "Create organization")

        page.locator('form[data-form="organization"] input[name="name"]').fill("Fictional Agency")
        page.locator('form[data-form="organization"] button').click()
        page.locator("h2").filter(has_text="Fictional Agency").first.wait_for(timeout=8000)
        page.locator('form[data-form="exercise"] input[name="title"]').fill("Riverland Flood SIMEX")
        page.locator('form[data-form="exercise"] button').click()
        check_label(page, "Riverland Flood SIMEX")

        page.locator('button[data-cmd="tab"][data-tab="teams"]').click()
        page.locator('form[data-form="team"] input[name="name"]').fill("Team Alpha")
        page.locator('form[data-form="team"] button').click()
        check_label(page, "Team Alpha")

        page.locator('button[data-cmd="tab"][data-tab="scenario"]').click()
        page.locator('form[data-form="stage"] input[name="name"]').fill("H0 Activate")
        page.locator('form[data-form="stage"] button').click()
        check_label(page, "H0 Activate")
        page.locator('form[data-form="inject"] select[name="stage"]').select_option("stages-1")
        page.locator('form[data-form="inject"] input[name="title"]').fill("Bridge closure")
        page.locator('form[data-form="inject"] textarea[name="body"]').fill(
            "<img src=x onerror=window.__executed=true> Synthetic disruption."
        )
        page.locator('form[data-form="inject"] button').click()
        check_label(page, "Bridge closure")
        assert page.locator("main img").count() == 0, "XSS: inject content rendered as HTML"
        assert page.evaluate("window.__executed === undefined"), "XSS event executed"

        page.locator('button[data-cmd="tab"][data-tab="control"]').click()
        page.locator('button[data-cmd="status"][data-status="published"]').click()
        page.locator('button[data-cmd="status"][data-status="live"]').click()
        page.locator('button[data-cmd="tab"][data-tab="scenario"]').click()
        page.locator('button[data-cmd="release"]').click()
        check_label(page, "released")
        assert state["injects"][0]["status"] == "released", "Release status not saved"

        page.locator('button[data-cmd="tab"][data-tab="agenda"]').click()
        page.locator('form[data-form="day"] input[name="title"]').fill("Day 1 preparedness")
        page.locator('form[data-form="day"] button').click()
        page.locator('form[data-form="session"] select[name="day"]').select_option("agenda_days-1")
        page.locator('form[data-form="session"] input[name="title"]').fill("Supply readiness")
        page.locator('form[data-form="session"] button').click()
        page.locator('form[data-form="slide"] select[name="session"]').select_option("agenda_sessions-1")
        page.locator('form[data-form="slide"] input[name="title"]').fill("Emergency routes")
        page.locator('form[data-form="slide"] button').click()
        page.locator('button[data-cmd="present"]').click()
        check_label(page, "Emergency routes")
        page.locator('button[data-cmd="close-present"]').click()
        check_label(page, "Course programme")
        assert not errors, f"Browser errors: {errors}"
        print("PASS: Real Chromium sign-in, organization, exercise, team, inject, XSS, release, agenda, slide & presenter")
        browser.close()

if __name__ == "__main__":
    run()
