'use strict';

/**
 * Possible clinical evaluations.
 *
 * What a clinician MAY consider, the clinical question each evaluation helps
 * answer, and what a person can practically prepare. Three rules govern this
 * file and the engine that reads it:
 *
 *   1. Nothing here is an order. Every entry is phrased as something a clinician
 *      may consider after history and examination, never as a test the person
 *      needs or as proof that a condition is present.
 *   2. An entry only reaches a person when one of its associated candidates is
 *      in the verified differential AND it carries a registered evidence source.
 *      The language model cannot add an evaluation, a preparation instruction or
 *      a cost.
 *   3. Preparation is written only where it is safe and generic. No fasting, no
 *      stopping or changing a medicine, no procedure instructions. Anything that
 *      depends on the individual is deferred to the clinic.
 *
 * Costs are never estimated. `practical` explains that cost and availability
 * vary and that the clinic is the place to ask.
 */

const ASK_CLINIC = {
  en: 'The clinic will tell you whether any preparation is needed for your situation.',
  ar: 'ستخبرك العيادة بما إذا كان هناك أي تحضير مطلوب في حالتك.',
};

const COST_NOTE = {
  en: 'Availability and cost vary by country, facility and insurance. Ask the clinic about preparation, coverage and cost before going ahead.',
  ar: 'يختلف التوفر والتكلفة حسب البلد والمنشأة والتأمين. اسألي العيادة عن التحضير والتغطية والتكلفة قبل المضي قدمًا.',
};

const EVALUATIONS = [
  {
    id: 'ecg',
    type: 'bedside test',
    name: { en: 'Electrical tracing of the heart (ECG)', ar: 'تخطيط كهربية القلب' },
    why: {
      en: 'Chest symptoms that may involve the heart are usually assessed with an electrical tracing first, because it is quick and available at the bedside.',
      ar: 'تُقيَّم أعراض الصدر التي قد تتعلق بالقلب عادة بتخطيط كهربائي أولًا، لأنه سريع ومتاح عند السرير.',
    },
    clinical_question: {
      en: 'May help evaluate whether the heart muscle is under strain at the time of the recording.',
      ar: 'قد يساعد في تقييم ما إذا كانت عضلة القلب تحت إجهاد وقت التسجيل.',
    },
    expect: {
      en: 'Small stickers are placed on the chest, arms and legs for a few minutes. It records only; nothing is passed into the body.',
      ar: 'تُوضع لواصق صغيرة على الصدر والذراعين والساقين لبضع دقائق. وهو يسجّل فقط ولا يُمرَّر شيء إلى الجسم.',
    },
    preparation: null,
    candidates: ['acs', 'anxiety_panic', 'venous_thrombosis'],
    safety_relevant: true,
    sources: ['nice_chest_pain'],
  },
  {
    id: 'cardiac_bloods',
    type: 'laboratory',
    name: { en: 'Blood test for cardiac markers', ar: 'تحليل دم لمؤشرات القلب' },
    why: {
      en: 'Blood markers change when heart muscle is injured, so a clinician may use them alongside the tracing and the history.',
      ar: 'تتغير مؤشرات الدم عند إصابة عضلة القلب، وقد يستخدمها الطبيب إلى جانب التخطيط والتاريخ المرضي.',
    },
    clinical_question: {
      en: 'May help distinguish a cardiac cause of chest discomfort from a chest wall or digestive cause.',
      ar: 'قد يساعد في التفريق بين سبب قلبي لانزعاج الصدر وسبب في جدار الصدر أو في الجهاز الهضمي.',
    },
    expect: { en: 'A blood sample, sometimes repeated a few hours later.', ar: 'عينة دم، وقد تُعاد بعد بضع ساعات.' },
    preparation: null,
    candidates: ['acs', 'musculoskeletal_chest', 'reflux'],
    safety_relevant: true,
    sources: ['nice_chest_pain'],
  },
  {
    id: 'chest_xray',
    type: 'imaging',
    name: { en: 'Chest X-ray', ar: 'أشعة سينية للصدر' },
    why: {
      en: 'Cough, fever and breathlessness together sometimes lead a clinician to look at the lungs.',
      ar: 'قد يدفع اجتماع السعال والحمى وضيق النفس الطبيب إلى النظر في الرئتين.',
    },
    clinical_question: {
      en: 'May help evaluate whether there is a change in the lungs that would explain the breathing symptoms.',
      ar: 'قد يساعد في تقييم وجود تغير في الرئتين يفسر أعراض التنفس.',
    },
    expect: { en: 'A brief X-ray, usually standing, taking a few seconds.', ar: 'صورة أشعة قصيرة، غالبًا في وضع الوقوف، تستغرق ثوانٍ.' },
    preparation: {
      en: 'Tell the team if you are pregnant or might be, before any X-ray.',
      ar: 'أخبري الفريق الطبي إن كنتِ حاملًا أو يُحتمل ذلك، قبل أي أشعة.',
    },
    candidates: ['lower_resp_infection', 'asthma_flare', 'acs'],
    safety_relevant: true,
    sources: ['nhs_conditions', 'nice_sepsis'],
  },
  {
    id: 'oxygen_saturation',
    type: 'bedside test',
    name: { en: 'Oxygen level and breathing rate', ar: 'قياس الأكسجين ومعدل التنفس' },
    why: {
      en: 'How much oxygen is in the blood, and how fast someone is breathing, changes how urgently a breathing problem is treated.',
      ar: 'مستوى الأكسجين في الدم وسرعة التنفس يغيران مدى إلحاح التعامل مع مشكلة التنفس.',
    },
    clinical_question: {
      en: 'May help evaluate how well the lungs are moving oxygen right now.',
      ar: 'قد يساعد في تقييم كفاءة الرئتين في نقل الأكسجين في الوقت الحالي.',
    },
    expect: { en: 'A clip on a fingertip for a few seconds.', ar: 'مشبك على طرف الإصبع لبضع ثوانٍ.' },
    preparation: { en: 'Remove nail polish from one finger if you can.', ar: 'أزيلي طلاء الأظافر عن إصبع واحد إن أمكن.' },
    candidates: ['lower_resp_infection', 'asthma_flare', 'venous_thrombosis', 'acs'],
    safety_relevant: true,
    sources: ['nice_sepsis'],
  },
  {
    id: 'peak_flow',
    type: 'bedside test',
    name: { en: 'Peak flow or breathing test', ar: 'قياس ذروة الجريان أو وظائف التنفس' },
    why: {
      en: 'Measuring how hard air can be blown out gives a clinician a number to compare over time.',
      ar: 'قياس قوة إخراج الهواء يعطي الطبيب رقمًا يمكن مقارنته عبر الوقت.',
    },
    clinical_question: {
      en: 'May help evaluate whether the airways are narrowed, and by how much.',
      ar: 'قد يساعد في تقييم وجود ضيق في المجاري الهوائية ومقداره.',
    },
    expect: { en: 'Blowing hard into a small tube two or three times.', ar: 'النفخ بقوة في أنبوب صغير مرتين أو ثلاثًا.' },
    preparation: null,
    candidates: ['asthma_flare', 'lower_resp_infection'],
    safety_relevant: false,
    sources: ['nhs_conditions'],
  },
  {
    id: 'full_blood_count',
    type: 'laboratory',
    name: { en: 'Full blood count', ar: 'صورة دم كاملة' },
    why: {
      en: 'Tiredness lasting weeks, or a fever without an obvious source, is commonly assessed with a simple blood count first.',
      ar: 'التعب المستمر لأسابيع أو الحمى دون سبب واضح يُقيَّمان عادة بصورة دم بسيطة أولًا.',
    },
    clinical_question: {
      en: 'May help evaluate anaemia or a blood picture that suggests infection.',
      ar: 'قد تساعد في تقييم فقر الدم أو صورة دم توحي بوجود عدوى.',
    },
    expect: { en: 'One blood sample from the arm.', ar: 'عينة دم واحدة من الذراع.' },
    preparation: null,
    candidates: ['anaemia_fatigue', 'febrile_illness', 'lower_resp_infection', 'cellulitis', 'appendicitis'],
    safety_relevant: false,
    sources: ['medlineplus'],
  },
  {
    id: 'iron_thyroid',
    type: 'laboratory',
    name: { en: 'Iron studies and thyroid function', ar: 'تحاليل الحديد ووظائف الغدة الدرقية' },
    why: {
      en: 'When tiredness persists, a clinician often looks at iron stores and thyroid activity because both are common and treatable.',
      ar: 'عند استمرار التعب ينظر الطبيب غالبًا في مخزون الحديد ونشاط الغدة الدرقية لأنهما شائعان وقابلان للعلاج.',
    },
    clinical_question: {
      en: 'May help distinguish iron deficiency from a thyroid cause of the same symptoms.',
      ar: 'قد تساعد في التفريق بين نقص الحديد وسبب درقي لنفس الأعراض.',
    },
    expect: { en: 'Usually taken from the same blood sample as the blood count.', ar: 'تؤخذ عادة من نفس عينة الدم المستخدمة لصورة الدم.' },
    preparation: null,
    candidates: ['anaemia_fatigue', 'thyroid'],
    safety_relevant: false,
    sources: ['medlineplus'],
  },
  {
    id: 'blood_glucose',
    type: 'laboratory',
    name: { en: 'Blood sugar and HbA1c', ar: 'سكر الدم والسكر التراكمي' },
    why: {
      en: 'Thirst, passing urine often and weight loss together are the pattern that leads a clinician to check blood sugar.',
      ar: 'العطش وكثرة التبول وفقدان الوزن معًا هي النمط الذي يدفع الطبيب لفحص سكر الدم.',
    },
    clinical_question: {
      en: 'May help evaluate whether blood sugar is raised, and how it has been over recent months.',
      ar: 'قد يساعد في تقييم ارتفاع سكر الدم وكيف كان خلال الأشهر الماضية.',
    },
    expect: { en: 'A finger-prick reading, a blood sample, or both.', ar: 'قراءة بوخز الإصبع أو عينة دم أو كلاهما.' },
    preparation: {
      en: 'Ask the clinic whether the sample should be taken at a particular time of day. Do not change how you eat or take any medicine on your own before a test.',
      ar: 'اسألي العيادة إن كان يجب أخذ العينة في وقت معين من اليوم. ولا تغيّري طعامك أو أدويتك من تلقاء نفسك قبل أي فحص.',
    },
    candidates: ['hyperglycaemia'],
    safety_relevant: true,
    sources: ['medlineplus'],
  },
  {
    id: 'urine_dipstick',
    type: 'laboratory',
    name: { en: 'Urine test and culture', ar: 'تحليل وزراعة بول' },
    why: {
      en: 'Burning on passing urine, or pain that may come from the kidney, is usually assessed with a urine sample.',
      ar: 'الحرقان أثناء التبول أو ألم قد يأتي من الكلية يُقيَّم عادة بعينة بول.',
    },
    clinical_question: {
      en: 'May help distinguish a urinary infection from a stone or another cause of the same pain.',
      ar: 'قد يساعد في التفريق بين التهاب المسالك والحصوة أو سبب آخر لنفس الألم.',
    },
    expect: { en: 'A urine sample in a clean container; a result strip is often read immediately.', ar: 'عينة بول في وعاء نظيف، وغالبًا تُقرأ شريحة النتيجة فورًا.' },
    preparation: {
      en: 'If you can, keep a urine sample rather than emptying your bladder just before the appointment.',
      ar: 'إن أمكن، احتفظي بعينة بول بدل إفراغ المثانة قبل الموعد مباشرة.',
    },
    candidates: ['uti', 'renal_colic'],
    safety_relevant: false,
    sources: ['nhs_conditions'],
  },
  {
    id: 'abdominal_ultrasound',
    type: 'imaging',
    name: { en: 'Abdominal ultrasound', ar: 'موجات صوتية للبطن' },
    why: {
      en: 'Pain under the right ribs after fatty food often leads a clinician to look at the gallbladder.',
      ar: 'الألم تحت الأضلاع اليمنى بعد الطعام الدسم يدفع الطبيب غالبًا للنظر في المرارة.',
    },
    clinical_question: {
      en: 'May help evaluate the gallbladder, the liver and the kidneys without radiation.',
      ar: 'قد تساعد في تقييم المرارة والكبد والكلى دون إشعاع.',
    },
    expect: { en: 'Gel on the skin and a probe moved across the abdomen. It is painless.', ar: 'جل على الجلد ومسبار يُمرَّر على البطن. وهي غير مؤلمة.' },
    preparation: { ...ASK_CLINIC },
    candidates: ['biliary_colic', 'appendicitis', 'renal_colic'],
    safety_relevant: false,
    sources: ['nhs_conditions'],
  },
  {
    id: 'surgical_review',
    type: 'clinical examination',
    name: { en: 'Assessment by a surgical team', ar: 'تقييم من فريق جراحي' },
    why: {
      en: 'Abdominal pain that moves and becomes constant is assessed in person without delay, because the examination itself carries most of the information.',
      ar: 'ألم البطن الذي ينتقل ويصبح مستمرًا يُقيَّم شخصيًا دون تأخير، لأن الفحص نفسه يحمل معظم المعلومات.',
    },
    clinical_question: {
      en: 'May help evaluate whether an urgent surgical cause is present.',
      ar: 'قد يساعد في تقييم وجود سبب جراحي عاجل.',
    },
    expect: { en: 'Examination of the abdomen, usually with blood tests and sometimes imaging.', ar: 'فحص للبطن، عادة مع تحاليل دم وأحيانًا تصوير.' },
    preparation: {
      en: 'Do not eat or drink on the way in until the team has assessed you, in case a procedure is needed.',
      ar: 'تجنبي الأكل والشرب في الطريق حتى يقيّمك الفريق، تحسبًا للحاجة إلى إجراء.',
    },
    candidates: ['appendicitis', 'testicular_or_ectopic_pain', 'biliary_colic'],
    safety_relevant: true,
    sources: ['nhs_conditions'],
  },
  {
    id: 'leg_ultrasound',
    type: 'imaging',
    name: { en: 'Ultrasound of the leg veins', ar: 'موجات صوتية لأوردة الساق' },
    why: {
      en: 'Swelling and pain in one calf, particularly after immobility, is assessed for a clot because a clot can travel to the lung.',
      ar: 'تورم وألم في ساق واحدة، خاصة بعد قلة الحركة، يُقيَّم بحثًا عن جلطة لأنها قد تنتقل إلى الرئة.',
    },
    clinical_question: {
      en: 'May help evaluate whether blood is flowing normally through the deep veins of the leg.',
      ar: 'قد تساعد في تقييم ما إذا كان الدم يتدفق بشكل طبيعي في الأوردة العميقة للساق.',
    },
    expect: { en: 'A probe pressed gently along the leg for several minutes.', ar: 'مسبار يُضغط برفق على طول الساق لعدة دقائق.' },
    preparation: null,
    candidates: ['venous_thrombosis', 'cellulitis'],
    safety_relevant: true,
    sources: ['nhs_conditions'],
  },
  {
    id: 'ct_urinary',
    type: 'imaging',
    name: { en: 'CT scan of the urinary tract', ar: 'أشعة مقطعية للمسالك البولية' },
    why: {
      en: 'When pain comes in waves from the flank towards the groin, a clinician may want to see whether a stone is present and where.',
      ar: 'عندما يأتي الألم على موجات من الخاصرة نحو المنطقة الأربية، قد يرغب الطبيب في معرفة وجود حصوة وموقعها.',
    },
    clinical_question: {
      en: 'May help evaluate the size and position of a stone, which changes what is done next.',
      ar: 'قد تساعد في تقييم حجم الحصوة وموقعها، وهو ما يغير الخطوة التالية.',
    },
    expect: { en: 'Lying still on a scanner bed for a few minutes.', ar: 'الاستلقاء دون حركة على سرير الجهاز لبضع دقائق.' },
    preparation: {
      en: 'Tell the team if you are pregnant or might be, and if you have had a reaction to contrast dye before.',
      ar: 'أخبري الفريق إن كنتِ حاملًا أو يُحتمل ذلك، وإن سبق أن تفاعلتِ مع صبغة التباين.',
    },
    candidates: ['renal_colic'],
    safety_relevant: false,
    sources: ['nhs_conditions'],
  },
  {
    id: 'h_pylori',
    type: 'laboratory',
    name: { en: 'Test for stomach bacteria (H. pylori)', ar: 'فحص جرثومة المعدة' },
    why: {
      en: 'Burning upper abdominal pain that changes with eating is often assessed for a common stomach bacterium.',
      ar: 'ألم حارق أعلى البطن يتغير مع الأكل يُفحص غالبًا بحثًا عن جرثومة معدة شائعة.',
    },
    clinical_question: {
      en: 'May help evaluate one treatable contributor to ulcer-type pain.',
      ar: 'قد يساعد في تقييم أحد الأسباب القابلة للعلاج لألم يشبه القرحة.',
    },
    expect: { en: 'A breath, stool or blood test, depending on the clinic.', ar: 'فحص نفس أو براز أو دم، حسب العيادة.' },
    preparation: { ...ASK_CLINIC },
    candidates: ['peptic_ulcer', 'reflux'],
    safety_relevant: false,
    sources: ['nhs_conditions'],
  },
  {
    id: 'endoscopy',
    type: 'procedure',
    name: { en: 'Endoscopy of the upper digestive tract', ar: 'منظار للجهاز الهضمي العلوي' },
    why: {
      en: 'A clinician considers looking directly at the stomach lining when warning features are present, not for ordinary reflux.',
      ar: 'ينظر الطبيب في فحص بطانة المعدة مباشرة عند وجود علامات تحذيرية، لا في حالات الارتجاع الاعتيادية.',
    },
    clinical_question: {
      en: 'May help evaluate the lining of the food pipe and stomach directly.',
      ar: 'قد يساعد في تقييم بطانة المريء والمعدة مباشرة.',
    },
    expect: { en: 'A thin flexible camera is passed through the mouth, usually with sedation or a throat spray.', ar: 'كاميرا رفيعة مرنة تمر عبر الفم، عادة مع مهدئ أو بخاخ للحلق.' },
    preparation: {
      en: 'The endoscopy unit gives its own instructions beforehand. Follow those rather than anything general, and tell them about every medicine you take.',
      ar: 'تعطي وحدة المناظير تعليماتها الخاصة مسبقًا. اتبعيها بدل أي تعليمات عامة، وأخبريهم بكل دواء تتناولينه.',
    },
    candidates: ['peptic_ulcer', 'reflux'],
    safety_relevant: false,
    sources: ['nhs_conditions'],
  },
  {
    id: 'stool_test',
    type: 'laboratory',
    name: { en: 'Stool testing', ar: 'تحليل براز' },
    why: {
      en: 'Most short-lived gut infections settle without testing; a clinician considers it when symptoms last, or after travel, or when there is blood.',
      ar: 'معظم التهابات الأمعاء القصيرة تزول دون فحص؛ وينظر فيه الطبيب عند استمرار الأعراض أو بعد السفر أو عند وجود دم.',
    },
    clinical_question: {
      en: 'May help evaluate which organism is involved when that changes the treatment.',
      ar: 'قد يساعد في تحديد الكائن المسبب عندما يغير ذلك العلاج.',
    },
    expect: { en: 'A small sample collected at home in a container from the clinic.', ar: 'عينة صغيرة تُجمع في المنزل في وعاء من العيادة.' },
    preparation: null,
    candidates: ['gastroenteritis', 'febrile_illness'],
    safety_relevant: false,
    sources: ['nhs_conditions'],
  },
  {
    id: 'malaria_test',
    type: 'laboratory',
    name: { en: 'Malaria and febrile illness testing', ar: 'فحص الملاريا والأمراض الحموية' },
    why: {
      en: 'Fever with aching joints after travel, or in an area where malaria or dengue circulate, is tested early because timing matters.',
      ar: 'الحمى مع آلام المفاصل بعد السفر، أو في منطقة تنتشر فيها الملاريا أو حمى الضنك، تُفحص مبكرًا لأن التوقيت مهم.',
    },
    clinical_question: {
      en: 'May help evaluate whether a mosquito-borne infection explains the fever.',
      ar: 'قد يساعد في تقييم ما إذا كانت عدوى منقولة بالبعوض تفسر الحمى.',
    },
    expect: { en: 'A blood sample, sometimes a rapid test read within minutes.', ar: 'عينة دم، وأحيانًا فحص سريع تُقرأ نتيجته خلال دقائق.' },
    preparation: {
      en: 'Bring the dates and places of any recent travel.',
      ar: 'أحضري تواريخ وأماكن أي سفر حديث.',
    },
    candidates: ['febrile_illness'],
    safety_relevant: true,
    sources: ['who_ai_health', 'nhs_conditions'],
  },
  {
    id: 'ear_examination',
    type: 'clinical examination',
    name: { en: 'Examination of the ear drum', ar: 'فحص طبلة الأذن' },
    why: {
      en: 'Ear pain is assessed by looking at the ear drum, which usually settles the question without any test.',
      ar: 'يُقيَّم ألم الأذن بالنظر إلى طبلة الأذن، وهو ما يحسم الأمر عادة دون أي فحص.',
    },
    clinical_question: {
      en: 'May help evaluate whether there is inflammation behind the ear drum.',
      ar: 'قد يساعد في تقييم وجود التهاب خلف طبلة الأذن.',
    },
    expect: { en: 'A lighted instrument held at the ear for a few seconds.', ar: 'أداة مضيئة تُوضع عند الأذن لبضع ثوانٍ.' },
    preparation: null,
    candidates: ['otitis'],
    safety_relevant: false,
    sources: ['nhs_conditions'],
  },
  {
    id: 'eye_examination',
    type: 'clinical examination',
    name: { en: 'Eye examination including vision testing', ar: 'فحص العين مع قياس الإبصار' },
    why: {
      en: 'A red eye with normal vision is usually a surface problem, so measuring vision is the step that separates the two.',
      ar: 'العين الحمراء مع رؤية طبيعية تكون عادة مشكلة سطحية، لذا فإن قياس الإبصار هو ما يفصل بين الحالتين.',
    },
    clinical_question: {
      en: 'May help distinguish a surface irritation from a problem inside the eye.',
      ar: 'قد يساعد في التفريق بين تهيج سطحي ومشكلة داخل العين.',
    },
    expect: { en: 'Reading a chart, then examination with a light.', ar: 'قراءة لوحة إبصار ثم فحص بالضوء.' },
    preparation: {
      en: 'Bring your glasses or lenses, and mention if you wear contact lenses.',
      ar: 'أحضري نظارتك أو عدساتك، واذكري إن كنتِ تستخدمين عدسات لاصقة.',
    },
    candidates: ['conjunctivitis'],
    safety_relevant: true,
    sources: ['nhs_conditions'],
  },
  {
    id: 'positional_testing',
    type: 'clinical examination',
    name: { en: 'Positional testing for vertigo', ar: 'اختبار وضعي للدوار' },
    why: {
      en: 'Moving the head in a specific way reproduces inner-ear vertigo, which is how a clinician tells it apart from other causes.',
      ar: 'تحريك الرأس بطريقة معينة يعيد دوار الأذن الداخلية، وهو ما يميزه الطبيب به عن الأسباب الأخرى.',
    },
    clinical_question: {
      en: 'May help distinguish an inner-ear cause from a blood pressure or neurological cause.',
      ar: 'قد يساعد في التفريق بين سبب من الأذن الداخلية وسبب متعلق بالضغط أو بالجهاز العصبي.',
    },
    expect: { en: 'Lying back and turning the head under supervision; it can briefly bring on the spinning.', ar: 'الاستلقاء وإدارة الرأس تحت إشراف، وقد يثير الدوران لفترة قصيرة.' },
    preparation: {
      en: 'Bring someone with you if the spinning makes travelling difficult.',
      ar: 'اصطحبي شخصًا معك إذا كان الدوران يصعّب التنقل.',
    },
    candidates: ['bppv_vertigo', 'dehydration'],
    safety_relevant: false,
    sources: ['nhs_conditions'],
  },
  {
    id: 'blood_pressure_lying_standing',
    type: 'bedside test',
    name: { en: 'Blood pressure lying and standing', ar: 'قياس الضغط أثناء الاستلقاء والوقوف' },
    why: {
      en: 'Light-headedness on standing is assessed by measuring the pressure in both positions, which takes a few minutes.',
      ar: 'تُقيَّم الدوخة عند الوقوف بقياس الضغط في الوضعين، ويستغرق ذلك دقائق قليلة.',
    },
    clinical_question: {
      en: 'May help evaluate whether blood pressure drops on standing.',
      ar: 'قد يساعد في تقييم انخفاض الضغط عند الوقوف.',
    },
    expect: { en: 'A cuff on the arm, read twice with a short wait between.', ar: 'حزام على الذراع، يُقرأ مرتين مع انتظار قصير بينهما.' },
    preparation: null,
    candidates: ['dehydration', 'anaemia_fatigue'],
    safety_relevant: false,
    sources: ['medlineplus'],
  },
  {
    id: 'headache_review',
    type: 'clinical examination',
    name: { en: 'Headache history and neurological examination', ar: 'تاريخ الصداع والفحص العصبي' },
    why: {
      en: 'Most headaches are diagnosed from the pattern and the examination. Imaging is considered only when warning features are present.',
      ar: 'تُشخَّص معظم أنواع الصداع من النمط والفحص. ولا يُنظر في التصوير إلا عند وجود علامات تحذيرية.',
    },
    clinical_question: {
      en: 'May help distinguish migraine from tension-type headache and identify anything that needs further assessment.',
      ar: 'قد يساعد في التفريق بين الشقيقة والصداع التوتري وتحديد ما يستدعي تقييمًا إضافيًا.',
    },
    expect: { en: 'Questions about the pattern, then a short examination of vision, strength and balance.', ar: 'أسئلة عن النمط ثم فحص قصير للرؤية والقوة والتوازن.' },
    preparation: {
      en: 'Note when the attacks happen, how long they last and what you took for them.',
      ar: 'دوّني متى تحدث النوبات وكم تستمر وما الذي تناولتِه لها.',
    },
    candidates: ['migraine', 'tension_headache', 'sinusitis'],
    safety_relevant: false,
    sources: ['nice_headache'],
  },
  {
    id: 'skin_review',
    type: 'clinical examination',
    name: { en: 'Skin examination', ar: 'فحص الجلد' },
    why: {
      en: 'A rash is usually assessed by looking at it, including whether the edge is spreading and whether it fades under pressure.',
      ar: 'يُقيَّم الطفح عادة بالنظر إليه، بما في ذلك اتساع الحافة وما إذا كان يبهت تحت الضغط.',
    },
    clinical_question: {
      en: 'May help distinguish an allergic reaction from a spreading skin infection.',
      ar: 'قد يساعد في التفريق بين تفاعل تحسسي والتهاب جلدي منتشر.',
    },
    expect: { en: 'A look at the affected skin, sometimes with a mark drawn around the edge to track it.', ar: 'نظرة على الجلد المصاب، وأحيانًا رسم خط حول الحافة لمتابعتها.' },
    preparation: {
      en: 'Photograph the rash when it is at its worst, and bring the names of anything new you took or used.',
      ar: 'صوّري الطفح في أشد حالاته، وأحضري أسماء أي شيء جديد تناولتِه أو استخدمتِه.',
    },
    candidates: ['allergic_reaction', 'cellulitis'],
    safety_relevant: true,
    sources: ['nhs_conditions'],
  },
  {
    id: 'back_examination',
    type: 'clinical examination',
    name: { en: 'Back and leg examination', ar: 'فحص الظهر والساق' },
    why: {
      en: 'Most back pain does not need imaging. The examination establishes whether a nerve is involved, which is what changes the plan.',
      ar: 'معظم آلام الظهر لا تحتاج تصويرًا. والفحص يحدد وجود تأثر عصبي، وهو ما يغير الخطة.',
    },
    clinical_question: {
      en: 'May help evaluate whether a nerve root is involved rather than muscle and joint alone.',
      ar: 'قد يساعد في تقييم تأثر جذر عصبي بدل العضلات والمفاصل وحدها.',
    },
    expect: { en: 'Movement, reflexes and leg strength are checked.', ar: 'يُفحص المدى الحركي وردود الأفعال وقوة الساق.' },
    preparation: {
      en: 'Wear clothing that allows the back and legs to be examined easily.',
      ar: 'ارتدي ملابس تسمح بفحص الظهر والساقين بسهولة.',
    },
    candidates: ['mechanical_back'],
    safety_relevant: false,
    sources: ['nice_low_back'],
  },
  {
    id: 'throat_swab',
    type: 'laboratory',
    name: { en: 'Throat swab', ar: 'مسحة حلق' },
    why: {
      en: 'Most sore throats are viral and need no test. A clinician considers a swab only in selected cases.',
      ar: 'معظم حالات التهاب الحلق فيروسية ولا تحتاج فحصًا. ولا ينظر الطبيب في المسحة إلا في حالات مختارة.',
    },
    clinical_question: {
      en: 'May help evaluate whether a bacterial cause is present when the pattern suggests it.',
      ar: 'قد تساعد في تقييم وجود سبب بكتيري عندما يوحي النمط بذلك.',
    },
    expect: { en: 'A swab at the back of the throat, over in a second.', ar: 'مسحة في مؤخرة الحلق تنتهي خلال ثانية.' },
    preparation: null,
    candidates: ['viral_uri'],
    safety_relevant: false,
    sources: ['nhs_conditions'],
  },
];

/** Generic, safe preparation that applies to any consultation. */
const VISIT_PREPARATION = {
  en: [
    'Write down when the symptoms started and what makes them better or worse.',
    'Bring a list of every medicine you take, including anything bought without a prescription.',
    'Bring previous reports, laboratory results or imaging if you have them.',
    'Mention any allergies and any previous reaction to a medicine or a contrast dye.',
    'Note any condition that runs in your family and any recent travel.',
    'Ask the clinic what to bring and whether anything needs preparing, rather than acting on general advice.',
  ],
  ar: [
    'دوّني متى بدأت الأعراض وما الذي يزيدها أو يخففها.',
    'أحضري قائمة بكل دواء تتناولينه، بما في ذلك ما يُشترى دون وصفة.',
    'أحضري التقارير أو نتائج التحاليل أو الأشعة السابقة إن وُجدت.',
    'اذكري أي حساسية وأي تفاعل سابق مع دواء أو صبغة تباين.',
    'دوّني أي مرض ينتشر في العائلة وأي سفر حديث.',
    'اسألي العيادة عما ينبغي إحضاره وما إذا كان أي فحص يحتاج تحضيرًا، بدل الاعتماد على نصائح عامة.',
  ],
};

/** What an evaluation being discussed does, and does not, mean. */
const EMOTIONAL_NOTE = {
  en: 'Being asked to complete an evaluation does not by itself mean a particular condition has been confirmed. Clinicians often use tests to tell several possible explanations apart, including to rule things out.',
  ar: 'طلب الطبيب إجراء فحص لا يعني بحد ذاته أن مرضًا معينًا قد تم تأكيده. فالأطباء يستخدمون الفحوصات غالبًا للتفريق بين عدة تفسيرات محتملة، بما في ذلك استبعاد بعضها.',
};

const DECIDER_NOTE = {
  en: 'Which of these is actually appropriate depends on your history and examination. The clinician decides, not this tool.',
  ar: 'أي من هذه الفحوصات مناسب فعلًا يعتمد على تاريخك المرضي وفحصك. والطبيب هو من يقرر، لا هذه الأداة.',
};

const EVALUATION_BY_ID = Object.fromEntries(EVALUATIONS.map((e) => [e.id, e]));

module.exports = { EVALUATIONS, EVALUATION_BY_ID, VISIT_PREPARATION, EMOTIONAL_NOTE, DECIDER_NOTE, COST_NOTE, ASK_CLINIC };
