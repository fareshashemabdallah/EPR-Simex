import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const js=readFileSync(new URL("../app.js", import.meta.url),"utf8");
const sql=readFileSync(new URL("../sql/schema.sql", import.meta.url),"utf8");
const cfg=readFileSync(new URL("../config.js", import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html", import.meta.url),"utf8");
test("client has a real backend auth integration rather than a fake role selector",()=>{
  assert.match(js,/\/auth\/v1\/token/);
  assert.match(js,/\/auth\/v1\/signup/);
  assert.match(js,/auth.uid|auth\.uid|S\.user/);
  assert.match(js,/create_organization/);
});
test("client does not contain hard-coded private keys or known unsafe rendering",()=>{
  assert.doesNotMatch(js,/sb_secret_[A-Za-z0-9]+/);
  assert.doesNotMatch(cfg,/service_role\s*:\s*["'][^"']+["']/);
  assert.match(js,/const esc=/);
  assert.doesNotMatch(js,/eval\s*\(/);
});
test("schema includes RLS, tenancy, exercise and team checks",()=>{
  assert.match(sql,/enable row level security/i);
  for(const f of ["is_org_member","is_ex_member","is_team_member","can_view_inject","can_view_document","accept_invitation"])assert.ok(sql.includes(f),"Missing "+f);
  assert.match(sql,/on public\.injects for select/i);
  assert.match(sql,/on public\.submissions for select/i);
  assert.match(sql,/on public\.private_notes for all/i);
  assert.match(sql,/storage\.objects for select/i);
});
test("storage is private and does not have open browser credentials",()=>{
  assert.match(sql,/'documents','documents',false/);
  assert.match(html,/noindex,nofollow/);
  assert.match(cfg,/supabaseUrl: "https:\/\/[a-z0-9-]+\.supabase\.co"/);
  assert.match(cfg,/publishableKey: "sb_publishable_[A-Za-z0-9_-]+"/);
});
test("core exercise workflows are wired",()=>{
  for(const value of ["create_organization","org_memberships","exercise_memberships","inject_targets","agenda_sessions","private_notes","document_records","submissions","messages","action_items"])assert.ok(js.includes(value),"Missing "+value);
});
