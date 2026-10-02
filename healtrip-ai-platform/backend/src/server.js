'use strict';
require('dotenv').config();
const express=require('express'),helmet=require('helmet'),cors=require('cors'),crypto=require('crypto'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),multer=require('multer');
const {z}=require('zod');const engine=require('./clinical/engine'),kb=require('./clinical/knowledge'),providers=require('./clinical/providers'),ai=require('./ai/provider'),store=require('./store');
const app=express(),PORT=Number(process.env.PORT||4000),JWT_SECRET=process.env.JWT_SECRET||'healtrip-development-secret-change-me';
app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));app.use(cors({origin:process.env.CORS_ORIGIN||'*'}));app.use(express.json({limit:'512kb'}));
const hits=new Map();app.use((req,res,next)=>{const k=req.ip,n=Date.now(),w=hits.get(k)||{n:0,t:n};if(n-w.t>60000){w.n=0;w.t=n;}if(++w.n>Number(process.env.RATE_LIMIT_PER_MIN||180))return res.status(429).json({error:'Too many requests.'});hits.set(k,w);next();});
const auth=(req,res,next)=>{const h=req.headers.authorization||'';if(!h.startsWith('Bearer '))return res.status(401).json({error:'Authentication required.'});try{req.user=jwt.verify(h.slice(7),JWT_SECRET);next();}catch{return res.status(401).json({error:'Invalid or expired session.'});}};
const optionalAuth=(req,_res,next)=>{const h=req.headers.authorization||'';if(h.startsWith('Bearer ')){try{req.user=jwt.verify(h.slice(7),JWT_SECRET);}catch{}}next();};
const audit=(event,req,detail={})=>store.audit({event,user_id:req.user?.id||null,session_id:detail.sessionId||null,detail});
app.get('/health',async(_req,res)=>res.json({status:'ok',service:'healtrip-api',version:'2.0.0',ai_mode:ai.MODE,storage:store.kind(),knowledge:{conditions:kb.CONDITIONS.length,questions:kb.QUESTIONS.length,red_flags:kb.RED_FLAGS.length,sources:Object.keys(kb.SOURCES).length},time:new Date().toISOString()}));
app.get('/ready',async(_req,res)=>res.status(store.kind()==='postgres'?200:200).json({ready:true,storage:store.kind(),ai:ai.MODE,production_database:store.kind()==='postgres'}));
app.post('/api/auth/register',async(req,res)=>{const p=z.object({email:z.string().email().max(160),password:z.string().min(10).max(200)}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Valid email and password of at least 10 characters required.'});if(await store.findUser(p.data.email))return res.status(409).json({error:'Account already exists.'});const u=await store.createUser(p.data.email,await bcrypt.hash(p.data.password,12));const token=jwt.sign({id:u.id,email:u.email,role:u.role},JWT_SECRET,{expiresIn:process.env.JWT_EXPIRES||'7d'});await store.upsertProfile(u.id,{preferred_language:'en'});res.status(201).json({token,user:{id:u.id,email:u.email,role:u.role}});});
app.post('/api/auth/login',async(req,res)=>{const p=z.object({email:z.string().email(),password:z.string()}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid credentials.'});const u=await store.findUser(p.data.email);if(!u||!(await bcrypt.compare(p.data.password,u.password_hash||u.passwordHash)))return res.status(401).json({error:'Invalid credentials.'});const token=jwt.sign({id:u.id,email:u.email,role:u.role},JWT_SECRET,{expiresIn:process.env.JWT_EXPIRES||'7d'});res.json({token,user:{id:u.id,email:u.email,role:u.role}});});
app.get('/api/me',auth,async(req,res)=>res.json({user:req.user,profile:await store.getProfile(req.user.id)}));
app.get('/api/profile',auth,async(req,res)=>res.json({profile:await store.getProfile(req.user.id),records:await store.listRecords(req.user.id)}));
app.put('/api/profile',auth,async(req,res)=>{const p=z.object({full_name:z.string().max(160).optional(),date_of_birth:z.string().optional(),sex:z.string().max(40).optional(),country:z.string().max(100).optional(),city:z.string().max(100).optional(),preferred_language:z.enum(['en','ar']).optional(),phone:z.string().max(40).optional(),emergency_contact:z.record(z.string()).optional()}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid profile data.'});const profile=await store.upsertProfile(req.user.id,p.data);await audit('profile.update',req,{});res.json({profile});});
app.post('/api/profile/records',auth,async(req,res)=>{const p=z.object({record_type:z.enum(['medical_history','condition','medication','allergy','prescription','lab_result','note']),title:z.string().max(200).optional(),content:z.record(z.any()),verified:z.boolean().default(false)}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid record.'});const r=await store.addRecord(req.user.id,p.data.record_type,p.data.title,p.data.content,'patient',p.data.verified);res.status(201).json({record:r});});
const upload=multer({dest:process.env.UPLOAD_DIR||'/tmp/healtrip',limits:{fileSize:10*1024*1024},fileFilter:(_r,f,cb)=>cb(null,/^(application\/pdf|image\/(png|jpeg|webp))$/.test(f.mimetype))});
app.post('/api/profile/documents',auth,upload.single('file'),async(req,res)=>{if(!req.file)return res.status(400).json({error:'PDF or image required.'});const r=await store.addRecord(req.user.id,'medical_document',req.file.originalname,{filename:req.file.originalname,mime_type:req.file.mimetype,size_bytes:req.file.size,storage_path:req.file.path,extraction_status:'pending'},'patient',false);await audit('document.upload',req,{recordId:r.id});res.status(201).json({document:r,note:'Uploaded for controlled extraction. No medical fact is treated as verified until confirmed.'});});
const startSchema=z.object({text:z.string().min(2).max(2000),lang:z.enum(['en','ar']).default('en')});
app.post('/api/assessment/start',optionalAuth,async(req,res)=>{const p=startSchema.safeParse(req.body);if(!p.success)return res.status(400).json({error:'Send {text,lang}.'});const id=crypto.randomUUID(),state=engine.ingestText(engine.emptyState(),p.data.text);await store.saveSession(id,state,p.data.lang,req.user?.id||null);await audit('assessment.start',req,{sessionId:id,symptoms:state.symptoms,flags:state.redFlags.map(f=>f.id)});res.json(await turnPayload(id,state,p.data.lang));});
app.post('/api/assessment/reply',optionalAuth,async(req,res)=>{const p=z.object({sessionId:z.string().uuid(),questionId:z.string().optional(),value:z.string().optional(),text:z.string().max(2000).optional(),lang:z.enum(['en','ar']).default('en')}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid reply.'});let state=await store.getSession(p.data.sessionId);if(!state)return res.status(404).json({error:'Assessment not found.'});if(p.data.questionId&&p.data.value)state=engine.applyAnswer(state,p.data.questionId,p.data.value);if(p.data.text)state=engine.ingestText(state,p.data.text);await store.saveSession(p.data.sessionId,state,p.data.lang,req.user?.id||null);await audit('assessment.reply',req,{sessionId:p.data.sessionId});res.json(await turnPayload(p.data.sessionId,state,p.data.lang));});
async function turnPayload(id,state,lang){const ar=lang==='ar',em=state.redFlags.filter(f=>f.level==='emergency'),sup=state.redFlags.filter(f=>f.level==='support');
const understood={symptoms:state.symptoms.map(s=>({id:s,label:ar?kb.SYMPTOMS[s].ar:kb.SYMPTOMS[s].en})),answered:state.answers.map(a=>({field:a.field,value:ar?a.label_ar:a.label_en})),stillUnknown:state.unknowns||[]};

if(sup.length)return {sessionId:id,type:'support',urgency:'support',understood,message:require('./i18n').t(lang,'safety.support')};
if(em.length)return {sessionId:id,type:'emergency',urgency:'emergency',understood,redFlags:em.map(f=>({id:f.id,text:ar?f.ar:f.en,source:kb.SOURCES[f.source]||null})),message:engine.carePathway(state,{verified:[]},lang).advice};const differential=engine.buildDifferential(state,lang);const pathway=engine.carePathway(state,differential,lang);// Nothing clinical has been recognised yet. Greet, invite, or ask openly, and
// never put a clinical question in front of someone who said hello.
if(!state.symptoms.length && !state.answers.length){
  const conversation=require('./clinical/conversation');
  const lastSaid=(state.narrative||[]).slice(-1)[0]||'';
  const kind=conversation.classify(lastSaid,false);
  return {sessionId:id,type:'clarify',urgency:'routine',understood,intent:kind,
    message:conversation.reply(kind,lang),examples:conversation.examples(lang)};
}

const next=engine.nextQuestion(state);if(next&&state.answers.length<Number(process.env.MAX_QUESTIONS||8)){const q=next.question;const phrased=await ai.phrase({kind:'question',question:ar?q.ar:q.en,why:ar?q.why_ar:q.why_en,differential:differential.verified},lang);return {sessionId:id,type:'question',urgency:pathway.level,understood,progress:{answered:state.answers.length,target:Number(process.env.MAX_QUESTIONS||8)},question:{id:q.id,text:ar?q.ar:q.en,why:ar?q.why_ar:q.why_en,informationGain:next.gain,options:q.options.map(o=>({value:o.v,label:ar?o.ar:o.en}))},shortlist:differential.verified.slice(0,3).map(d=>({name:d.name,compatibility:d.compatibility})),ai:{provider:phrased.provider,verified:phrased.verified}};}const summary=engine.summarise(state,lang),phrased=await ai.phrase({kind:'summary',differential:summary.differential,advice:summary.advice},lang);return {sessionId:id,type:'summary',urgency:summary.urgency,understood,summary,message:phrased.text,ai:{provider:phrased.provider,verified:phrased.verified}};}
app.get('/api/assessment/:id/summary',async(req,res)=>{const s=await store.getSession(req.params.id);if(!s)return res.status(404).json({error:'Assessment not found.'});res.json(engine.summarise(s,req.query.lang==='ar'?'ar':'en'));});
app.get('/api/assessment/:id/fhir',async(req,res)=>{const s=await store.getSession(req.params.id);if(!s)return res.status(404).json({error:'Assessment not found.'});res.json(engine.toFhirBundle(s,engine.summarise(s,'en'),req.params.id.slice(0,8)));});
app.delete('/api/assessment/:id',auth,async(req,res)=>{await store.deleteSession(req.params.id);await audit('assessment.delete',req,{sessionId:req.params.id});res.json({deleted:true});});
app.get('/api/doctors',async(req,res)=>{const d=await store.searchDoctors({specialty:req.query.specialty,country:req.query.country,city:req.query.city,language:req.query.language,telemedicine:req.query.telemedicine==='true'});res.json({count:d.length,source_note:'Only records imported from an authorized provider source may receive verified status.',doctors:d});});
app.get('/api/doctors/:id/license',async(req,res)=>{const r=providers.verifyLicense(req.params.id);if(!r.found)return res.status(404).json({error:'No provider record.'});res.json(r);});
app.get('/api/hospitals',async(req,res)=>res.json({count:(await store.searchHospitals({specialty:req.query.specialty,country:req.query.country,city:req.query.city,emergency:req.query.emergency==='true'})).length,hospitals:await store.searchHospitals({specialty:req.query.specialty,country:req.query.country,city:req.query.city,emergency:req.query.emergency==='true'})}));
app.get('/api/provider-sources',(_req,res)=>res.json({sources:[{authority:'GMC',country:'United Kingdom',register_url:'https://www.gmc-uk.org/registration-and-licensing/our-registers',status:'manual-import-until-authorized-feed'},{authority:'SCFHS',country:'Saudi Arabia',register_url:'https://scfhs.org.sa/en/E-Services/regvaliddescription',status:'manual-import-until-authorized-feed'}]}));
app.get('/api/evidence',(_req,res)=>res.json({sources:Object.values(kb.SOURCES)}));
app.get('/api/knowledge/conditions',(_req,res)=>res.json({count:kb.CONDITIONS.length,conditions:kb.CONDITIONS.map(c=>({id:c.id,en:c.en,ar:c.ar,specialty:c.specialty,urgency:c.urgency,sources:c.sources}))}));
app.get('/api/knowledge/red-flags',(_req,res)=>res.json({count:kb.RED_FLAGS.length,rules:kb.RED_FLAGS.map(({id,level,en,ar,source})=>({id,level,en,ar,source}))}));
app.post('/api/chat/conversations',auth,async(req,res)=>{const c=await store.createConversation(req.user.id,req.body.title||'HealTrip AI');res.status(201).json({conversation:c});});
app.get('/api/chat/conversations',auth,async(req,res)=>res.json({conversations:await store.listConversations(req.user.id)}));
app.get('/api/chat/conversations/:id',auth,async(req,res)=>res.json({messages:await store.getMessages(req.params.id)}));
app.post('/api/chat/conversations/:id/messages',auth,async(req,res)=>{const p=z.object({message:z.string().min(1).max(4000),lang:z.enum(['en','ar']).default('en')}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Message required.'});const history=await store.getMessages(req.params.id),profile=await store.getProfile(req.user.id);await store.addMessage(req.params.id,'user',p.data.message);const out=await ai.chat({history,message:p.data.message,profile,lang:p.data.lang});const saved=await store.addMessage(req.params.id,'assistant',out.text,out.provider,out.verified);res.json({message:saved,ai:out});});
app.get('/api/readiness',async(_req,res)=>res.json(await require('./readiness').evaluate(store.kind(),ai.MODE)));
app.get('/api/evaluation',async(_req,res)=>res.json(await require('./evaluation').run()));
/**
 * Serve the interface from the API itself.
 *
 * One process, one port, one URL. Running the site on a second port is the
 * single most common way to end up with a page that loads and no data behind
 * it, because every request then has to cross an origin. In Docker nginx still
 * serves the files and proxies /api, which is the same arrangement.
 */
const FRONTEND = require('path').resolve(__dirname, '..', '..', 'frontend');
if (require('fs').existsSync(FRONTEND)) {
  app.use(express.static(FRONTEND, { extensions: ['html'], maxAge: '1h' }));
}

const signToken = (u) => jwt.sign({ id: u.id, email: u.email, role: u.role }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });
app.use('/api/v1', require('./api/v1').build({ auth, optionalAuth, audit, turnPayload, signToken }));
app.get('/api/v1', (_req, res) => res.redirect('/api/v1/openapi.json'));

app.use((_req,res)=>res.status(404).json({error:'No such endpoint.'}));

/**
 * Last-resort error handler. The person gets a generic message; the detail goes
 * to the server log and the audit table. A stack trace, a SQL string, a
 * credential or any patient content must never reach the response body.
 */
app.use((err, req, res, _next) => {
  const ref = crypto.randomUUID().slice(0, 8);
  console.error(`[${ref}] ${req.method} ${req.path}`, err && err.stack ? err.stack : err);
  store.audit({ event: 'error.unhandled', user_id: req.user?.id || null, session_id: null,
    detail: { ref, path: req.path, method: req.method, name: err?.name || 'Error' } }).catch(() => {});
  const lang = req.lang === 'ar' ? 'ar' : 'en';
  res.status(err?.status && err.status < 500 ? err.status : 500).json({
    locale: lang,
    direction: lang === 'ar' ? 'rtl' : 'ltr',
    error: require('./i18n').t(lang, 'errors.serverError'),
    error_key: 'errors.serverError',
    reference: ref,
  });
});
/**
 * Refuse to start in production with development defaults. A prototype that
 * silently ships a known JWT secret is worse than one that will not boot.
 */
function checkProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  const problems = [];
  if (!process.env.JWT_SECRET) problems.push('JWT_SECRET is not set');
  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') problems.push('CORS_ORIGIN is unset or wide open');
  if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is not set, so storage would be in-memory');
  if (problems.length) {
    console.error('Refusing to start in production:\n  - ' + problems.join('\n  - '));
    process.exit(1);
  }
}
checkProductionConfig();

store.init().then(()=>app.listen(PORT,()=>console.log(`HealTrip API :${PORT} storage=${store.kind()} ai=${ai.MODE}`)));
module.exports=app;
