#!/usr/bin/env node
/**
 * Database smoke test.
 *
 * Runs every persistence path against a running API: accounts, profile, records,
 * conversations, a full bilingual assessment, the report and FHIR exports,
 * directory queries, an agent turn and deletion. Point it at an API started with
 * DATABASE_URL set and it proves the SQL paths, not just the in-memory ones.
 *
 *   node scripts/db-smoke.js            # against http://localhost:4000
 *   HEALTRIP_API=https://… node scripts/db-smoke.js
 */

const B = process.env.HEALTRIP_API || 'http://localhost:4000';
const j=async(p,o={})=>{const r=await fetch(B+p,o);const ct=r.headers.get('content-type')||'';const d=ct.includes('json')?await r.json():await r.text();return {s:r.status,d}};
const H=(t,l='en')=>({'content-type':'application/json','accept-language':l,...(t?{authorization:'Bearer '+t}:{})});
(async()=>{
 const email=`pg${Date.now()}@t.com`;
 let r=await j('/api/auth/register',{method:'POST',headers:H(),body:JSON.stringify({email,password:'strongpassword123'})});
 console.log('register',r.s); const tok=r.d.token;
 console.log('profile put', (await j('/api/profile',{method:'PUT',headers:H(tok),body:JSON.stringify({full_name:'Lamya Ali',country:'Sudan',city:'Khartoum',preferred_language:'ar'})})).s);
 console.log('record', (await j('/api/profile/records',{method:'POST',headers:H(tok),body:JSON.stringify({record_type:'allergy',title:'Penicillin',content:{details:'rash'}})})).s);
 const pr=await j('/api/profile',{headers:H(tok)}); console.log('profile get', pr.s, '| records', pr.d.records.length, '| name', pr.d.profile.full_name);
 const c=await j('/api/chat/conversations',{method:'POST',headers:H(tok),body:JSON.stringify({title:'t'})}); console.log('conv', c.s);
 const m=await j(`/api/chat/conversations/${c.d.conversation.id}/messages`,{method:'POST',headers:H(tok),body:JSON.stringify({message:'What does HbA1c mean?'})}); console.log('chat', m.s);
 const hist=await j(`/api/chat/conversations/${c.d.conversation.id}`,{headers:H(tok)}); console.log('messages persisted', hist.d.messages.length);
 // assessment through v1 to summary, then report + fhir + delete
 let a=await j('/api/v1/assessments',{method:'POST',headers:H(null,'ar'),body:JSON.stringify({message:'عندي صداع منذ أمس في جهة واحدة ونابض'})});
 const id=a.d.assessment_id; let n=0;
 while(a.d.type==='question'&&n++<10) a=await j(`/api/v1/assessments/${id}/answers`,{method:'POST',headers:H(null,'ar'),body:JSON.stringify({question_id:a.d.question.id,value:a.d.question.options[0].value})});
 console.log('assessment', a.d.type, a.d.urgency, '| persisted read:', (await j(`/api/v1/assessments/${id}`)).s);
 console.log('report', (await j(`/api/v1/assessments/${id}/report?lang=ar`)).s, '| fhir', (await j(`/api/v1/assessments/${id}/fhir`)).s);
 console.log('doctors via db', (await j('/api/v1/doctors?specialty=Cardiology&language=Arabic')).d.count);
 console.log('hospitals via db', (await j('/api/v1/hospitals?emergency=true')).d.count);
 console.log('agent', (await j('/api/v1/agent/chat',{method:'POST',headers:H(null),body:JSON.stringify({message:'Find me a cardiologist in London'})})).d.message.slice(0,80));
 console.log('delete', (await j(`/api/v1/assessments/${id}`,{method:'DELETE',headers:H(tok)})).s, '| after delete', (await j(`/api/v1/assessments/${id}`)).s);
  const health = await j('/api/v1/health');
  console.log('storage reported by the API:', health.d.storage);
  if (health.d.storage !== 'postgres') {
    console.log('NOTE: the API is running in memory mode, so this run did not exercise SQL.');
    process.exitCode = 1;
  }
})();
