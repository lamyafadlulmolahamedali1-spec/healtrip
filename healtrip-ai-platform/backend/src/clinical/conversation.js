'use strict';

/**
 * Conversational intake.
 *
 * A person who types "hi" is saying hello, not reporting a symptom, and must
 * never be answered with "when did this start?". This module classifies the
 * opening of a turn before the clinical engine is allowed anywhere near it.
 *
 *   greeting      -> greet back and invite them to describe what they feel
 *   thanks / bye  -> acknowledge
 *   question      -> answer it, or route it to the right surface
 *   unclear       -> ask openly, with examples, and never a clinical question
 *   symptom       -> hand over to the assessment engine
 *
 * Nothing here decides anything clinical. It only decides whether the clinical
 * engine should run at all.
 */

const normalise = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const GREETINGS = [
  'hi', 'hii', 'hello', 'hey', 'hiya', 'good morning', 'good afternoon', 'good evening',
  'yo', 'greetings', 'salam', 'salaam', 'asalamu alaikum', 'assalamu alaikum',
  'مرحبا', 'مرحبتين', 'اهلا', 'اهلين', 'سلام', 'السلام عليكم', 'صباح الخير', 'مساء الخير', 'هاي',
];

const THANKS = ['thanks', 'thank you', 'thx', 'appreciate it', 'شكرا', 'شكرًا', 'مشكور', 'الله يعطيك العافيه'];
const FAREWELL = ['bye', 'goodbye', 'see you', 'that is all', "that's all", 'مع السلامه', 'الى اللقاء', 'خلاص'];
const CAPABILITY = [
  'what can you do', 'who are you', 'what is this', 'how does this work', 'how do you work', 'what do you do',
  'ماذا تفعل', 'من انت', 'ما هذا', 'كيف يعمل', 'كيف تعمل', 'شنو تعمل',
];
const PREP_QUESTION = [
  'how do i prepare', 'what should i bring', 'prepare for my appointment', 'before my visit',
  'كيف استعد', 'ماذا احضر', 'قبل الزياره', 'قبل الموعد',
];

const isOneOf = (text, list) => {
  const t = normalise(text);
  return list.some((phrase) => t === normalise(phrase) || t.startsWith(`${normalise(phrase)} `) || t === `${normalise(phrase)}`);
};

const contains = (text, list) => {
  const t = normalise(text);
  return list.some((phrase) => t.includes(normalise(phrase)));
};

/**
 * Classifies a turn. `hasSymptoms` comes from the engine's extraction, so a
 * message that mentions something clinical always wins over small talk.
 */
function classify(message, hasSymptoms) {
  const t = normalise(message);
  const words = t ? t.split(' ').length : 0;

  if (hasSymptoms) return 'symptom';
  if (!t) return 'unclear';
  if (isOneOf(message, GREETINGS) || (words <= 3 && contains(message, GREETINGS))) return 'greeting';
  if (contains(message, THANKS) && words <= 6) return 'thanks';
  if (contains(message, FAREWELL) && words <= 5) return 'farewell';
  if (contains(message, CAPABILITY)) return 'capability';
  if (contains(message, PREP_QUESTION)) return 'preparation';
  if (words <= 2) return 'unclear';
  return 'narrative'; // longer text with nothing recognised: ask for more, openly
}

const COPY = {
  greeting: {
    en: "Hello. I'm here to help you understand what you're experiencing and work out a sensible next step.\n\nWhenever you're ready, tell me what's been going on, in your own words. For example: \"I've had a headache for three days, mostly in the morning.\"",
    ar: 'أهلًا بك. أنا هنا لمساعدتك على فهم ما تشعرين به وتحديد خطوة تالية مناسبة.\n\nوقتما كنتِ مستعدة، احكي لي ما الذي يحدث معك بكلماتك. مثال: «عندي صداع منذ ثلاثة أيام، غالبًا في الصباح».',
  },
  thanks: {
    en: "You're welcome. If anything else comes up, or if something changes, you can tell me about it here.",
    ar: 'على الرحب والسعة. وإذا استجدّ شيء أو تغيّر شيء، يمكنك إخباري هنا.',
  },
  farewell: {
    en: 'Take care. Your summary stays here if you want to come back to it.',
    ar: 'اعتني بنفسك. ويبقى ملخصك هنا إن أردتِ العودة إليه.',
  },
  capability: {
    en: "I can help in four ways. I can listen to what you're experiencing and ask the follow-up questions that matter. I can explain what may be relevant, and what would help tell the possibilities apart. I can tell you what a healthcare professional may consider next and how to prepare for the visit. And I can help you find the right kind of clinician.\n\nI don't diagnose and I don't prescribe. Tell me what's been going on and we'll start there.",
    ar: 'أستطيع مساعدتك في أربعة أمور. أن أستمع لما تشعرين به وأطرح أسئلة المتابعة المهمة. وأن أوضح ما قد يكون ذا صلة، وما الذي يساعد على التفريق بين الاحتمالات. وأن أخبرك بما قد يفكر الطبيب في تقييمه لاحقًا وكيف تستعدين للزيارة. وأن أساعدك في الوصول إلى التخصص المناسب.\n\nأنا لا أشخّص ولا أصف علاجًا. احكي لي ما يحدث معك ولنبدأ من هناك.',
  },
  preparation: {
    en: 'Bring your previous reports and test results, a list of the medicines you take, and any allergies. Note when the symptoms started and what makes them better or worse, and write down the questions you want to ask.\n\nIf you tell me what you have been experiencing, I can also explain what a clinician may want to look at, so you know what to expect.',
    ar: 'أحضري تقاريرك ونتائج تحاليلك السابقة، وقائمة بالأدوية التي تتناولينها، وأي حساسية لديك. ودوّني متى بدأت الأعراض وما الذي يزيدها أو يخففها، واكتبي الأسئلة التي تودين طرحها.\n\nوإذا أخبرتني بما تشعرين به، أستطيع أيضًا أن أوضح ما قد يرغب الطبيب في النظر فيه، لتعرفي ما تتوقعين.',
  },
  unclear: {
    en: "I didn't quite catch that. Tell me what you've been feeling and roughly when it started, in your own words, and I'll take it from there.\n\nFor example: \"my stomach has been hurting since yesterday\" or \"I get dizzy when I stand up\".",
    ar: 'لم أفهم ذلك تمامًا. احكي لي ما الذي تشعرين به ومتى بدأ تقريبًا، بكلماتك، وسأكمل من هناك.\n\nمثال: «بطني توجعني من أمس» أو «أشعر بدوخة عندما أقف».',
  },
  narrative: {
    en: "Thank you for telling me. I haven't picked out a specific symptom yet, so help me a little more: what are you actually feeling, where is it, and when did it start?",
    ar: 'شكرًا لإخباري. لم أتبيّن عرضًا محددًا بعد، فساعديني قليلًا: ما الذي تشعرين به بالضبط، وأين، ومتى بدأ؟',
  },
};

const EXAMPLES = {
  en: ['A headache since yesterday', 'Stomach pain after eating', 'A cough and a fever', 'Dizzy when I stand up'],
  ar: ['صداع منذ أمس', 'ألم في البطن بعد الأكل', 'سعال وحمى', 'دوخة عند الوقوف'],
};

function reply(kind, lang = 'en') {
  const copy = COPY[kind] || COPY.unclear;
  return lang === 'ar' ? copy.ar : copy.en;
}

const examples = (lang = 'en') => (lang === 'ar' ? EXAMPLES.ar : EXAMPLES.en);

module.exports = { classify, reply, examples, normalise };
