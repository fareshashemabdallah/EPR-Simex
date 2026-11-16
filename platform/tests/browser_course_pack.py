"""Test local import of a fictional course pack with an intercepted backend.
No real organization accounts or data are contacted; records remain synthetic.
"""
import json
from playwright.sync_api import sync_playwright
from browser_e2e import URL, BACKEND, USER, state, handler, check_label

PACK={
 "format":"epr-simex-course-pack","format_version":1,"title":"Fictional course import",
 "notice":"Synthetic data only","learning_objectives":"Make feasible response choices",
 "teams":[{"key":"alpha","name":"Alpha Team","kind":"team","description":"Fictional participants"}],
 "stages":[{"key":"t0","name":"Initial activation","code":"T0","description":"Floods"}],
 "days":[{"day_number":1,"title":"Foundations","sessions":[{
   "key":"s1","title":"Requirements session","session_type":"presentation",
   "start_time":"08:30","end_time":"09:15","learning_objectives":"Validate first-wave needs",
   "instructions":"Prepare a fictional requirement sheet","facilitator_notes":"PRIVATE TEACHING CUE",
   "stage_key":"t0","slides":[{"title":"First-wave supply","body":"Item, quantity and required-on-site date"}]
 }]}],
 "events":[{"key":"e1","stage_key":"t0","release_hint":"10:15","title":"Route closed",
  "body":"A fictional road has closed","response_prompt":"Decide an alternate route",
  "facilitator_notes":"PRIVATE EXERCISE CONTROL CUE","target":"all"}]
}

def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True)
  page=browser.new_page()
  errors=[]
  page.on("pageerror",lambda e:errors.append(str(e)))
  page.route(f"https://{BACKEND}/**",handler)
  page.goto(URL,wait_until="load")
  page.locator('button[data-cmd="auth-mode"][data-mode="signin"]').click()
  page.locator('form[data-form="auth"] input[name="email"]').fill(USER["email"])
  page.locator('form[data-form="auth"] input[name="password"]').fill("fictional-password-only")
  page.locator('form[data-form="auth"] button[value="signin"]').click()
  page.locator('form[data-form="organization"] input[name="name"]').fill("Fictional Logistics Institute")
  page.locator('form[data-form="organization"] button').click()
  page.locator('form[data-form="exercise"] input[name="title"]').fill("Fictional Import Exercise")
  page.locator('form[data-form="exercise"] button').click()
  page.locator('nav.workspace-nav button[data-cmd="tab"][data-tab="agenda"]').click()
  page.locator('.pack-card summary').click()
  page.locator('form[data-form="pack-review"] input[name="pack"]').set_input_files({
    "name":"synthetic-course.json","mimeType":"application/json",
    "buffer":json.dumps(PACK).encode("utf-8")
  })
  page.locator('form[data-form="pack-review"] button').click()
  check_label(page,"Fictional course import")
  check_label(page,"1 editable text slides")
  page.locator('button[data-cmd="pack-install"]').click()
  check_label(page,"Course installed.")
  assert len(state["teams"])==1, "Team wasn't created"
  assert len(state["stages"])==1, "Stage wasn't created"
  assert len(state["agenda_days"])==1, "Day wasn't created"
  assert len(state["agenda_sessions"])==1, "Session wasn't created"
  assert len(state["slides"])==1, "Slide wasn't created"
  assert len(state["injects"])==1 and state["injects"][0]["status"]=="draft", "Events must remain draft"
  assert len(state["private_notes"])==2, "Private facilitator/session and event notes not stored separately"
  assert state["agenda_sessions"][0]["stage_id"]==state["stages"][0]["id"]
  assert all(row.get("org_id")=="org-1" and row.get("exercise_id")=="ex-1" for key in ["teams","stages","agenda_sessions","slides","injects"] for row in state[key])
  # Verify UI exposes private scenario notes to facilitators only.
  page.locator('nav.workspace-nav button[data-cmd="tab"][data-tab="scenario"]').click()
  page.locator('details.facilitator-cues summary').click()
  check_label(page,"PRIVATE EXERCISE CONTROL CUE")
  page.locator('nav.workspace-nav button[data-cmd="tab"][data-tab="agenda"]').click()
  page.locator('.pack-card summary').click()
  assert page.locator('button[data-cmd="pack-install"]').count()==0
  assert not errors,errors
  browser.close()

if __name__=="__main__":
 run()
 print("PASS: local JSON course import, draft-only events, private cues, isolation and UI")
