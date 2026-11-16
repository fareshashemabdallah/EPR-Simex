import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const ctx={window:{}};
vm.runInNewContext(readFileSync(new URL("../training-pack.js",import.meta.url),"utf8"),ctx);
const engine=ctx.window.EPR_PACK;
const sample=()=>({
 format:"epr-simex-course-pack",format_version:1,title:"Fictional practice",
 notice:"No personal or confidential content",learning_objectives:"Apply principles to a case",
 teams:[{key:"a",name:"Team A",kind:"team",description:"Synthetic participants"}],
 stages:[{key:"t0",name:"Activation",code:"H0",description:"Fictional emergency"}],
 days:[{day_number:1,title:"Day One",sessions:[{key:"s1",title:"Preparation",session_type:"presentation",
 start_time:"08:30",end_time:"09:15",learning_objectives:"Be prepared",
 instructions:"Make a plan",facilitator_notes:"PRIVATE FACILITATOR PROMPT",stage_key:"t0",
 slides:[{title:"Slide 1",body:"Synthetic content"}]}]}],
 events:[{key:"e1",stage_key:"t0",release_hint:"10:15",title:"Route closure",body:"A bridge is closed",
 response_prompt:"Select a feasible route",facilitator_notes:"PRIVATE RELEASE INSTRUCTION",target:"all"}]
});
test("preview gives accurate counts without modifying data",()=>{
 const result=engine.validate(sample());
 assert.equal(result.dayCount,1);assert.equal(result.sessionCount,1);
 assert.equal(result.slideCount,1);assert.equal(result.eventCount,1);
});
test("rejects invalid foreign stage, duplicate keys, oversized text",()=>{
 let p=sample();p.events[0].stage_key="not-present";
 assert.throws(()=>engine.validate(p),/unknown stage/);
 p=sample();p.days[0].sessions.push({...p.days[0].sessions[0]});
 assert.throws(()=>engine.validate(p),/Duplicate session key/);
 p=sample();p.events[0].title="a".repeat(201);
 assert.throws(()=>engine.validate(p),/Event title/);
});
test("installs only drafts, separate facilitator notes and scoped records",async()=>{
 const rows=[],s=sample();
 const insert=async(table,body)=>{let record={...body,id:"id-"+(rows.length+1)};rows.push({table,...record});return record;};
 const updates=[];
 const result=await engine.install(engine.validate(s),{insert,update:async(...args)=>updates.push(args),
 orgId:"org-1",exerciseId:"ex-1",userId:"user-1",existingObjectives:""});
 assert.equal(result.records,9);
 assert.equal(rows.filter(x=>x.table==="private_notes").length,2);
 assert.equal(rows.filter(x=>x.table==="injects")[0].status,"draft");
 assert.equal(rows.filter(x=>x.table==="inject_targets").length,1);
 assert.equal(rows.filter(x=>x.table==="agenda_sessions")[0].stage_id,rows.filter(x=>x.table==="stages")[0].id);
 assert.ok(rows.every(x=>x.org_id==="org-1"&&x.exercise_id==="ex-1"));
 assert.equal(updates.length,1);
});
