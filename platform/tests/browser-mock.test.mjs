import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source=readFileSync(new URL("../app.js",import.meta.url),"utf8");
function harness(configured=true){
  const root={innerHTML:""}, listeners={};
  const backend={org:false,exercise:false,status:"draft",teams:[],stages:[],injects:[],targets:[]};
  const uuid={id:"test-user",email:"facilitator@example.org"};
  const data=(path,method,body)=>{
    if(path.startsWith("/auth/v1/token"))return {access_token:"fake-access-token",refresh_token:"fake-refresh",expires_in:3600,user:uuid};
    if(path==="/auth/v1/logout")return {};
    if(path.includes("/rpc/create_organization")){backend.org=true;return "org-1";}
    if(path.includes("/org_memberships")&&method==="GET")return backend.org?[{org_id:"org-1",role:"org_admin",status:"active",organizations:{id:"org-1",name:"Agency Training Unit"}}]:[];
    if(path.includes("/exercises")){
      if(method==="POST"){backend.exercise=true;return [{id:"ex-1",org_id:"org-1",title:body.title,description:body.description||"",created_by:uuid.id,status:"draft"}];}
      if(method==="PATCH"){backend.status=body.status;return [{id:"ex-1",title:"Flood SIMEX",description:"",status:backend.status}];}
      if(method==="GET")return backend.exercise?[{id:"ex-1",org_id:"org-1",title:"Flood SIMEX",description:"Fictional flood",created_by:uuid.id,status:backend.status}]:[];
    }
    if(path.includes("/exercise_memberships"))return backend.exercise?[{exercise_id:"ex-1",user_id:uuid.id,role:"director"}]:[];
    for(const [name,key,baseId] of [["teams","teams","team-"],["stages","stages","stage-"],["injects","injects","inject-"],["inject_targets","targets","target-"]]){
      if(path.includes("/"+name)){
        if(method==="POST"){const rec={...body,id:baseId+(backend[key].length+1)};backend[key].push(rec);return [rec];}
        if(method==="PATCH"&&name==="injects"){let x=backend[key].find(i=>i.id==="inject-1");Object.assign(x,body);return [x];}
        return backend[key];
      }
    }
    return [];
  };
  const fetch=async(url,opts={})=>{
    const u=new URL(url),method=opts.method||"GET",body=opts.body&&typeof opts.body==="string"?JSON.parse(opts.body):null;
    let value;
    try{value=data(u.pathname,method,body);}catch(e){return {ok:false,status:400,text:async()=>JSON.stringify({message:e.message})};}
    return {ok:true,status:200,text:async()=>JSON.stringify(value)};
  };
  const document={getElementById:id=>id==="app"?root:null,addEventListener:(type,fn)=>listeners[type]=fn};
  class FormDataStub{constructor(form){this.form=form;}get(k){return this.form.values[k]??null;}}
  const storage=new Map(), sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  const location={search:"",pathname:"/platform/",origin:"http://localhost"};
  const context={
    document,window:{EPR_CONFIG:{supabaseUrl:configured?"https://example.supabase.co":"",publishableKey:configured?"sb_publishable_test_key_1234567890abcdef":""},addEventListener:()=>{}},
    URL,URLSearchParams,location,history:{replaceState:()=>{}},sessionStorage,fetch,FormData:FormDataStub,
    crypto:{randomUUID:()=>"file-123"},File:class{},navigator:{clipboard:{writeText:async()=>{}}},Blob,
    setTimeout,console,prompt:()=>"Reviewed"
  };
  vm.runInNewContext(source,context,{filename:"platform/app.js"});
  const submit=async(kind,values,buttonValue)=>{
    const form={dataset:{form:kind},values,closest:()=>form};
    const submitter={value:buttonValue||"",disabled:false};
    await listeners.submit({target:form,submitter,preventDefault:()=>{}});
    return root.innerHTML;
  };
  const click=async(cmd,attrs={})=>{
    const btn={dataset:{cmd,...attrs},disabled:false,closest:()=>btn};
    await listeners.click({target:btn});
    return root.innerHTML;
  };
  return {root,listeners,backend,submit,click};
}
test("unconfigured environment shows a truthful setup screen",async()=>{
  const h=harness(false);
  await new Promise(setImmediate);
  assert.match(h.root.innerHTML,/Database connection required/);
  assert.doesNotMatch(h.root.innerHTML,/Sign in to your/);
});
test("create-account screen invokes signup and displays verification guidance",async()=>{
  const h=harness();
  await new Promise(setImmediate);
  assert.match(h.root.innerHTML,/Create your account/);
  const html=await h.submit("auth",{email:"test@example.org",password:"test-password-123",confirmPassword:"test-password-123"},"signup");
  assert.match(html,/Registration request received/);
  assert.match(html,/resend-confirmation/);
  await h.click("resend-confirmation");
  assert.match(h.root.innerHTML,/Supabase accepted the verification request/);
  assert.match(html,/test@example.org/);
  await h.click("auth-mode",{mode:"signin"});
  assert.match(h.root.innerHTML,/Sign in/);
});
test("auth -> org -> exercise -> team -> stage -> targeted inject",async()=>{
  const h=harness();
  await new Promise(setImmediate);
  assert.match(h.root.innerHTML,/Create your account/);
  await h.click("auth-mode",{mode:"signin"});
  assert.match(h.root.innerHTML,/Sign in/);
  await h.submit("auth",{email:"facilitator@example.org",password:"test-password-12"},"signin");
  assert.match(h.root.innerHTML,/Create organization/);
  await h.submit("organization",{name:"Agency Training Unit",description:"Synthetic simulation only"});
  assert.match(h.root.innerHTML,/Agency Training Unit/);
  await h.submit("exercise",{title:"Flood SIMEX",description:"Fictional flood",num_days:"3"});
  assert.match(h.root.innerHTML,/Flood SIMEX/);
  await h.submit("team",{name:"Team Alpha",kind:"team",description:"Country coordination"});
  assert.equal(h.backend.teams.length,1);
  await h.submit("stage",{name:"PREPARE",code:"T-30",description:"Preparedness"});
  assert.equal(h.backend.stages.length,1);
  await h.submit("inject",{stage:"stage-1",target:"all",title:"Road closure",body:"<script>bad()</script>",prompt:"Decide alternative route"});
  assert.equal(h.backend.injects.length,1);
  assert.equal(h.backend.targets.length,1);
  assert.match(h.root.innerHTML,/Road closure/);
  assert.match(h.root.innerHTML,/&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(h.root.innerHTML,/<script>bad\(\)<\/script>/);
});
