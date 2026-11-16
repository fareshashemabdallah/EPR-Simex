/* EPR-Simex portable training-pack importer. The source JSON never enters
 * the public repository; only a facilitator's explicit installation creates
 * RLS-protected course and scenario records on their organization's server.
 * No privileged database keys and no bundled agency-specific training data. */
(function(){
"use strict";
const fail=m=>{throw Error("Training pack: "+m);};
const check=(x,label,max=6000)=>{if(typeof x!=="string"||x.length>max)fail(label+" must be text of at most "+max+" characters.");return x;};
const opt=(x,label,max)=>check(x??"",label,max);
const keys=(items,label)=>{
 const seen=new Set();
 for(const x of items){
  if(!x||typeof x!=="object"||Array.isArray(x))fail("Invalid "+label+" entry.");
  let k=check(x.key,label+" key",80);
  if(!/^[a-z0-9_-]+$/i.test(k)||seen.has(k))fail(label+" keys must be unique (letters, numbers, hyphen, underscore).");
  seen.add(k);
 }return seen;
};
function validate(p){
 if(!p||typeof p!=="object"||Array.isArray(p)||p.format!=="epr-simex-course-pack"||p.format_version!==1)fail("Unsupported course pack format/version.");
 check(p.title,"Title",200);opt(p.notice,"Privacy notice",2000);opt(p.learning_objectives,"Learning goals",6000);
 const arr=(k,min,max)=>{if(!Array.isArray(p[k])||p[k].length<min||p[k].length>max)fail(k+" must contain "+min+" to "+max+" entries.");};
 arr("teams",1,12);arr("stages",1,30);arr("days",1,14);arr("events",0,250);
 const teamkeys=keys(p.teams,"Team"),stagekeys=keys(p.stages,"Stage");keys(p.events,"Event");
 for(const t of p.teams){check(t.name,"Team name",120);opt(t.description,"Team description",3000);if(t.kind!=="team")fail("Only participant teams are supported.");}
 for(const t of p.stages){check(t.name,"Stage name",180);opt(t.description,"Stage context",4000);opt(t.code,"Stage code",50);}
 let sessionCount=0,slideCount=0;const daynums=new Set(),seskeys=new Set();
 for(const day of p.days){
  if(!day||!Number.isInteger(day.day_number)||day.day_number<1||day.day_number>30||daynums.has(day.day_number))fail("Day numbers must be unique integers from 1–30.");
  daynums.add(day.day_number);check(day.title,"Day title",180);
  if(!Array.isArray(day.sessions)||day.sessions.length>60)fail("Too many sessions in a day.");
  for(const ses of day.sessions){
   if(!ses||typeof ses!=="object")fail("Invalid session.");
   const k=check(ses.key,"Session key",80);
   if(seskeys.has(k))fail("Duplicate session key.");seskeys.add(k);
   check(ses.title,"Session title",250);
   if(!["presentation","exercise","debrief","break","other"].includes(ses.session_type))fail("Invalid session type.");
   for(const field of ["learning_objectives","instructions","facilitator_notes"])opt(ses[field],"Session "+field,6000);
   for(const field of ["start_time","end_time"])if(ses[field]&&!/^\d{2}:\d{2}$/.test(ses[field]))fail("Times must be HH:MM.");
   if(ses.stage_key&&!stagekeys.has(ses.stage_key))fail("Session links to an unknown stage.");
   if(!Array.isArray(ses.slides)||ses.slides.length>80)fail("Too many slides.");
   for(const sl of ses.slides){if(!sl||typeof sl!=="object")fail("Invalid slide.");opt(sl.title,"Slide title",250);opt(sl.body,"Slide body",6000);opt(sl.notes,"Slide notes",6000);slideCount++;}
   sessionCount++;
  }
 }
 if(sessionCount>180||slideCount>700)fail("Too many sessions/slides.");
 for(const e of p.events){
  check(e.title,"Event title",200);opt(e.body,"Event update",6000);opt(e.response_prompt,"Event challenge",4000);
  opt(e.facilitator_notes,"Private event notes",6000);opt(e.release_hint,"Release hint",80);
  if(!stagekeys.has(e.stage_key))fail("Event links to an unknown stage.");
  if(e.target!=="all"&&!teamkeys.has(e.target))fail("Event recipients must be 'all' or a known team.");
 }
 return {data:p,dayCount:p.days.length,sessionCount,slideCount,stageCount:p.stages.length,teamCount:p.teams.length,eventCount:p.events.length};
}
async function install(review,cfg){
 const p=validate(review.data||review).data;
 const {insert,update,orgId,exerciseId,userId,onProgress,existingObjectives}=cfg||{};
 if(typeof insert!=="function"||typeof update!=="function"||!orgId||!exerciseId||!userId)fail("Missing installation context.");
 const common={org_id:orgId,exercise_id:exerciseId},teams=new Map(),stages=new Map();let count=0;
 async function save(table,body){
  const record=await insert(table,body);
  if(!record?.id)fail(table+" could not be saved.");
  count++;if(typeof onProgress==="function"&&(count===1||count%15===0))onProgress("Installing course: "+count+" records saved. Keep this tab open.");
  return record;
 }
 try{
  for(const t of p.teams){const r=await save("teams",{...common,name:t.name,kind:"team",description:t.description||""});teams.set(t.key,r.id);}
  for(let i=0;i<p.stages.length;i++){const t=p.stages[i],r=await save("stages",{...common,name:t.name,code:t.code||"",description:t.description||"",position:i+1});stages.set(t.key,r.id);}
  for(const d of p.days){
   const day=await save("agenda_days",{...common,title:d.title,day_number:d.day_number});
   for(let i=0;i<d.sessions.length;i++){
    const s=d.sessions[i],se=await save("agenda_sessions",{...common,day_id:day.id,title:s.title,position:i+1,
     session_type:s.session_type,start_time:s.start_time||null,end_time:s.end_time||null,learning_objectives:s.learning_objectives||"",
     instructions:s.instructions||"",stage_id:s.stage_key?stages.get(s.stage_key):null});
    if(s.facilitator_notes)await save("private_notes",{...common,subject_type:"session",subject_id:se.id,body:s.facilitator_notes});
    for(let n=0;n<s.slides.length;n++){
     const sl=s.slides[n],r=await save("slides",{...common,session_id:se.id,title:sl.title||"",body:sl.body||"",position:n+1});
     if(sl.notes)await save("private_notes",{...common,subject_type:"slide",subject_id:r.id,body:sl.notes});
    }
   }
  }
  for(let i=0;i<p.events.length;i++){
   const e=p.events[i],r=await save("injects",{...common,stage_id:stages.get(e.stage_key),title:e.title,body:e.body||"",
    response_prompt:e.response_prompt||"",position:i+1,status:"draft",created_by:userId});
   const recipients=e.target==="all"?Array.from(teams.values()):[teams.get(e.target)];
   for(const team_id of recipients)await save("inject_targets",{...common,team_id,inject_id:r.id});
   const note=[e.release_hint?"Suggested workshop release: "+e.release_hint:"",e.facilitator_notes||""].filter(Boolean).join("\n");
   if(note)await save("private_notes",{...common,subject_type:"inject",subject_id:r.id,body:note});
  }
  if(!String(existingObjectives||"").trim()&&p.learning_objectives)await update("exercises",exerciseId,{objectives:p.learning_objectives});
  onProgress?.("Course ready: "+count+" training and exercise records created.");
  return {records:count};
 }catch(error){const e=Error("Installation stopped after "+count+" records; a partial course may exist. Do not reinstall into the same exercise. "+(error.message||error));e.records=count;throw e;}
}
const api=Object.freeze({validate,install});if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(typeof window!=="undefined")window.EPR_PACK=api;
})();