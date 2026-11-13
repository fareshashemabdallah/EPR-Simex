/* EPR-Simex development client. Agency-neutral; NOT production security-approved.
 * The database (RLS) is the authorization boundary: never rely on UI-only roles.
 * Only public Supabase key here; never embed a service_role/secret key. */
"use strict";
const root=document.getElementById("app");
const config=window.EPR_CONFIG||{};
const base=String(config.supabaseUrl||"").trim().replace(/\/$/,"");
const pub=String(config.publishableKey||"").trim();
const configured=/^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(base)&&pub.length>20&&!/service_role|sb_secret/i.test(pub);
const S={session:null,user:null,orgs:[],org:null,exercises:[],ex:null,role:null,tab:"control",d:{},info:"",error:"",invite:new URLSearchParams(location.search).get("invite")||"",inviteUrl:"",present:null,slideIndex:0,authMode:"signup",registrationEmail:"",helpOpen:false,tourActive:null,tourStep:0,hintExpanded:false,editor:null,deletePrompt:null,focusStage:null,selectedInject:null};
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const lines=x=>esc(x).replace(/\r?\n/g,"<br>");
const pill=x=>'<span class="badge '+esc(x)+'">'+esc(x)+'</span>';
const empty=x=>'<div class="empty">'+esc(x)+'</div>';
const when=x=>x?new Date(x).toLocaleString():"—";
const input=(name,label,value="",type="text",required=false)=>'<label for="'+esc(name)+'">'+esc(label)+'</label><input id="'+esc(name)+'" name="'+esc(name)+'" type="'+esc(type)+'" value="'+esc(value)+'" '+(required?"required":"")+'>';
const area=(name,label,value="")=>'<label for="'+esc(name)+'">'+esc(label)+'</label><textarea id="'+esc(name)+'" name="'+esc(name)+'">'+esc(value)+'</textarea>';
const select=(name,label,items,field="name",id="id",blank="Choose…")=>'<label for="'+esc(name)+'">'+esc(label)+'</label><select name="'+esc(name)+'" id="'+esc(name)+'"><option value="">'+esc(blank)+'</option>'+items.map(x=>'<option value="'+esc(x[id])+'">'+esc(x[field])+'</option>').join("")+'</select>';
const val=(fd,key)=>String(fd.get(key)||"").trim();
const uid=()=>S.user?.id;
const exid=()=>S.ex?.id;
const orgid=()=>S.org?.id;
const staff=()=>S.role==="director"||S.role==="facilitator";
const teamIds=()=>new Set((S.d.team_memberships||[]).filter(m=>m.user_id===uid()).map(m=>m.team_id));
const teamsMine=()=>S.d.teams?.filter(t=>teamIds().has(t.id))||[];
const currentTargets=inject=>S.d.inject_targets?.filter(t=>t.inject_id===inject.id).map(t=>t.team_id)||[];
const targetInjects=()=>S.d.injects?.filter(i=>i.status==="released"&&currentTargets(i).some(x=>teamIds().has(x)))||[];
const navButton=(tab,label)=>'<button class="btn small '+(S.tab===tab?"selected":"")+'" type="button" data-cmd="tab" data-tab="'+tab+'">'+label+'</button>';
const row=(title,desc,right="")=>'<div class="item"><div><h3>'+title+'</h3><p>'+desc+'</p></div><div class="row">'+right+'</div></div>';
const actionsFor=x=>x==="draft"?["published"]:x==="published"?["draft","live"]:x==="live"?["paused","completed"]:x==="paused"?["live","completed"]:x==="completed"?["archived","live"]:x==="archived"?["draft"]:[];
function alertMessage(error=false){return S.error?'<div class="notice error" role="alert">'+esc(S.error)+'</div>':S.info?'<div class="notice" role="status">'+esc(S.info)+'</div>':"";}
function flash(message,error=false){S.error=error?String(message):"";S.info=error?"":String(message);render();}

const HELP_TOPICS=[
  {id:"home",title:"My exercises",purpose:"Your entry point for creating or joining an organization and opening its simulation exercises.",staff:"Create an organization, then build an exercise. Existing exercises appear here as soon as your account has access.",participant:"Open an exercise you have been invited to. If nothing appears, ask the facilitator for an invitation.",steps:["Choose the organization workspace using the selector if you belong to more than one.","Create an organization only if you are organizing a training programme.","Create or open an exercise to access its activities."]},
  {id:"control",title:"Overview & next steps",purpose:"Shows what needs attention next, based on your exercise role.",staff:"Complete the preparation checklist, deliver teaching activities and run the exercise when ready.",participant:"Find your next team task, check the programme or open the evaluation workspace as your role allows.",steps:["Check whether the exercise is draft, published or live.","Review the stages and the situation board.","Open Scenario & injects or Decisions for your next task."]},
  {id:"scenario",title:"Situation updates & practice",purpose:"Practise responding to a changing fictional emergency. New situation updates are sometimes called injects.",staff:"Create stages, draft information injects, assign recipient teams and release injects when the exercise reaches the appropriate point.",participant:"Read released injects addressed to your team. Drafts and unrelated team injects should not be accessible.",steps:["Facilitators create a stage such as PREPARE, ACTIVATE or ADAPT.","Add a realistic inject, select its target team and define the expected response.","When the exercise is live, release the inject and have the team submit a response."]},
  {id:"teams",title:"People & teams",purpose:"Define participant groups, exercise roles and simulated external actors.",staff:"Create country or interagency teams and support cells. Send invitation links privately; assigning roles and teams controls access.",participant:"See the groups you are permitted to view. Ask the facilitator if your team or invitation is missing.",steps:["Facilitators create one or more participant teams.","Create a support cell for role-play actors, if needed.","Invite participants using their email addresses and securely share each generated invitation link."]},
  {id:"agenda",title:"Teaching programme & presentations",purpose:"Keep presentations, practice activities, learning goals and reflection in one programme.",staff:"Build days and sessions, add text-based slides and speaker notes, then use Present during delivery.",participant:"Review the course sessions and open available presentation content. Editing is facilitator-only.",steps:["Add a day, then its presentations, group activities and debriefs.","Describe what people should learn and optionally connect a practice stage.","Use slides to teach, then open the linked scenario task and reflect together."]},
  {id:"library",title:"Resources",purpose:"Keep authorized simulation policies, reference links and training files together.",staff:"Add HTTPS links and upload synthetic PDF, PPTX or DOCX files. Choose exercise-wide, facilitator-only or team-specific visibility.",participant:"Open or download only the reference materials made available to your role and team.",steps:["Add a reference link or upload a training document.","Select the intended visibility carefully.","Check that the correct participants can access the document. Do not upload confidential agency materials."]},
  {id:"responses",title:"Team decisions",purpose:"Capture the decisions teams make after receiving scenario injects.",staff:"Review submitted decisions, accept or return responses and export accessible results to CSV.",participant:"Choose your assigned team and a released inject. Record the decision and rationale, save a draft or submit.",steps:["Read a released inject and agree on the team decision.","Record the rationale, planned action, responsible function and timing.","Submit for facilitator review, or revise if the response is returned."]},
  {id:"messages",title:"Exercise messages",purpose:"Exchange fictional operational updates between exercise roles and teams.",staff:"Send exercise messages to authorized teams or support cells. Messages in this prototype update when the page is refreshed.",participant:"Communicate within your assigned team or permitted simulation channels. This is not an external email or messaging service.",steps:["Select the permitted recipient or team context.","Write a fictional exercise update or question.","Send and refresh the workspace to check new messages."]},
  {id:"review",title:"Debrief & evaluation",purpose:"Observe what happened, discuss why, and agree how to improve future responses.",staff:"Review submission and acceptance counts, then record 30-, 60- and 90-day improvement actions.",participant:"Reflect on what happened, why, and what you would do differently next time.",steps:["Identify what went well and the gaps observed during the exercise.","Agree on responsible owners and measurable improvements.","Record the follow-up horizon (30, 60 or 90 days)."]}
];
const helpFor=id=>HELP_TOPICS.find(x=>x.id===id)||HELP_TOPICS[0];
const helpBlurb=item=>staff()||!S.ex?(S.ex?item.staff:S.org?.role==="org_admin"?item.staff:item.participant):S.role==="observer"?"Observe the exercise and record learning; you are not expected to manage facilitator controls.":S.role==="support_actor"?"Use this area for authorized simulation-cell role play and communications. Ask your facilitator for an assignment.":item.participant;
function userGuide(){if(S.tourActive!==null)return;let completed=false;try{completed=sessionStorage.getItem("epr-simex-guide-"+uid())==="done";}catch{}S.tourActive=!completed;}
function closeGuide(){S.tourActive=false;try{sessionStorage.setItem("epr-simex-guide-"+uid(),"done");}catch{}}
function tourSteps(){
  if(!S.ex)return [
    {title:"Welcome to EPR-Simex",body:"This platform lets humanitarian teams rehearse a fictional emergency together, make decisions and capture lessons. It is a test system; use fictional data only."},
    {title:"Your organization",body:S.orgs.length?"Choose the correct organization in the selector. You will only see workspaces that permit your account.":"The training organizer creates an organization. Participants join through a private facilitator invitation."},
    {title:"Your exercise",body:S.exercises.length?"Open your assigned exercise to find the briefing, agenda and team activities.":"Facilitators build the exercise; participants should follow their invitation link before expecting to see one."},
    {title:"Learn as you go",body:"Use the Help button at any time. Every exercise tab explains what it is for and how to use it. The tour can be restarted."}
  ];
  const who=staff()?"As a facilitator, you prepare teams, release fictional updates and review decisions.":"As a participant or observer, use the sections your role permits. You cannot control the live scenario.";
  return [
    {title:"Your exercise workspace",body:who},
    {title:"Understand the scenario",body:"Start at Briefing/Live control, then open Scenario & injects for the stages and authorized updates."},
    {title:"Work as a team",body:"Teams defines membership, Decisions records responses, and Messages supports fictional exercise communication."},
    {title:"Learn from the exercise",body:"The Training studio provides sessions, the Document library provides references, and Evaluation & AAR captures improvements."}
  ];
}
function guidePanel(){
  if(!S.tourActive)return '<div class="guide-reopen"><span>New to EPR-Simex? Explore what each section does.</span> <button type="button" class="link" data-cmd="guide-start">Start guided walkthrough</button></div>';
  const steps=tourSteps(),i=Math.min(Math.max(S.tourStep,0),steps.length-1),step=steps[i];
  return '<section class="guide-panel" aria-label="Getting started walkthrough"><div class="row between"><span class="kicker">GETTING STARTED · STEP '+(i+1)+' OF '+steps.length+'</span><button type="button" class="btn small" data-cmd="guide-skip">Dismiss</button></div><h2>'+esc(step.title)+'</h2><p>'+esc(step.body)+'</p><div class="row between"><div class="guide-dots" aria-label="Walkthrough progress">'+steps.map((_,j)=>'<span class="'+(j===i?'current':'')+'"></span>').join("")+'</div><div class="row"><button type="button" class="btn small" data-cmd="guide-back" '+(i===0?'disabled':'')+'>Back</button><button type="button" class="btn small primary" data-cmd="'+(i===steps.length-1?'guide-skip':'guide-next')+'">'+(i===steps.length-1?'Finish':'Next')+'</button></div></div></section>';
}
function featureHint(){
  const item=helpFor(S.tab);
  return '<section class="feature-hint" aria-label="About this feature"><div class="row between"><div><span class="kicker">WHAT IS THIS SECTION?</span><h2>'+esc(item.title)+'</h2></div><button class="btn small" type="button" data-cmd="hint-toggle" aria-expanded="'+(S.hintExpanded?'true':'false')+'">'+(S.hintExpanded?'Hide steps':'How to use')+'</button></div><p>'+esc(item.purpose)+' '+esc(helpBlurb(item))+'</p><p class="tiny muted"><b>Managing entries:</b> Where permitted, use Edit or Delete next to the item. Drafts can be corrected; released injects and submitted evidence are protected. Deleting an item that has dependent records is blocked until those links are removed.</p>'+(S.hintExpanded?'<ol class="guide-steps">'+item.steps.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ol>'+termLegend():'')+'</section>';
}
function helpDialog(){
  if(!S.helpOpen)return '';
  const role=S.ex?(S.role||"exercise member"):(S.org?.role||"new user");
  return '<div class="help-overlay"><section role="dialog" aria-modal="true" aria-labelledby="help-title" class="help-dialog"><div class="row between"><div><span class="kicker">IN-APP USER GUIDE</span><h2 id="help-title">How EPR-Simex works</h2><p class="tiny">Your current role: '+esc(role)+' · Information shown depends on your access.</p></div><button class="btn" type="button" data-cmd="help-close">Close</button></div><p>Open a section to learn what it does. The descriptions reflect features available in this development prototype.</p>'+termLegend()+'<div class="help-list">'+HELP_TOPICS.map(item=>'<article class="help-entry"><h3>'+esc(item.title)+'</h3><p>'+esc(item.purpose)+'</p><p class="tiny">'+esc(helpBlurb(item))+'</p><details><summary>Step-by-step guidance</summary><ol class="guide-steps">'+item.steps.map(step=>'<li>'+esc(step)+'</li>').join("")+'</ol></details><button type="button" class="btn small" data-cmd="help-go" data-tab="'+esc(item.id)+'" '+(item.id!=="home"&&!S.ex?'disabled title="Open an exercise first"':'')+'>Go to '+esc(item.id==="home"?"dashboard":"this section")+'</button></article>').join("")+'</div><div class="row between"><p class="tiny">This is a training prototype; no confidential documents or real operational response data.</p><button type="button" class="btn primary small" data-cmd="help-close">Done</button></div></section></div>';
}

function chrome(content){root.innerHTML='<div class="banner">DEVELOPMENT PROTOTYPE · SECURITY REVIEW PENDING · NO CONFIDENTIAL AGENCY DATA</div><header class="top"><div class="logo">◈ EPR-Simex <b>Platform</b></div><div class="top-actions">'+(S.user?'<span class="tiny">'+esc(S.user.email)+'</span><button class="btn small" data-cmd="home">Dashboard</button><button class="btn small" data-cmd="help-open" aria-label="Open user guide">? Help</button><button class="btn small" data-cmd="signout">Sign out</button>':'Independent humanitarian simulation system')+'</div></header><main class="wrap">'+alertMessage()+content+'</main>'+(S.user?helpDialog()+editingOverlay()+deletionOverlay():"");}
function configScreen(){chrome('<div class="auth card stack"><span class="kicker">Database connection required</span><h1>EPR-Simex Platform</h1><p>The shared multi-user system has not been connected to its Supabase test project. The existing READY72 demo still works separately.</p><div class="notice warn">1. Create an isolated test Supabase project.<br>2. Review and run <b>platform/sql/schema.sql</b>.<br>3. Set the public project URL and publishable key in <b>platform/config.js</b>.<br>4. Configure verified email sign-ins and redirect URL.</div><p><b>Never commit private files, service-role keys or database passwords to GitHub.</b></p><p class="muted tiny">This page intentionally does not simulate authentication or pretend to save shared exercise data.</p></div>');}
function authScreen(){
  const signup=S.authMode==="signup";
  const heading=S.registrationEmail?"Email verification":(signup?"Create your account":"Sign in");
  const switcher='<div class="row" style="margin:.5rem 0 1rem"><button type="button" class="btn '+(signup?'selected':'')+'" data-cmd="auth-mode" data-mode="signup">Create account</button><button type="button" class="btn '+(!signup?'selected':'')+'" data-cmd="auth-mode" data-mode="signin">Sign in</button></div>';
  const explain=S.registrationEmail?'<div class="notice" role="status"><b>Registration request received.</b> If '+esc(S.registrationEmail)+' requires confirmation and email delivery is configured, Supabase may send a message. Check Inbox and Spam/Junk. <b>This does not guarantee an email was sent.</b> If you already created an account, choose <b>Sign in</b> instead. The test project requires an SMTP provider before confirmation emails can reliably reach external colleagues.</div>':'';
  const more=signup&&!S.registrationEmail?'<label for="confirmPassword">Confirm password</label><input id="confirmPassword" name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required>':'';
  const credentialForm='<form class="form" data-form="auth">'+input("email","Email address",S.registrationEmail||"","email",true)+'<label for="password">Password (at least 8 characters)</label><input id="password" name="password" type="password" minlength="8" autocomplete="'+(signup?'new-password':'current-password')+'" required>'+more+'<button class="btn primary" type="submit" name="intent" value="'+(signup?'signup':'signin')+'">'+(signup?'Create my account':'Sign in')+'</button></form>';
  chrome('<div class="auth card stack"><span class="kicker">EPR-Simex • Test environment</span><h1>'+heading+'</h1><p>'+(signup?'Register with an email address you can access. You must verify it before signing in.':'Use the email and password you registered with.')+'</p>'+switcher+explain+(S.registrationEmail&&signup?'<div class="row"><button type="button" class="btn primary" data-cmd="resend-confirmation">Request another confirmation email</button><button type="button" class="btn" data-cmd="auth-start-over">Use another email</button></div>':credentialForm)+'<p class="tiny muted">For testing only. Please do not use agency credentials or upload confidential documents.</p></div>');
}
function saveSession(s){S.session=s;S.user=s?.user||null;try{if(s)sessionStorage.setItem("epr-platform-auth",JSON.stringify(s));else sessionStorage.removeItem("epr-platform-auth");}catch{}}
function savedSession(){try{return JSON.parse(sessionStorage.getItem("epr-platform-auth")||"null");}catch{return null;}}
async function request(path,opt={}){if(opt.auth!==false&&S.session?.expires_at&&Date.now()/1000>S.session.expires_at-75)await refreshAuth();const headers={apikey:pub,...(opt.headers||{})};if(opt.auth!==false&&S.session?.access_token)headers.Authorization="Bearer "+S.session.access_token;if(opt.body!==undefined&&!opt.raw)headers["Content-Type"]="application/json";let r;try{r=await fetch(base+path,{method:opt.method||"GET",headers,body:opt.body===undefined?undefined:opt.raw?opt.body:JSON.stringify(opt.body)});}catch{throw Error("Connection failed. Check internet access and Supabase URL.");}const text=await r.text();let data;try{data=text?JSON.parse(text):null;}catch{data=text;}if(!r.ok){const code=data?.error_code||data?.code||"";if(code==="email_address_not_authorized")throw Error("Confirmation emails are restricted to Supabase project-team addresses. Set up custom SMTP to invite external testers.");if(code==="over_email_send_rate_limit")throw Error("Supabase email sending limit has been reached. Try again later or configure custom SMTP.");throw Error(data?.message||data?.error_description||data?.msg||data?.error||"Request failed: "+r.status);}return data;}
const qry=(table,query="")=>request("/rest/v1/"+table+query);
const insert=(table,body)=>request("/rest/v1/"+table+"?select=*",{method:"POST",headers:{Prefer:"return=representation"},body}).then(x=>x?.[0]);
const update=(table,id,body)=>request("/rest/v1/"+table+"?id=eq."+encodeURIComponent(id)+"&select=*",{method:"PATCH",headers:{Prefer:"return=representation"},body}).then(x=>x?.[0]);
const deleteRow=(table,id)=>request("/rest/v1/"+table+"?id=eq."+encodeURIComponent(id)+"&select=*",{method:"DELETE",headers:{Prefer:"return=representation"}}).then(x=>x?.[0]);
const rpc=(fn,body)=>request("/rest/v1/rpc/"+fn,{method:"POST",body});
async function refreshAuth(){let s=savedSession();if(!s){saveSession(null);return;}if(s.expires_at&&Date.now()/1000<s.expires_at-65){saveSession(s);return;}try{s=await request("/auth/v1/token?grant_type=refresh_token",{method:"POST",auth:false,body:{refresh_token:s.refresh_token}});s.expires_at=Math.floor(Date.now()/1000)+(s.expires_in||3600);saveSession(s);}catch{saveSession(null);}}
async function signIn(email,password){let s=await request("/auth/v1/token?grant_type=password",{method:"POST",auth:false,body:{email,password}});s.expires_at=Math.floor(Date.now()/1000)+(s.expires_in||3600);saveSession(s);}
async function signUp(email,password){const destination=location.origin+location.pathname+(S.invite?"?invite="+encodeURIComponent(S.invite):"");const r=await request("/auth/v1/signup?redirect_to="+encodeURIComponent(destination),{method:"POST",auth:false,body:{email,password}});if(r.access_token){r.expires_at=Math.floor(Date.now()/1000)+(r.expires_in||3600);saveSession(r);}return r;}
async function resendConfirmation(email){
  if(!email||!email.includes("@"))throw Error("Enter an email address first.");
  const destination=location.origin+location.pathname+(S.invite?"?invite="+encodeURIComponent(S.invite):"");
  await request("/auth/v1/resend?redirect_to="+encodeURIComponent(destination),{method:"POST",auth:false,body:{type:"signup",email}});
}
function parseEmailConfirmation(){const p=new URLSearchParams((location.hash||"").replace(/^#/,""));const token=p.get("access_token"),refresh=p.get("refresh_token");if(token&&refresh){let expires=Number(p.get("expires_in")||3600);saveSession({access_token:token,refresh_token:refresh,token_type:"bearer",expires_in:expires,expires_at:Math.floor(Date.now()/1000)+expires,user:null});history.replaceState(null,"",location.pathname+location.search);return true;}if(p.get("error_description")){S.error=p.get("error_description");history.replaceState(null,"",location.pathname+location.search);}return false;}
async function restoreConfirmedIdentity(){if(!S.session?.access_token||S.user)return;try{const u=await request("/auth/v1/user");if(u?.id){S.session.user=u;saveSession(S.session);}}catch{saveSession(null);}}
async function signOut(){try{await request("/auth/v1/logout",{method:"POST"});}catch{}saveSession(null);S.org=null;S.ex=null;S.orgs=[];S.invite="";S.editor=null;S.deletePrompt=null;S.helpOpen=false;S.tourActive=null;S.tourStep=0;S.info="You are signed out.";render();}
async function dashboard(){if(!S.user){render();return;}let memberships=await qry("org_memberships","?select=org_id,role,status,organizations(id,name,created_by)&user_id=eq."+uid()+"&status=eq.active");S.orgs=(memberships||[]).map(m=>({id:m.org_id,name:m.organizations?.name||"Organization",created_by:m.organizations?.created_by||null,role:m.role}));S.org=S.orgs.find(o=>o.id===orgid())||S.orgs[0]||null;S.exercises=S.org?await qry("exercises","?select=*&org_id=eq."+orgid()+"&order=created_at.desc"):[];S.ex=null;render();}
function homeScreen(){chrome('<div class="hero"><div><span class="kicker">Organization workspaces</span><h1>Your simulation exercises</h1><p>Design and deliver full humanitarian training programmes.</p></div>'+(S.org?'<label for="org-picker">Organization</label><select id="org-picker">'+S.orgs.map(o=>'<option value="'+esc(o.id)+'" '+(o.id===orgid()?"selected":"")+'>'+esc(o.name)+'</option>').join("")+'</select>':'')+'</div>'+guidePanel()+'<div class="cols"><section class="stack"><div class="card"><h2>'+(S.org?esc(S.org.name):"No organization yet")+'</h2>'+(S.org?recordActions("organizations",{id:S.org.id,name:S.org.name}):"")+'<p>'+(S.org?"Your role: "+esc(S.org.role):"Create your first training organization below.")+'</p></div><div class="card stack"><h2>Exercises</h2>'+(S.exercises.length?'<div class="list">'+S.exercises.map(e=>row(esc(e.title),esc(e.description||"No description"),pill(e.status)+recordActions("exercises",e)+'<button class="btn primary small" data-cmd="open" data-id="'+esc(e.id)+'">Open</button>')).join("")+'</div>':empty("No exercises are visible to this account."))+'</div></section><aside class="stack"><div class="card"><h3>Create organization</h3><form data-form="organization" class="form">'+input("name","Organization name","","text",true)+area("description","Description")+'<button class="btn primary">Create organization</button></form></div>'+(S.org&&["org_admin","facilitator"].includes(S.org.role)?'<div class="card"><h3>Build an exercise</h3><form data-form="exercise" class="form">'+input("title","Exercise title","","text",true)+area("description","Scenario background")+input("num_days","Number of training days","3","number",true)+'<button class="btn primary">Create exercise</button></form></div>':'')+'</aside></div>');}
async function loadExercise(id,tab){let ex=S.exercises.find(e=>e.id===id)|| (await qry("exercises","?select=*&id=eq."+encodeURIComponent(id)))[0];if(!ex)throw Error("This exercise is not accessible to your account.");S.ex=ex;S.tab=tab||"control";S.focusStage=null;S.selectedInject=null;await refreshExercise();}
async function refreshExercise(){const id=exid();if(!id)return dashboard();const tables=["exercise_memberships","teams","team_memberships","stages","injects","inject_targets","submissions","agenda_days","agenda_sessions","slides","private_notes","document_records","messages","reviews","audit_events","action_items","invitations","observations"];const data=await Promise.all(tables.map(t=>qry(t,"?select=*&exercise_id=eq."+id+(["inject_targets","agenda_days","slides","private_notes","observations"].includes(t)?"":"&order=created_at.asc"))));S.d={};for(let k=0;k<tables.length;k++){let table=tables[k];if(Array.isArray(data[k]))S.d[table]=data[k];else S.d[table]=[];}S.role=(S.d.exercise_memberships.find(m=>m.user_id===uid())||{}).role||null;const exRow=(await qry("exercises","?select=*&id=eq."+id))[0];if(exRow)S.ex=exRow;render();}
const d=(key)=>S.d[key]||[];

// Explicit per-table fields: IDs, tenant ownership, membership, and audit columns are never editable.
const EDIT_FIELDS={
  organizations:[["name","Organization name","text",true],["description","Description","textarea"]],
  exercises:[["title","Exercise title","text",true],["description","Scenario background","textarea"],["objectives","Learning objectives","textarea"],["scenario_summary","Scenario summary","textarea"],["num_days","Number of days","number",true]],
  teams:[["name","Group name","text",true],["kind","Group type","select",true,[["team","Participant team"],["support_cell","Support cell"]]],["description","Purpose / assignment","textarea"]],
  stages:[["name","Stage title","text",true],["code","Time label","text"],["description","Situation context","textarea"]],
  injects:[["title","Inject title","text",true],["stage_id","Scenario stage","stage",true],["body","Situation update","textarea"],["response_prompt","Required team decision","textarea"],["recipients","Recipient teams","recipients"]],
  agenda_days:[["day_number","Day number","number",true],["title","Training day title","text",true]],
  agenda_sessions:[["day_id","Training day","day",true],["title","Session title","text",true],["session_type","Session type","select",true,[["presentation","Presentation"],["exercise","Exercise"],["debrief","Debrief"],["break","Break"],["other","Other"]]],["start_time","Start time","time"],["end_time","End time","time"],["learning_objectives","What should participants learn?","textarea"],["instructions","Instructions participants can see","textarea"],["stage_id","Related exercise stage (optional)","stage"],["notes","Facilitator teaching cues (private)","textarea"]],
  slides:[["title","Slide title","text",true],["body","Slide content","textarea"],["notes","Private speaker notes","textarea"]],
  document_records:[["title","Document title","text",true],["description","Description","textarea"],["category","Category","text"],["version","Version","text"],["visibility","Who can view?","select",true,[["facilitators","Facilitators only"],["exercise","Everyone in exercise"],["team","Selected team"]]],["team_id","Team (only if team visibility)","team"],["url","HTTPS link","url"]],
  submissions:[["body","Your team's decision / rationale","textarea",true]],
  action_items:[["action","Recommended improvement","textarea",true],["owner_name","Responsible owner","text"],["horizon","Follow-up horizon","select",true,[["30","30 days"],["60","60 days"],["90","90 days"]]]]
};
const DISPLAY_NAMES={organizations:"organization",exercises:"exercise",teams:"team / support cell",stages:"stage",injects:"scenario inject",agenda_days:"training day",agenda_sessions:"training session",slides:"presentation slide",document_records:"reference document",submissions:"decision draft",action_items:"AAR action",invitations:"invitation"};
function canEditRecord(table,x){
  if(!x||!S.user)return false;
  if(table==="organizations")return S.orgs.some(o=>o.id===x.id&&o.role==="org_admin");
  if(table==="exercises")return (S.ex?.id===x.id&&staff())||x.created_by===uid();
  if(table==="submissions")return S.role==="participant"&&teamIds().has(x.team_id)&&["draft","returned"].includes(x.status);
  if(table==="injects")return staff()&&x.status!=="released";
  if(table==="document_records")return staff();
  return !!EDIT_FIELDS[table]&&staff();
}
function canDeleteRecord(table,x){
  if(!x||!S.user)return false;
  if(table==="organizations")return S.orgs.some(o=>o.id===x.id&&o.role==="org_admin"&&o.created_by===uid());
  if(table==="exercises")return x.created_by===uid()&&x.status==="draft";
  if(table==="submissions")return S.role==="participant"&&teamIds().has(x.team_id)&&x.status==="draft"&&x.updated_by===uid();
  if(table==="injects")return staff()&&x.status==="draft";
  if(table==="document_records")return staff()&&(x.kind!=="file"||x.owner_id===uid());
  if(table==="invitations")return staff()&&x.status==="pending";
  return ["teams","stages","agenda_days","agenda_sessions","slides","action_items"].includes(table)&&staff();
}
function recordActions(table,x){
  const edit=canEditRecord(table,x),del=canDeleteRecord(table,x);
  return (edit?'<button class="btn small" data-cmd="edit-record" data-table="'+esc(table)+'" data-id="'+esc(x.id)+'" type="button">Edit</button>':"")+
  (del?'<button class="btn small danger-outline" data-cmd="delete-record" data-table="'+esc(table)+'" data-id="'+esc(x.id)+'" type="button">'+(table==="invitations"?"Revoke":"Delete")+'</button>':"");
}
function editFields(table,row){
  let fs=EDIT_FIELDS[table]||[];
  if(table==="document_records"&&row.kind!=="link")fs=fs.filter(f=>f[0]!=="url");
  return fs.map(([key,label,type,required,options])=>{
    const value=key==="notes"?(noteFor(table==="agenda_sessions"?"session":"slide",row.id)?.body||""):(row[key]??"");
    const id="editing-"+key, req=required?" required":"";
    let items=options;
    if(type==="recipients")items=[["keep","Keep existing recipient teams"],["all","All participant teams"],...d("teams").filter(t=>t.kind==="team").map(t=>[t.id,t.name])];
    if(type==="stage")items=d("stages").map(x=>[x.id,x.name]);
    if(type==="day")items=d("agenda_days").map(x=>[x.id,"Day "+x.day_number+" · "+x.title]);
    if(type==="team")items=[["","No team"],...d("teams").map(x=>[x.id,x.name])];
    let html="";
    if(type==="textarea")html='<textarea rows="4" id="'+id+'" name="'+esc(key)+'"'+req+'>'+esc(value)+'</textarea>';
    else if(items)html='<select name="'+esc(key)+'" id="'+id+'"'+req+'>'+items.map(([v,l])=>'<option value="'+esc(v)+'"'+(String(v)===String(value)?' selected':'')+'>'+esc(l)+'</option>').join("")+'</select>';
    else html='<input id="'+id+'" name="'+esc(key)+'" type="'+esc(type)+'" value="'+esc(value)+'"'+(type==="number"?' min="1" max="30"':'')+req+'>';
    return '<label for="'+id+'">'+esc(label)+'</label>'+html;
  }).join("");
}
function editingOverlay(){
  if(!S.editor)return "";
  const {table,record}=S.editor,label=DISPLAY_NAMES[table]||table;
  return '<div class="help-overlay edit-overlay"><section class="help-dialog edit-dialog" role="dialog" aria-modal="true" aria-labelledby="editing-title">'+
   '<div class="row between"><div><span class="kicker">EDIT EXISTING RECORD</span><h2 id="editing-title">Edit '+esc(label)+'</h2><p class="tiny">Changes are saved to your exercise workspace. Only authorized roles may edit.</p></div><button class="btn small" type="button" data-cmd="edit-cancel">Close</button></div>'+
   '<form class="form edit-fields" data-form="edit-record">'+editFields(table,record)+'<div class="row"><button class="btn primary" type="submit">Save changes</button><button class="btn" type="button" data-cmd="edit-cancel">Cancel</button></div></form></section></div>';
}
function deleteDependencies(table,row){
  if(table==="teams"){
    const counts=[
      d("inject_targets").some(x=>x.team_id===row.id),
      d("submissions").some(x=>x.team_id===row.id),
      d("messages").some(x=>x.team_id===row.id||x.to_team_id===row.id),
      d("document_records").some(x=>x.team_id===row.id),
      d("invitations").some(x=>x.team_id===row.id&&x.status==="pending")
    ];
    if(counts.some(Boolean))return "This team has inject assignments, responses, messages, references or pending invitations. Remove those linked records before deleting it.";
  }
  if(table==="stages"&&(d("injects").some(x=>x.stage_id===row.id)||d("agenda_sessions").some(x=>x.stage_id===row.id)||S.ex?.current_stage_id===row.id))return "This stage is in use. Reassign its injects and sessions before deleting.";
  if(table==="agenda_days"&&d("agenda_sessions").some(x=>x.day_id===row.id))return "This day still contains sessions. Delete or move those sessions first.";
  if(table==="agenda_sessions"&&(d("slides").some(x=>x.session_id===row.id)||d("document_records").some(x=>x.session_id===row.id)))return "This session still contains slides or references. Move or delete those first.";
  return "";
}
function deletionOverlay(){
  if(!S.deletePrompt)return "";
  const {table,record}=S.deletePrompt;
  const title=record.title||record.name||record.action||record.email||"this item";
  const blocked=S.deletePrompt.blocker||deleteDependencies(table,record),big=["organizations","exercises"].includes(table);
  const isFile=table==="document_records"&&record.kind==="file";
  const msg=table==="organizations"?"Only organizations without exercises, documents or invitations can be deleted. All remaining organization memberships will also be removed, without deleting user accounts.":
  table==="exercises"?"A draft exercise may be permanently deleted by its creator even if others have joined. This removes all exercise teams, team assignments, training days, slides, draft injects, invitations and messages. User accounts are not deleted. Exercises with recorded decisions, released injects or uploaded files remain protected.":
  table==="invitations"?"Revoke this invitation? The link will stop working, but any access already accepted is not removed.":
  table==="submissions"?"Delete this unsent draft? Submitted decisions are retained for exercise accountability.":
  isFile?"The stored file will be deleted from private storage before the reference entry is removed. This cannot be undone.":
  table==="teams"?"Deleting this team also removes its member assignments. It cannot be deleted while injects, decisions, messages or references still depend on it.":
  "This record will be permanently deleted. Related data may be affected; review the warning below.";
  return '<div class="help-overlay edit-overlay"><section class="help-dialog edit-dialog" role="dialog" aria-modal="true" aria-labelledby="deleting-title"><span class="kicker">PLEASE CONFIRM</span><h2 id="deleting-title">'+(table==="invitations"?"Revoke invitation":"Delete "+esc(DISPLAY_NAMES[table]||table))+'</h2><p><b>'+esc(title)+'</b></p><p>'+esc(msg)+'</p>'+
   (blocked?'<p class="notice error" role="alert">'+esc(blocked)+'</p>':"")+
   (S.deletePrompt.error?'<p class="notice error" role="alert">'+esc(S.deletePrompt.error)+'</p>':"")+
   '<form class="form" data-form="delete-record">'+(big?'<label for="delete-confirm">Type the exact name to confirm</label><input id="delete-confirm" name="confirmation" required autocomplete="off" placeholder="'+esc(title)+'">':"")+
   '<div class="row"><button class="btn '+(blocked?'':'danger')+'" type="submit"'+(blocked?' disabled':'')+'>'+(table==="invitations"?"Revoke invitation":"Delete permanently")+'</button><button type="button" class="btn" data-cmd="delete-cancel">Cancel</button></div></form></section></div>';
}


// Common language first. Technical training terms remain in the guide for specialists.
const ROLE_TITLES={director:"Exercise lead",facilitator:"Facilitator",participant:"Participant",observer:"Evaluator",support_actor:"Role-player"};
const ROLE_BLURB={director:"Prepare the course and run the exercise",facilitator:"Guide learning and manage the exercise",participant:"Learn, work with your team and decide",observer:"Watch performance and record learning",support_actor:"Play your assigned role and respond to teams"};
const stateLabel=s=>({draft:"Preparing",published:"Ready to start",live:"In progress",paused:"Paused",completed:"Finished",archived:"Archived"})[s]||s;
const kindLabel=s=>({presentation:"Presentation",exercise:"Group activity",debrief:"Discussion & reflection",break:"Break",other:"Other"})[s]||s;
const plainRole=()=>ROLE_TITLES[S.role]||"Team member";
const overseer=()=>staff()||S.role==="observer";
const sortedSessions=()=>d("agenda_sessions").slice().sort((a,b)=>(d("agenda_days").find(x=>x.id===a.day_id)?.day_number||0)-(d("agenda_days").find(x=>x.id===b.day_id)?.day_number||0)||String(a.start_time||"").localeCompare(String(b.start_time||""))||(a.position||0)-(b.position||0));
const scheduledDays=()=>d("agenda_days").slice().sort((a,b)=>(a.day_number||0)-(b.day_number||0));
const tabAction=(tab,label,extra="")=>'<button type="button" class="btn small '+extra+'" data-cmd="tab" data-tab="'+esc(tab)+'">'+esc(label)+'</button>';
const linkedStage=ses=>d("stages").find(x=>x.id===ses.stage_id);
const noteFor=(subject,id)=>d("private_notes").find(x=>x.subject_type===subject&&x.subject_id===id);
const statusPill=s=>'<span class="badge '+esc(s)+'">'+esc(stateLabel(s))+'</span>';
const selectedMenu=(name,label,items,chosen,field="name",id="id")=>'<label for="'+esc(name)+'">'+esc(label)+'</label><select name="'+esc(name)+'" id="'+esc(name)+'" required>'+items.map(x=>'<option value="'+esc(x[id])+'"'+(String(x[id])===String(chosen)?' selected':'')+'>'+esc(x[field])+'</option>').join("")+'</select>';
const termLegend=()=>'<details class="term-guide"><summary>What do the exercise terms mean?</summary><dl><dt>Exercise</dt><dd>A practice emergency, not a real-world operation.</dd><dt>Scenario</dt><dd>The fictional situation in which the exercise takes place.</dd><dt>Event / inject</dt><dd>New information released to test a team’s response.</dd><dt>Stage</dt><dd>A phase of the simulated emergency, such as H0 or 24 hours later.</dd><dt>Decision</dt><dd>The team’s proposed action and its justification.</dd><dt>Debrief / AAR</dt><dd>A discussion of what worked, what did not, and what should improve.</dd><dt>MSEL</dt><dd>Master Scenario Events List: the planned sequence of exercise events.</dd></dl></details>';

function exerciseScreen(){
  const ex=S.ex;
  const tabs=staff()?[
    ["control","Overview"],["agenda","Teaching plan"],["scenario","Practice events"],["teams","People & teams"],
    ["responses","Team decisions"],["review","Debrief & learning"],["messages","Messages"],["library","Resources"]
  ]:S.role==="observer"?[
    ["control","My overview"],["agenda","Programme"],["scenario","Exercise updates"],["review","Evaluation"],
    ["responses","Team decisions"],["messages","Messages"],["library","Resources"]
  ]:S.role==="support_actor"?[
    ["control","My overview"],["agenda","Programme"],["scenario","Exercise updates"],["messages","Messages"],["library","Resources"]
  ]:[
    ["control","My overview"],["agenda","Programme"],["scenario","Exercise updates"],
    ["responses","My team's decisions"],["messages","Messages"],["library","Resources"],["review","Reflection"]
  ];
  if(!tabs.some(x=>x[0]===S.tab))S.tab="control";
  const body=({control:tabControl,scenario:tabScenario,teams:tabTeams,agenda:tabAgenda,library:tabLibrary,responses:tabResponses,messages:tabMessages,review:tabReview}[S.tab]||tabControl)();
  const primary=tabs.slice(0,staff()?6:4),secondary=tabs.slice(staff()?6:4);
  chrome('<div class="hero"><div><button class="link tiny" data-cmd="home">← All exercises</button><span class="kicker">Training & simulation · '+esc(plainRole())+'</span><h1>'+esc(ex.title)+'</h1><p>'+esc(ex.description||"A practice emergency where teams learn by doing.")+'</p></div><div class="row">'+statusPill(ex.status)+'<button class="btn small" data-cmd="refresh">Refresh updates</button>'+recordActions("exercises",ex)+'</div></div>'+
    '<nav class="workspace-nav" aria-label="Exercise areas"><div class="nav-main">'+primary.map(x=>navButton(x[0],x[1])).join("")+'</div>'+(secondary.length?'<div class="nav-secondary"><span>Also available</span>'+secondary.map(x=>navButton(x[0],x[1])).join("")+'</div>':"")+'</nav>'+
    guidePanel()+featureHint()+body);
}
function tabControl(){
  const events=d("injects"),released=events.filter(x=>x.status==="released"),submitted=d("submissions").filter(x=>x.status==="submitted"),myTeams=teamsMine().filter(t=>t.kind==="team");
  if(staff()){
    const readiness=[
      {done:!!(S.ex.objectives||"").trim(),name:"Set learning goals",detail:"What should people be able to do after this exercise?",tab:"control",edit:true},
      {done:d("agenda_sessions").length>0,name:"Build the teaching plan",detail:"Add presentations, practice and a short debrief.",tab:"agenda"},
      {done:d("teams").some(x=>x.kind==="team"),name:"Create at least one team",detail:"Invite participants and assign them to their group.",tab:"teams"},
      {done:d("stages").length>0&&events.length>0,name:"Prepare events and decisions",detail:"Write realistic updates and the decisions they require.",tab:"scenario"}
    ];
    const completed=readiness.filter(x=>x.done).length,queued=events.filter(x=>x.status==="draft");
    return '<section class="intro-strip"><div><span class="kicker">FACILITATOR WORKSPACE</span><h2>Run a clear, connected learning experience</h2><p>Use your teaching plan to introduce each topic, let teams practise in the scenario, then discuss what happened.</p></div><div class="row">'+tabAction("agenda","Open teaching plan","primary")+tabAction("scenario","Manage practice events")+'</div></section>'+
    '<div class="metrics" aria-label="Exercise summary"><div><b>'+esc(completed)+'/4</b><span>Preparation steps</span></div><div><b>'+d("teams").filter(x=>x.kind==="team").length+'</b><span>Participant teams</span></div><div><b>'+queued.length+'</b><span>Events to release</span></div><div><b>'+submitted.length+'</b><span>Decisions received</span></div></div>'+
    '<div class="cols"><section class="card stack"><div class="section-head"><div><h2>Before you start</h2><p>Follow these four steps. You can return to them at any time.</p></div><span class="badge">'+completed+' of 4 ready</span></div>'+
    '<div class="readiness">'+readiness.map((x,i)=>'<div class="ready-item"><span class="ready-icon '+(x.done?"complete":"")+'">'+(x.done?"✓":String(i+1))+'</span><div class="grow"><b>'+esc(x.name)+'</b><p>'+esc(x.detail)+'</p></div>'+(x.edit?'<button class="btn small" data-cmd="edit-record" data-table="exercises" data-id="'+esc(exid())+'">'+(x.done?"Edit":"Set goals")+'</button>':tabAction(x.tab,x.done?"Review":"Start"))+'</div>').join("")+'</div>'+
    '<div class="section-head"><h2>Exercise controls</h2>'+statusPill(S.ex.status)+'</div><p>The exercise must be live before you release new events to participants.</p><div class="row">'+actionsFor(S.ex.status).map(x=>'<button type="button" class="btn '+(x==="live"?"primary":"")+' small" data-cmd="status" data-status="'+esc(x)+'">'+esc(({live:"Start / resume",paused:"Pause",published:"Mark ready",completed:"Finish",archived:"Archive",draft:"Return to preparation"})[x]||x)+'</button>').join("")+'</div>'+
    '</section><aside class="stack"><section class="card stack"><h2>Next to deliver</h2>'+(sortedSessions().length?(()=>{const z=sortedSessions()[0];return '<p class="tiny muted">'+esc(kindLabel(z.session_type))+' · '+esc(z.start_time||"No start time")+'</p><h3>'+esc(z.title)+'</h3><p>'+esc(z.learning_objectives||"Add a learning goal to clarify what this activity should achieve.")+'</p><div class="row">'+tabAction("agenda","View programme")+'<button class="btn small primary" data-cmd="present" data-id="'+esc(z.id)+'">Present slides</button></div>';})():empty("Add a training day and session to your teaching plan."))+'</section><section class="card stack"><h2>Event queue</h2>'+(queued.length?queued.slice(0,3).map(i=>row(esc(i.title),esc(i.response_prompt||"No required decision stated"),'<button class="btn small" data-cmd="focus-event" data-id="'+esc(i.id)+'">View</button>')).join(""):empty("No draft events waiting."))+tabAction("scenario","Open event manager")+'</section></aside></div>';
  }
  if(S.role==="observer"){
    return '<section class="intro-strip"><div><span class="kicker">EVALUATOR WORKSPACE</span><h2>Observe decisions, capture evidence, support learning</h2><p>Record what teams actually do, not what you assume they know. Use these observations in the debrief.</p></div>'+tabAction("review","Open evaluation","primary")+'</section>'+
      '<div class="metrics"><div><b>'+released.length+'</b><span>Released updates visible</span></div><div><b>'+d("submissions").length+'</b><span>Team decisions</span></div><div><b>'+d("observations").length+'</b><span>Observations logged</span></div></div>'+
      '<section class="card stack"><h2>What to watch for</h2><p>Timeliness of decisions, practical feasibility, coordination, assumptions and adaptation to new information.</p><div class="row">'+tabAction("responses","Review decisions")+tabAction("review","Record an observation","primary")+tabAction("agenda","View learning objectives")+'</div></section>';
  }
  if(S.role==="support_actor"){
    return '<section class="intro-strip"><div><span class="kicker">SIMULATED STAKEHOLDER</span><h2>Your role in the scenario</h2><p>Respond as your assigned fictional stakeholder. Keep role-play messages inside the exercise.</p></div>'+tabAction("messages","Open messages","primary")+'</section><section class="card"><h2>Available information</h2><p>'+released.length+' released updates are visible to your role.</p><div class="row">'+tabAction("scenario","Exercise updates")+tabAction("agenda","Training programme")+'</div></section>';
  }
  const pending=targetInjects().filter(i=>!d("submissions").some(sub=>sub.inject_id===i.id&&myTeams.some(t=>t.id===sub.team_id)&&["submitted","accepted"].includes(sub.status)));
  const myDecisions=d("submissions").filter(x=>myTeams.some(t=>t.id===x.team_id));
  return '<section class="intro-strip"><div><span class="kicker">PARTICIPANT WORKSPACE</span><h2>What should I do next?</h2><p>Read the situation, agree on a decision with your team, then submit it. Reflect on what worked with your facilitator.</p></div>'+tabAction("responses","Open team decisions","primary")+'</section>'+
    '<div class="metrics"><div><b>'+pending.length+'</b><span>Updates needing action</span></div><div><b>'+myDecisions.filter(x=>x.status==="submitted"||x.status==="accepted").length+'</b><span>Decisions submitted</span></div><div><b>'+myTeams.length+'</b><span>My teams</span></div></div>'+
    '<div class="cols"><section class="card stack"><h2>My next tasks</h2><p class="tiny muted">Your team: '+esc(myTeams.map(x=>x.name).join(", ")||"Not assigned yet")+'</p>'+
    (pending.length?pending.map(i=>'<div class="task-card"><div><span class="kicker">NEW SITUATION UPDATE</span><h3>'+esc(i.title)+'</h3><p>'+esc(i.body).slice(0,280)+'</p><p><b>What is needed:</b> '+esc(i.response_prompt||"Agree on your team's response.")+'</p></div><button class="btn primary small" data-cmd="start-decision" data-id="'+esc(i.id)+'">Respond as a team</button></div>').join(""):empty(myTeams.length?"No outstanding updates for your team. Check the programme or wait for the next activity.":"A facilitator must assign you to a team before you can submit decisions."))+
    '</section><aside class="stack"><section class="card stack"><h2>Our learning programme</h2>'+(sortedSessions().length?sortedSessions().slice(0,3).map(x=>'<div class="learning-list"><b>'+esc(x.title)+'</b><span>'+esc(kindLabel(x.session_type))+' · '+esc(x.start_time||"Time to be confirmed")+'</span></div>').join(""):empty("The facilitator has not added the programme yet."))+tabAction("agenda","View programme")+'</section><section class="card stack"><h2>Need information?</h2><div class="row">'+tabAction("messages","Messages")+tabAction("library","Resources")+'</div></section></aside></div>';
}
function tabScenario(){
  const stages=d("stages").slice().sort((a,b)=>(a.position||0)-(b.position||0)),teams=d("teams");
  const updates=d("injects").slice().sort((a,b)=>(a.position||0)-(b.position||0)),activeStage=stages.find(x=>x.id===S.focusStage);
  const visible=activeStage?updates.filter(x=>x.stage_id===activeStage.id):updates;
  const event=i=>{
    const myTargets=teamsMine().filter(t=>currentTargets(i).includes(t.id)).map(t=>t.id);
    const isAction=S.role==="participant"&&i.status==="released"&&myTargets.length>0;
    return '<article class="event-card"><div class="row between"><div><span class="eyebrow">'+esc(stages.find(x=>x.id===i.stage_id)?.name||"Exercise update")+'</span><h3>'+esc(i.title)+'</h3></div>'+statusPill(i.status)+'</div>'+
       '<p>'+lines(i.body)+'</p>'+(i.response_prompt?'<div class="event-question"><b>Your challenge:</b> '+esc(i.response_prompt)+'</div>':"")+
       (staff()?'<p class="tiny muted">Recipients: '+esc(d("inject_targets").filter(x=>x.inject_id===i.id).map(x=>teams.find(t=>t.id===x.team_id)?.name).filter(Boolean).join(", ")||"No assigned teams")+'</p>':"")+
       '<div class="row">'+(staff()?recordActions("injects",i)+(i.status==="draft"?'<button class="btn small primary" data-cmd="release" data-id="'+esc(i.id)+'">Release to teams</button>':""):"")+
       (isAction?'<button class="btn small primary" data-cmd="start-decision" data-id="'+esc(i.id)+'">Record team decision</button>':"")+
       (S.role==="observer"?tabAction("review","Record an observation"):"")+
       '</div></article>';
  };
  return '<section class="intro-strip"><div><span class="kicker">SIMULATION · EXERCISE EVENTS</span><h2>'+(staff()?"Create pressure. Observe decisions. Adapt.":"The emergency is unfolding")+'</h2><p>'+(staff()?"Prepare realistic situation updates, release them to teams when appropriate, and use their responses during the debrief.":"Updates appear when released and authorized for your role. Read the situation, then decide what your team should do.")+'</p></div>'+tabAction("agenda","Teaching programme")+'</section>'+
  (activeStage?'<div class="active-filter"><span>Showing related practice for <b>'+esc(activeStage.name)+'</b></span><button class="btn small" data-cmd="show-all-events">Show all events</button></div>':"")+
  '<div class="cols"><section class="stack"><section class="card"><div class="section-head"><div><h2>Scenario timeline</h2><p>Stages are phases of the fictional emergency, not separate training days.</p></div></div>'+
   (stages.length?stages.map(x=>'<div class="stage-row '+(activeStage?.id===x.id?"highlighted":"")+'"><div><b>'+esc(x.name)+'</b><p>'+esc(x.description||"No stage description yet")+'</p><span class="tiny muted">'+esc(x.code||"")+'</span></div>'+(staff()?recordActions("stages",x):"")+'<button class="btn small" data-cmd="focus-stage" data-id="'+esc(x.id)+'">View events</button></div>').join(""):empty("The facilitator has not added scenario stages yet."))+
   '</section><section class="card stack"><h2>Situation updates & tasks</h2><p class="tiny muted">A situation update (sometimes called an inject) introduces new information or a decision for teams.</p>'+
    (visible.length?visible.map(event).join(""):empty("No situation updates are available for this stage."))+
    '</section></section>'+
    (staff()?'<aside class="stack"><section class="card"><h3>1. Add a scenario stage</h3><p class="tiny muted">Example: H0 Activation. This is when the fictional situation changes.</p><form data-form="stage" class="form">'+input("name","Stage name (e.g. H0 ACTIVATE)","","text",true)+input("code","Time label (e.g. H0)")+area("description","Situation at this stage")+'<button class="btn primary">Add stage</button></form></section>'+
      '<section class="card"><h3>2. Prepare a situation update</h3><p class="tiny muted">Give participants enough information to make a decision, but not necessarily a perfect picture.</p><form data-form="inject" class="form">'+select("stage","When should this happen?",stages,"name")+input("title","Situation update title","","text",true)+area("body","What has happened? What information is available?")+area("prompt","What decision should the team make?")+'<label for="target">Who receives this?</label><select name="target" id="target"><option value="all">All participant teams</option>'+teams.filter(t=>t.kind==="team").map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>').join("")+'</select><button class="btn primary">Save as draft</button></form></section>'+termLegend()+'</aside>':"")+'</div>';
}
function tabTeams(){return '<div class="cols"><div class="card"><h2>Teams and simulation cells</h2>'+(d("teams").length?d("teams").map(t=>row(esc(t.name),esc(t.description||"")+'<p class="tiny muted">Kind: '+esc(t.kind)+' · Members: '+d("team_memberships").filter(m=>m.team_id===t.id).length+'</p>',pill(t.kind)+recordActions("teams",t))).join(""):empty("Add country teams, interagency groups, or support cells."))+'</div>'+(staff()?'<aside class="stack"><div class="card"><h3>Invitations</h3><p class="tiny muted">Pending invitations can be revoked. Accepted invitations cannot be revoked here; manage membership separately.</p>'+(d("invitations").length?d("invitations").map(i=>row(esc(i.email),esc(i.exercise_role||"Member")+" · "+esc(i.status),pill(i.status)+recordActions("invitations",i))).join(""):empty("No invitations yet."))+'</div><div class="card"><h3>Create group</h3><form data-form="team" class="form">'+input("name","Team or cell name","","text",true)+'<label for="kind">Group type</label><select name="kind" id="kind"><option value="team">Participant team</option><option value="support_cell">Simulation support cell</option></select>'+area("description","Purpose or assignment")+'<button class="btn primary">Create group</button></form></div><div class="card"><h3>Invite a user</h3><p class="tiny muted">Use the invitee’s exact email. The link grants access only after verified sign-in. Send it privately.</p><form data-form="invite" class="form">'+input("email","Invitee email","","email",true)+'<label>Exercise role</label><select name="role"><option value="participant">Participant</option><option value="observer">Observer</option><option value="support_actor">Support actor</option><option value="facilitator">Facilitator</option></select>'+select("team","Assign group (optional)",d("teams"))+'<button class="btn primary">Create invitation</button></form>'+(S.inviteUrl?'<div class="notice"><b>Private invite link:</b><p class="note tiny">'+esc(S.inviteUrl)+'</p><button class="btn small" data-cmd="copy">Copy link</button></div>':'')+'</div></aside>':'')+'</div>';}
function tabAgenda(){
  const days=scheduledDays(),sess=sortedSessions(),slides=d("slides"),stages=d("stages");
  const sessionCard=se=>{
    const stage=linkedStage(se),related=stage?d("injects").filter(i=>i.stage_id===stage.id):[];
    const cues=staff()?noteFor("session",se.id)?.body||"":"";
    return '<article class="teaching-card"><div class="row between"><div><span class="eyebrow">'+esc(kindLabel(se.session_type))+(se.start_time?" · "+esc(se.start_time):"")+'</span><h3>'+esc(se.title)+'</h3></div>'+(staff()?recordActions("agenda_sessions",se):"")+'</div>'+
    (se.learning_objectives?'<p><b>Learning goal:</b> '+esc(se.learning_objectives)+'</p>':staff()?'<p class="muted">Add a learning goal so participants understand the purpose of this activity.</p>':"")+
    (se.instructions?'<p class="muted">'+lines(se.instructions)+'</p>':"")+
    (stage?'<div class="linked-stage"><span>Connected practice: '+esc(stage.name)+'</span><span>'+related.length+' scenario update'+(related.length===1?"":"s")+'</span></div>':"")+
    (staff()&&cues?'<details class="facilitator-cues"><summary>Private teaching prompts</summary><p>'+lines(cues)+'</p></details>':"")+
    '<div class="row teaching-actions">'+(slides.some(x=>x.session_id===se.id)?'<button type="button" class="btn small primary" data-cmd="present" data-id="'+esc(se.id)+'">Present slides</button>':staff()&&se.session_type==="presentation"?'<button type="button" class="btn small" data-cmd="present" data-id="'+esc(se.id)+'">Open presentation</button>':"")+
    (stage?'<button type="button" class="btn small" data-cmd="session-challenge" data-id="'+esc(stage.id)+'">'+(staff()?"Open related scenario":"See related practice")+'</button>':"")+
    (staff()&&!stage&&se.session_type==="exercise"?'<span class="tiny muted">Optional: connect a scenario stage when editing this activity</span>':"")+'</div>'+
    (staff()&&slides.some(x=>x.session_id===se.id)?'<details class="slides-details"><summary>View '+slides.filter(x=>x.session_id===se.id).length+' slide(s)</summary><div class="slide-rows">'+slides.filter(x=>x.session_id===se.id).sort((a,b)=>a.position-b.position).map(sl=>row(esc(sl.title),esc(sl.body||"").slice(0,140),recordActions("slides",sl))).join("")+'</div></details>':"")+
    '</article>';
  };
  return '<section class="intro-strip"><div><span class="kicker">TRAINING STUDIO</span><h2>Teach → practise → reflect</h2><p>This programme brings presentations and activities together. Use each topic to prepare learners, let them practise, and discuss what they observed.</p></div>'+(staff()?tabAction("scenario","Manage practice events"):tabAction("control","My next task","primary"))+'</section>'+
  '<div class="cols"><section class="card stack"><div class="section-head"><div><h2>Course programme</h2><p>Each day can combine presentations, group practice, discussions and breaks.</p></div><span class="badge">'+sess.length+' activities</span></div>'+
    (days.length?days.map(day=>'<div class="programme-day"><div class="row between"><div><span class="eyebrow">DAY '+esc(day.day_number)+'</span><h3>'+esc(day.title||"Training day")+'</h3></div>'+(staff()?recordActions("agenda_days",day):"")+'</div><div class="session-list">'+(sess.filter(x=>x.day_id===day.id).length?sess.filter(x=>x.day_id===day.id).map(sessionCard).join(""):empty("No activities scheduled for this day yet."))+'</div></div>').join(""):empty("The facilitator has not created the programme yet."))+
  '</section>'+(staff()?'<aside class="stack"><div class="card"><h3>1. Add a training day</h3><form class="form" data-form="day">'+input("number","Day number","1","number",true)+input("title","What is this day about?","Introduction and preparedness")+'<button class="btn primary">Add day</button></form></div>'+
    '<div class="card"><h3>2. Add a learning activity</h3><p class="tiny muted">Use one entry for each presentation, practical activity, discussion or break.</p><form class="form" data-form="session">'+select("day","Choose the day",days,"title")+input("title","Activity title","","text",true)+
    '<label for="type">Activity type</label><select name="type" id="type"><option value="presentation">Presentation — introduce or explain</option><option value="exercise">Group activity — practise a decision</option><option value="debrief">Debrief — reflect together</option><option value="break">Break</option><option value="other">Other</option></select>'+input("start","Time (optional)","","time")+
    area("objectives","What should participants learn?")+
    '<label for="stage">Related scenario stage (optional)</label><select name="stage" id="stage"><option value="">Not linked yet</option>'+stages.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join("")+'</select>'+
    area("notes","Facilitator teaching cues (private): questions, examples and debrief points")+
    '<button class="btn primary">Add activity</button></form></div>'+
    '<div class="card"><h3>3. Add presentation slides</h3><p class="tiny muted">Slides display to the class. Speaker notes remain private to facilitators.</p><form data-form="slide" class="form">'+select("session","Choose presentation or activity",sess)+input("title","Slide title","","text",true)+area("body","Slide content (one point per line)")+area("notes","Private speaker notes")+'<button class="btn primary">Add slide</button></form></div></aside>':'')+'</div>';
}
function tabLibrary(){const docs=d("document_records");return '<div class="cols"><section class="card"><h2>Authorized reference library</h2><p class="tiny muted">The system displays only records your server-side permissions permit.</p>'+(docs.length?docs.map(doc=>row(esc(doc.title),esc(doc.category)+' · '+esc(doc.visibility)+' · version '+esc(doc.version),'<button class="btn small" data-cmd="document" data-id="'+esc(doc.id)+'">'+(doc.kind==="file"?"Download":"Open link")+'</button>'+recordActions("document_records",doc))).join(""):empty("No references available."))+'</section>'+(staff()?'<aside class="stack"><div class="card"><h3>Add policy or external resource</h3><form class="form" data-form="link">'+input("title","Reference title","","text",true)+input("url","HTTPS reference URL","","url",true)+'<label>Visibility</label><select name="visibility"><option value="facilitators">Facilitators only</option><option value="exercise">Everyone in exercise</option><option value="team">Specific team</option></select>'+select("team","Team (if needed)",d("teams"))+'<button class="btn primary">Add link</button></form></div><div class="card"><h3>Upload a training document</h3><p class="tiny muted">Only synthetic training materials until malware scanning and approval are complete. PDF, PPTX, DOCX; maximum 20 MB. PowerPoint is stored for download, not played with animations.</p><form class="form" data-form="upload">'+input("title","Document title","","text",true)+'<label for="file">Choose a file</label><input type="file" name="file" id="file" accept=".pdf,.pptx,.docx" required><label>Visibility</label><select name="visibility"><option value="facilitators">Facilitators only</option><option value="exercise">Everyone in exercise</option><option value="team">Specific team</option></select>'+select("team","Team (if needed)",d("teams"))+'<button class="btn primary">Upload private document</button></form></div></aside>':'')+'</div>';}
function tabResponses(){let submissions=d("submissions"),teamList=S.role==="participant"?teamsMine().filter(t=>t.kind==="team"):[];return '<div class="cols"><section class="card"><h2>'+ (staff()?"Review responses":"Your team's decisions")+'</h2>'+(submissions.length?submissions.map(s=>row(esc(d("teams").find(t=>t.id===s.team_id)?.name||"Team")+" · "+esc(d("injects").find(i=>i.id===s.inject_id)?.title||"Inject"),lines(s.body),pill(s.status)+recordActions("submissions",s)+(staff()&&s.status==="submitted"?'<button class="btn small" data-cmd="review" data-id="'+esc(s.id)+'" data-status="accepted">Accept</button><button class="btn small" data-cmd="review" data-id="'+esc(s.id)+'" data-status="returned">Return</button>':""))).join(""):empty("No team responses yet."))+'</section>'+(staff()?'<aside class="card"><h3>Facilitator review</h3><p>Review submitted team decisions against the exercise learning objectives. Decisions and state changes are retained in the backend.</p><button class="btn small" data-cmd="export">Export results (CSV)</button></aside>':'<aside class="card"><h3>Submit a decision</h3>'+(teamList.length?'<form class="form" data-form="response">'+select("team","Your team",teamList)+selectedMenu("inject","Situation update",targetInjects(),S.selectedInject,"title")+'<p class="tiny muted">Before submitting: What will you do? Why? Who is responsible? By when? What information is still missing?</p>'+area("body","Team decision and why you chose it")+'<div class="row"><button class="btn" name="response_status" value="draft">Save draft</button><button class="btn primary" name="response_status" value="submitted">Submit</button></div></form>':empty("Ask the facilitator to assign you to a participant team."))+'</aside>')+'</div>';}
function tabMessages(){let msgs=d("messages");return '<div class="cols"><section class="card"><h2>Simulation messages</h2><p class="tiny muted">Sent messages are retained as exercise evidence and cannot be edited or deleted. Send a follow-up correction when needed.</p>'+(msgs.length?msgs.map(m=>row(esc(m.persona||"Exercise participant"),lines(m.body)+'<p class="tiny muted">'+when(m.created_at)+'</p>')).join(""):empty("No messages."))+'</section><aside class="card"><h3>Send a message</h3><form data-form="message" class="form">'+(staff()?'<label>Recipient</label><select name="recipient"><option value="">Facilitator-only message</option>'+d("teams").map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>').join("")+'</select>':select("team","Sending team",teamsMine()))+area("body","Message (fictional exercise information only)")+'<button class="btn primary">Send</button></form></aside></div>';}
function tabReview(){
  const subs=d("submissions"),observations=d("observations").slice().sort((a,b)=>String(b.observed_at||"").localeCompare(String(a.observed_at||""))),actions=d("action_items");
  const submitted=subs.filter(x=>x.status==="submitted").length,accepted=subs.filter(x=>x.status==="accepted").length;
  if(!overseer())return '<section class="intro-strip"><div><span class="kicker">REFLECTION</span><h2>Turn experience into learning</h2><p>After each activity, discuss what happened, why your team chose its approach, and what you would do differently.</p></div>'+tabAction("agenda","Review what we practised","primary")+'</section>'+
    '<section class="card stack"><h2>Three useful questions</h2><div class="reflect-grid"><div><b>What happened?</b><p>Which information and decisions mattered?</p></div><div><b>Why?</b><p>What assumptions or constraints influenced the team?</p></div><div><b>Next time?</b><p>Which actions would improve the response?</p></div></div><p class="tiny muted">Facilitator and evaluator notes remain private. Your team can discuss its own decisions and feedback.</p>'+tabAction("responses","My team's decisions")+'</section>';
  return '<section class="intro-strip"><div><span class="kicker">EVALUATION & AFTER-ACTION REVIEW</span><h2>Observe what people did, then strengthen future action</h2><p>Use specific observations and team decisions to guide a constructive debrief, not simply mark answers right or wrong.</p></div>'+tabAction("responses","Review team decisions")+'</section>'+
    '<div class="metrics"><div><b>'+submitted+'</b><span>Awaiting review</span></div><div><b>'+accepted+'</b><span>Decisions accepted</span></div><div><b>'+observations.length+'</b><span>Observations recorded</span></div><div><b>'+actions.length+'</b><span>Improvement actions</span></div></div>'+
    '<div class="cols"><section class="stack"><div class="card stack"><h2>Guided debrief</h2><div class="reflect-grid"><div><b>1. What happened?</b><p>Which facts and actions can we verify?</p></div><div><b>2. Why did it happen?</b><p>Which assumptions, constraints or teamwork factors mattered?</p></div><div><b>3. What should change?</b><p>Agree on a practical improvement and owner.</p></div></div></div>'+
    '<div class="card stack"><div class="section-head"><h2>Evidence from observers</h2><span class="badge">'+observations.length+' notes</span></div>'+
    (observations.length?observations.map(o=>'<article class="observation-entry"><div class="row between"><b>'+esc(o.competency||"General observation")+'</b><span class="tiny muted">'+esc(o.rating?o.rating+"/5 – indicative rating":"Observation only")+'</span></div><p>'+lines(o.note)+'</p><p class="tiny muted">'+esc(d("teams").find(t=>t.id===o.team_id)?.name||"All teams")+' · '+esc(d("injects").find(i=>i.id===o.inject_id)?.title||"General")+' · '+when(o.observed_at)+'</p></article>').join(""):empty("No observations yet. Record what you saw during an activity."))+
    '</div><div class="card stack"><h2>Agreed improvement actions</h2>'+(actions.length?actions.map(x=>row(esc(x.action),esc(x.owner_name||"Owner not set"),pill(x.horizon+" days")+(staff()?recordActions("action_items",x):""))).join(""):empty("Use the debrief to agree on improvements with owners."))+'</div></section>'+
    '<aside class="stack"><div class="card"><h3>Record an observation</h3><p class="tiny muted">Describe what actually happened. Ratings help comparison but are not a substitute for evidence.</p>'+
    '<form data-form="observation" class="form">'+
    '<label for="obs-team">Team (optional)</label><select id="obs-team" name="team"><option value="">All teams / general</option>'+d("teams").map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>').join("")+'</select>'+
    '<label for="obs-inject">Situation update (optional)</label><select id="obs-inject" name="inject"><option value="">General observation</option>'+d("injects").map(i=>'<option value="'+esc(i.id)+'">'+esc(i.title)+'</option>').join("")+'</select>'+
    '<label for="obs-competency">What were you observing?</label><select id="obs-competency" name="competency"><option>Decision quality</option><option>Working together</option><option>Use of information</option><option>Time management</option><option>Adapting to change</option><option>Other</option></select>'+
    '<label for="obs-rating">Indicative rating (optional)</label><select id="obs-rating" name="rating"><option value="">No rating</option><option value="1">1 – Major support needed</option><option value="2">2 – Developing</option><option value="3">3 – Adequate</option><option value="4">4 – Strong</option><option value="5">5 – Excellent</option></select>'+
    area("note","What did you see? Give a concrete example.")+'<button class="btn primary">Save observation</button></form></div>'+
    (staff()?'<div class="card"><h3>Record an improvement</h3><p class="tiny muted">Agree on what changes, who owns it, and the follow-up horizon.</p><form data-form="action" class="form"><label>Follow-up horizon</label><select name="horizon"><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select>'+area("action","Recommended improvement")+input("owner","Responsible function or owner")+'<button class="btn primary">Save action</button></form></div>':"")+'</aside></div>';
}
async function present(sessionId){const ses=d("agenda_sessions").find(x=>x.id===sessionId);if(!ses)throw Error("Session not found.");const slides=await qry("slides","?select=*&session_id=eq."+encodeURIComponent(sessionId)+"&order=position.asc");S.present={session:ses,slides:Array.isArray(slides)?slides:[]};S.slideIndex=0;render();}
function presentationScreen(){const p=S.present,s=p.slides[S.slideIndex]||{title:p.session.title,body:p.session.learning_objectives||"No slides authored."};root.innerHTML='<div class="presentation"><article><div class="kicker">EPR-Simex Training Studio · '+esc(p.session.title)+'</div><h1>'+esc(s.title)+'</h1><p>'+lines(s.body)+'</p></article><footer><button class="btn small" data-cmd="prev" '+(S.slideIndex===0?"disabled":"")+'>← Previous</button><span>'+ (S.slideIndex+1)+' / '+Math.max(1,p.slides.length)+'</span><div class="row"><button class="btn small" data-cmd="next" '+(S.slideIndex>=p.slides.length-1?"disabled":"")+'>Next →</button><button class="btn small" data-cmd="close-present">Exit</button></div></footer></div>';}
function render(){try{if(!configured){configScreen();return;}if(S.present){presentationScreen();return;}if(!S.user){authScreen();return;}userGuide();if(S.ex){exerciseScreen();return;}homeScreen();}catch(err){console.error(err);root.innerHTML='<main class="wrap"><div class="card notice error"><h2>Display error</h2><p>'+esc(err.message)+'</p><button onclick="location.reload()" class="btn">Reload</button></div></main>';}}
function csv(){const rows=[["Team","Inject","Status","Decision"],...d("submissions").map(s=>[d("teams").find(x=>x.id===s.team_id)?.name||"",d("injects").find(x=>x.id===s.inject_id)?.title||"",s.status,s.body])];const text=rows.map(r=>r.map(x=>{let v=String(x||"");if(/^[\s\u0000-\u001f]*[=+@-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';}).join(",")).join("\r\n");const blob=new Blob([text],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="epr-simex-decisions.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

async function openEditor(table,id){
  if(!EDIT_FIELDS[table])throw Error("This record type cannot be edited.");
  const rows=await qry(table,"?select=*&id=eq."+encodeURIComponent(id));
  const item=rows?.[0];
  if(!item||!canEditRecord(table,item))throw Error("You cannot edit this record with your current account permissions.");
  if(item.exercise_id&&item.exercise_id!==exid())throw Error("This record belongs to a different exercise.");
  S.editor={table,id,record:item};
  S.deletePrompt=null;
  render();
}
async function deletionBlocker(table,record){
  const local=deleteDependencies(table,record);
  if(local)return local;
  if(table==="exercises"){
    if(record.status!=="draft")return "Only draft exercises can be deleted. This exercise is no longer a draft.";
    if(record.created_by!==uid())return "Only the exercise creator can permanently delete this draft.";
    const id=encodeURIComponent(record.id);
    const [responses,released,files]=await Promise.all([
      qry("submissions","?select=id&exercise_id=eq."+id+"&limit=1"),
      qry("injects","?select=id&exercise_id=eq."+id+"&status=eq.released&limit=1"),
      qry("document_records","?select=id&exercise_id=eq."+id+"&kind=eq.file&limit=1")
    ]);
    if(responses?.length)return "This exercise already contains recorded team decisions. They must be retained for accountability; deletion is blocked.";
    if(released?.length)return "This exercise contains released information injects. Deletion is blocked to protect exercise history.";
    if(files?.length)return "This exercise contains uploaded files. Remove the stored files using Document library before deleting the exercise.";
  }
  if(table==="organizations"){
    const id=encodeURIComponent(record.id);
    const [exercises,docs,invites]=await Promise.all([
      qry("exercises","?select=id&org_id=eq."+id+"&limit=1"),
      qry("document_records","?select=id&org_id=eq."+id+"&limit=1"),
      qry("invitations","?select=id&org_id=eq."+id+"&limit=1")
    ]);
    if(exercises?.length)return "This organization still contains exercises. Delete eligible draft exercises first; others must be preserved.";
    if(docs?.length)return "This organization still has document references. Remove them before deleting the organization.";
    if(invites?.length)return "This organization still has invitations. Revoke or resolve outstanding invitations first.";
  }
  return "";
}

async function openDeletion(table,id){
  if(!DISPLAY_NAMES[table])throw Error("Unsupported record type.");
  const items=await qry(table,"?select=*&id=eq."+encodeURIComponent(id));
  const item=items?.[0];
  if(!item||!canDeleteRecord(table,item))throw Error("Deleting this record is not permitted for your role or its current status.");
  if(item.exercise_id&&item.exercise_id!==exid())throw Error("This record belongs to a different exercise.");
  S.editor=null;
  S.deletePrompt={table,id,record:item,blocker:await deletionBlocker(table,item),error:""};
  render();
}
function editableFields(table,record){
  let fs=EDIT_FIELDS[table]||[];
  if(table==="document_records"&&record.kind!=="link")fs=fs.filter(f=>f[0]!=="url");
  return fs;
}
async function saveEditor(form){
  if(!S.editor)throw Error("No record selected.");
  const {table,id,record}=S.editor;
  if(!canEditRecord(table,record))throw Error("You do not have permission to edit this record.");
  const fd=new FormData(form),patch={};
  for(const [key,_,type,required] of editableFields(table,record)){
    const v=String(fd.get(key)??"").trim();
    if(required&&!v)throw Error("Please complete the required field: "+key.replace(/_/g," ")+".");
    if(key==="notes"||key==="recipients")continue; // stored in their dedicated resource tables
    if(type==="number"){
      const n=Number(v);if(!Number.isInteger(n)||n<1||n>30)throw Error("A positive number between 1 and 30 is required.");
      patch[key]=n;continue;
    }
    if(key==="horizon"){patch[key]=Number(v);continue;}
    if(type==="time"){patch[key]=v||null;continue;}
    if(["day_id","stage_id","team_id"].includes(key)){patch[key]=v||null;continue;}
    patch[key]=v;
  }
  if(table==="document_records"){
    if(patch.visibility==="team"&&!patch.team_id)throw Error("Select a team before choosing team-only visibility.");
    if(patch.visibility!=="team")patch.team_id=null;
    if(record.kind==="link"&&!/^https:\/\//i.test(patch.url||""))throw Error("Document links must start with https://");
  }
  if(table==="exercises"&&patch.title.length<2)throw Error("Exercise titles need at least 2 characters.");
  if(table==="organizations"&&patch.name.length<2)throw Error("Organization names need at least 2 characters.");
  if(table==="submissions"){
    if(!teamIds().has(record.team_id)||!["draft","returned"].includes(record.status))throw Error("Only your own draft or returned response can be edited.");
    patch.status="draft";
  }
  const outcome=await update(table,id,patch);
  if(!outcome)throw Error("Nothing was updated. Your permissions or the record may have changed; refresh the page.");
  if(table==="injects"){
    const requested=String(fd.get("recipients")||"keep");
    if(requested!=="keep"){
      const wanted=requested==="all"?d("teams").filter(t=>t.kind==="team").map(t=>t.id):[requested];
      if(!wanted.length||wanted.some(id=>!d("teams").some(t=>t.id===id&&t.kind==="team")))throw Error("Select a valid participant team.");
      const existing=d("inject_targets").filter(x=>x.inject_id===id);
      for(const team of wanted.filter(t=>!existing.some(x=>x.team_id===t))){
        await insert("inject_targets",{org_id:orgid(),exercise_id:exid(),inject_id:id,team_id:team});
      }
      for(const target of existing.filter(x=>!wanted.includes(x.team_id))){
        const removed=await deleteRow("inject_targets",target.id);
        if(!removed)throw Error("Inject edited but old team targets could not be removed. Refresh and review recipients.");
      }
    }
  }
  if(table==="slides"||table==="agenda_sessions"){
    const noteType=table==="slides"?"slide":"session";
    const noteText=String(fd.get("notes")||"").trim();
    const oldNote=d("private_notes").find(n=>n.subject_type===noteType&&n.subject_id===id);
    if(oldNote&&oldNote.body!==noteText){
      if(noteText){const changed=await update("private_notes",oldNote.id,{body:noteText});if(!changed)throw Error("Slide saved, but private speaker notes could not be updated.");}
      else{const removed=await deleteRow("private_notes",oldNote.id);if(!removed)throw Error("Slide saved, but private speaker notes could not be cleared.");}
    }else if(!oldNote&&noteText){
      await insert("private_notes",{org_id:orgid(),exercise_id:exid(),subject_type:noteType,subject_id:id,body:noteText});
    }
  }
  const wasCurrent=!!S.ex;
  S.editor=null;
  S.info=(DISPLAY_NAMES[table]||"Record")+" updated successfully.";
  if(wasCurrent){await refreshExercise();if(table==="exercises")S.ex=outcome;render();}
  else await dashboard();
}
async function performDelete(form){
  if(!S.deletePrompt)throw Error("Select a record to delete.");
  const {table,id,record}=S.deletePrompt;
  if(!canDeleteRecord(table,record))throw Error("Deleting this record is not allowed.");
  const name=record.title||record.name||record.action||record.email||"this item";
  if(["organizations","exercises"].includes(table)){
    const typed=String(new FormData(form).get("confirmation")||"").trim();
    if(typed!==name)throw Error("Confirmation did not match the exact record name.");
  }
  const reason=await deletionBlocker(table,record);
  S.deletePrompt.blocker=reason;
  if(reason)throw Error(reason);
  if(table==="invitations"){
    const result=await update("invitations",id,{status:"revoked"});
    if(!result)throw Error("Invitation could not be revoked. It may already have been accepted.");
  }else{
    if(table==="document_records"&&record.kind==="file"){
      if(record.owner_id!==uid()||!record.storage_path)throw Error("Only the original uploader can remove this stored file.");
      // Storage is removed first. If that fails, keep the metadata record and show the failure.
      const storageResult=await request("/storage/v1/object/documents",{method:"DELETE",body:{prefixes:[record.storage_path]}});
      if(!Array.isArray(storageResult)||!storageResult.some(x=>x.name===record.storage_path||x.name===record.storage_path.split("/").pop())){
        throw Error("Storage deletion could not be verified. The document record was kept; contact the facilitator.");
      }
    }
    const result=await deleteRow(table,id);
    if(!result)throw Error("The database did not delete this record. Refresh and check permissions.");
  }
  const wasExercise=!!S.ex;
  S.deletePrompt=null;
  S.info=(table==="invitations"?"Invitation revoked.":(DISPLAY_NAMES[table]||"Record")+" deleted.");
  if(["organizations","exercises"].includes(table)){
    if(table==="organizations"||!wasExercise||S.ex.id===id){S.org=table==="organizations"?null:S.org;await dashboard();return;}
  }
  if(wasExercise)await refreshExercise();else await dashboard();
}

async function command(btn){let cmd=btn.dataset.cmd;if(cmd==="edit-record"){await openEditor(btn.dataset.table,btn.dataset.id);return;}if(cmd==="delete-record"){await openDeletion(btn.dataset.table,btn.dataset.id);return;}if(cmd==="edit-cancel"){S.editor=null;render();return;}if(cmd==="delete-cancel"){S.deletePrompt=null;render();return;}if(cmd==="help-open"){S.helpOpen=true;S.hintExpanded=false;render();return;}if(cmd==="help-close"){S.helpOpen=false;render();return;}if(cmd==="guide-start"){S.tourStep=0;S.tourActive=true;render();return;}if(cmd==="guide-skip"){closeGuide();render();return;}if(cmd==="guide-back"){S.tourStep=Math.max(0,S.tourStep-1);render();return;}if(cmd==="guide-next"){S.tourStep=Math.min(tourSteps().length-1,S.tourStep+1);render();return;}if(cmd==="hint-toggle"){S.hintExpanded=!S.hintExpanded;render();return;}if(cmd==="help-go"){S.helpOpen=false;if(btn.dataset.tab==="home"){await dashboard();return;}if(!S.ex){flash("Open an exercise first to use this section.",true);return;}S.tab=btn.dataset.tab;S.hintExpanded=true;render();return;}if(cmd==="auth-mode"){S.authMode=btn.dataset.mode==="signin"?"signin":"signup";S.error="";S.info="";S.registrationEmail="";render();return;}if(cmd==="auth-start-over"){S.registrationEmail="";S.error="";S.info="";render();return;}if(cmd==="resend-confirmation"){await resendConfirmation(S.registrationEmail);S.error="";S.info="Supabase accepted the verification request, but delivery is not guaranteed. If nothing arrives, ask the project administrator to configure custom SMTP; already-confirmed accounts can sign in directly.";render();return;}if(cmd==="start-decision"){S.selectedInject=btn.dataset.id;S.tab="responses";S.info="Review the situation and record your team\u2019s decision.";render();return;}if(cmd==="focus-stage"){S.focusStage=btn.dataset.id;render();return;}if(cmd==="session-challenge"){S.focusStage=btn.dataset.id;S.tab="scenario";render();return;}if(cmd==="show-all-events"){S.focusStage=null;render();return;}if(cmd==="focus-event"){const i=d("injects").find(x=>x.id===btn.dataset.id);S.focusStage=i?.stage_id||null;S.tab="scenario";render();return;}if(cmd==="home"){await dashboard();return;}if(cmd==="signout"){await signOut();return;}if(cmd==="open"){await loadExercise(btn.dataset.id,"control");return;}if(cmd==="refresh"){await refreshExercise();return;}if(cmd==="tab"){S.tab=btn.dataset.tab;S.info="";S.error="";render();return;}if(cmd==="status"){await update("exercises",exid(),{status:btn.dataset.status});S.info="Exercise status updated.";await refreshExercise();return;}if(cmd==="release"){await update("injects",btn.dataset.id,{status:"released"});S.info="Inject released to authorized teams.";await refreshExercise();return;}if(cmd==="present"){await present(btn.dataset.id);return;}if(cmd==="prev"){S.slideIndex=Math.max(0,S.slideIndex-1);render();return;}if(cmd==="next"){S.slideIndex=Math.min(S.slideIndex+1,S.present.slides.length-1);render();return;}if(cmd==="close-present"){S.present=null;render();return;}if(cmd==="export"){csv();return;}if(cmd==="copy"){await navigator.clipboard.writeText(S.inviteUrl);flash("Private invitation link copied.");return;}if(cmd==="review"){const sub=d("submissions").find(s=>s.id===btn.dataset.id);if(!sub)throw Error("Submission not found");const comment=prompt(btn.dataset.status==="returned"?"Reason for returning:":"Review comment:")||"";await insert("reviews",{submission_id:sub.id,exercise_id:exid(),org_id:orgid(),team_id:sub.team_id,reviewer_id:uid(),decision:btn.dataset.status,comment});await update("submissions",sub.id,{status:btn.dataset.status});S.info="Review saved.";await refreshExercise();return;}if(cmd==="document"){let doc=d("document_records").find(x=>x.id===btn.dataset.id);if(!doc)throw Error("Reference unavailable");if(doc.kind==="link"){if(!/^https:\/\//i.test(doc.url))throw Error("Only HTTPS links are permitted");window.open(doc.url,"_blank","noopener,noreferrer");}else{let encoded=doc.storage_path.split("/").map(encodeURIComponent).join("/");let r=await request("/storage/v1/object/sign/documents/"+encoded,{method:"POST",body:{expiresIn:60}});let path=r.signedURL||r.signedUrl;if(!path)throw Error("No download URL returned");let u=path.startsWith("http")?path:base+"/storage/v1"+path;window.open(u,"_blank","noopener,noreferrer");}return;}}
async function submitForm(form,btn){const fd=new FormData(form),kind=form.dataset.form;if(kind==="edit-record"){await saveEditor(form);return;}if(kind==="delete-record"){await performDelete(form);return;}
if(kind==="auth"){let email=val(fd,"email"),pw=String(fd.get("password")||"");if(S.authMode==="signup"){if(pw.length<8)throw Error("Choose a password with at least 8 characters.");if(pw!==String(fd.get("confirmPassword")||""))throw Error("The two passwords do not match.");await signUp(email,pw);if(!S.user){S.registrationEmail=email;S.error="";S.info="";render();return;}}else await signIn(email,pw);S.registrationEmail="";if(S.invite){await rpc("accept_invitation",{_token:S.invite});S.invite="";history.replaceState(null,"",location.pathname);}S.info="Signed in.";await dashboard();return;}
if(kind==="organization"){await rpc("create_organization",{_name:val(fd,"name"),_description:val(fd,"description")});S.info="Organization created.";await dashboard();return;}
if(kind==="exercise"){let days=Number(val(fd,"num_days"));if(days<1||days>30)throw Error("Duration must be between 1 and 30 days");const x=await insert("exercises",{org_id:orgid(),title:val(fd,"title"),description:val(fd,"description"),num_days:days,created_by:uid()});S.info="Exercise created.";await dashboard();if(x?.id)await loadExercise(x.id,"control");return;}
const common={org_id:orgid(),exercise_id:exid()};
if(kind==="team"){await insert("teams",{...common,name:val(fd,"name"),kind:val(fd,"kind"),description:val(fd,"description")});S.info="Group created.";await refreshExercise();return;}
if(kind==="stage"){await insert("stages",{...common,name:val(fd,"name"),code:val(fd,"code"),description:val(fd,"description"),position:d("stages").length+1});S.info="Stage created.";await refreshExercise();return;}
if(kind==="inject"){let stage=val(fd,"stage"),target=val(fd,"target");if(!stage)throw Error("Choose a stage.");let targets=target==="all"?d("teams").filter(x=>x.kind==="team").map(x=>x.id):[target];if(!targets.length||targets.some(x=>!x))throw Error("Add a participant team before creating an inject.");const inj=await insert("injects",{...common,stage_id:stage,title:val(fd,"title"),body:val(fd,"body"),response_prompt:val(fd,"prompt"),created_by:uid(),status:"draft",position:d("injects").length+1});if(!inj?.id)throw Error("Inject was not returned by the backend.");for(const team_id of targets)await insert("inject_targets",{...common,inject_id:inj.id,team_id});S.info="Inject drafted for "+targets.length+" team(s).";await refreshExercise();return;}
if(kind==="invite"){const email=val(fd,"email").toLowerCase(),team=val(fd,"team");let role=val(fd,"role");const inv=await insert("invitations",{...common,email,team_id:team||null,exercise_role:role,org_role:"member",invited_by:uid()});if(!inv?.token)throw Error("Invitation token not available.");S.inviteUrl=location.origin+location.pathname+"?invite="+encodeURIComponent(inv.token);S.info="Invitation created; copy and send the link privately to "+email+".";await refreshExercise();return;}
if(kind==="day"){await insert("agenda_days",{...common,day_number:Number(val(fd,"number")),title:val(fd,"title")});S.info="Training day created.";await refreshExercise();return;}
if(kind==="session"){let day=val(fd,"day"),stage=val(fd,"stage");if(!day)throw Error("Choose a training day.");if(stage&&!d("stages").some(x=>x.id===stage))throw Error("Choose an existing scenario stage.");const ses=await insert("agenda_sessions",{...common,day_id:day,title:val(fd,"title"),session_type:val(fd,"type"),start_time:val(fd,"start")||null,learning_objectives:val(fd,"objectives"),stage_id:stage||null,position:d("agenda_sessions").length+1});if(val(fd,"notes")&&ses?.id)await insert("private_notes",{...common,subject_type:"session",subject_id:ses.id,body:val(fd,"notes")});S.info="Activity added to the teaching programme.";await refreshExercise();return;}
if(kind==="slide"){let ses=val(fd,"session");if(!ses)throw Error("Choose a session.");const slide=await insert("slides",{...common,session_id:ses,title:val(fd,"title"),body:val(fd,"body"),position:d("slides").filter(x=>x.session_id===ses).length+1});if(val(fd,"notes")&&slide?.id)await insert("private_notes",{...common,subject_type:"slide",subject_id:slide.id,body:val(fd,"notes")});S.info="Slide added.";await refreshExercise();return;}
if(kind==="link"){const url=val(fd,"url"),visibility=val(fd,"visibility"),team=val(fd,"team");if(!/^https:\/\//i.test(url))throw Error("Only HTTPS links are allowed.");if(visibility==="team"&&!team)throw Error("Select a team.");await insert("document_records",{...common,title:val(fd,"title"),kind:"link",url,visibility,team_id:visibility==="team"?team:null,owner_id:uid()});S.info="Reference added.";await refreshExercise();return;}
if(kind==="upload"){const file=fd.get("file"),visibility=val(fd,"visibility"),team=val(fd,"team");if(!(file instanceof File)||!file.size)throw Error("Choose a file.");if(file.size>20*1024*1024)throw Error("20 MB maximum.");if(visibility==="team"&&!team)throw Error("Select a team.");const types={"application/pdf":1,"application/vnd.openxmlformats-officedocument.presentationml.presentation":1,"application/vnd.openxmlformats-officedocument.wordprocessingml.document":1};if(!types[file.type])throw Error("Only PDF, PPTX and DOCX files are supported in this development preview.");let id=crypto.randomUUID(),path=orgid()+"/"+exid()+"/"+id+"/"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");await insert("document_records",{id,...common,title:val(fd,"title"),kind:"file",storage_path:path,mime_type:file.type,size_bytes:file.size,visibility,team_id:visibility==="team"?team:null,owner_id:uid()});const headers={apikey:pub,Authorization:"Bearer "+S.session.access_token,"Content-Type":file.type,"x-upsert":"false"};const res=await fetch(base+"/storage/v1/object/documents/"+path.split("/").map(encodeURIComponent).join("/"),{method:"POST",headers,body:file});if(!res.ok){const msg=(await res.text()).slice(0,500);try{await request("/rest/v1/document_records?id=eq."+id,{method:"DELETE"});}catch{}throw Error("Upload failed: "+msg);}S.info="File stored privately. Malware scanning is not configured.";await refreshExercise();return;}
if(kind==="response"){const team=val(fd,"team"),inject=val(fd,"inject"),status=btn?.value==="submitted"?"submitted":"draft";if(!teamIds().has(team)||!targetInjects().some(i=>i.id===inject))throw Error("You are not assigned to this released inject.");let existing=d("submissions").find(s=>s.team_id===team&&s.inject_id===inject);let changes={body:val(fd,"body"),status};if(existing){await update("submissions",existing.id,changes);}else{await insert("submissions",{...common,team_id:team,inject_id:inject,...changes});}S.selectedInject=null;S.info=status==="submitted"?"Your team\u2019s decision has been submitted.":"Your decision draft has been saved.";await refreshExercise();return;}
if(kind==="message"){const b=val(fd,"body");if(!b)throw Error("Message cannot be empty.");const from=staff()?null:val(fd,"team");await insert("messages",{...common,sender_id:uid(),team_id:from||null,to_team_id:staff()?(val(fd,"recipient")||null):null,channel:staff()?"facilitators":"team",body:b});S.info="Message sent.";await refreshExercise();return;}
if(kind==="observation"){
  if(!overseer())throw Error("Only assigned facilitators and evaluators may record observations.");
  const note=val(fd,"note"),team=val(fd,"team"),inject=val(fd,"inject"),rating=val(fd,"rating");
  if(!note||note.length>4000)throw Error("Write a brief observation (up to 4000 characters).");
  if(team&&!d("teams").some(t=>t.id===team))throw Error("Choose a team from the exercise.");
  if(inject&&!d("injects").some(i=>i.id===inject))throw Error("Choose a visible situation update.");
  await insert("observations",{...common,observer_id:uid(),team_id:team||null,inject_id:inject||null,competency:val(fd,"competency"),rating:rating?Number(rating):null,note});
  S.info="Observation saved. Use it as evidence during the debrief.";await refreshExercise();return;
}
if(kind==="action"){await insert("action_items",{...common,horizon:Number(val(fd,"horizon")),action:val(fd,"action"),owner_name:val(fd,"owner"),created_by:uid()});S.info="After-action improvement recorded.";await refreshExercise();return;}
}
document.addEventListener("click",async e=>{const b=e.target.closest("[data-cmd]");if(!b||b.disabled)return;b.disabled=true;try{S.error="";await command(b);}catch(err){flash(err.message,true);}finally{b.disabled=false;}});
document.addEventListener("submit",async e=>{const f=e.target.closest("form[data-form]");if(!f)return;e.preventDefault();const b=e.submitter||f.querySelector("button");if(b)b.disabled=true;try{S.error="";await submitForm(f,e.submitter);}catch(err){if(f.dataset.form==="delete-record"&&S.deletePrompt){S.deletePrompt.error=err.message||"Deletion failed. Please check dependencies and permissions.";S.error="";render();}else flash(err.message,true);}finally{if(b)b.disabled=false;}});
document.addEventListener("change",async e=>{if(e.target.id==="org-picker"){S.org=S.orgs.find(x=>x.id===e.target.value);try{await dashboard();}catch(err){flash(err.message,true);}}});
window.addEventListener("keydown",e=>{if(e.key==="Escape"&&S.editor){S.editor=null;render();return;}if(e.key==="Escape"&&S.deletePrompt){S.deletePrompt=null;render();return;}if(e.key==="Escape"&&S.helpOpen){S.helpOpen=false;render();return;}if(!S.present)return;if(e.key==="ArrowRight"&&S.slideIndex<S.present.slides.length-1){S.slideIndex++;render();}if(e.key==="ArrowLeft"&&S.slideIndex>0){S.slideIndex--;render();}if(e.key==="Escape"){S.present=null;render();}});
(async()=>{if(!configured){render();return;}parseEmailConfirmation();await refreshAuth();await restoreConfirmedIdentity();if(S.user){try{if(S.invite){await rpc("accept_invitation",{_token:S.invite});S.invite="";history.replaceState(null,"",location.pathname);}await dashboard();}catch(err){flash(err.message,true);}}else render();})();
