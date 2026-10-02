#!/usr/bin/env python3
"""Generates HealTrip's pages from one shared chrome.

Two audiences, two experiences:

  patient pages   index, assessment, chat, patient, network
                  no engineering vocabulary anywhere in the copy

  technical page  technical.html
                  API, OpenAPI, agent trace, tests, readiness, sources

The split is the point. A patient should never have to read the word "API" to
use a health service, and a reviewer should be able to see the whole
architecture in one place.
"""

import pathlib
import shutil

OUT = pathlib.Path(__file__).resolve().parent.parent / "frontend"
LOCALES_SRC = pathlib.Path(__file__).resolve().parent.parent / "locales"

NAV = [
    ("index.html", "Home", "الرئيسية"),
    ("about.html", "About", "من نحن"),
    ("how-it-works.html", "How it works", "كيف يعمل"),
    ("assessment.html", "Assessment", "التقييم الصحي"),
    ("chat.html", "AI Assistant", "المساعد الصحي"),
    ("patient.html", "My Profile", "ملفي الصحي"),
    ("network.html", "Doctors", "الأطباء"),
    ("hospitals.html", "Hospitals", "المستشفيات"),
]

CHECK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>'


def wave(fill, flip=False):
    d = (
        "M0,32 C240,0 480,60 720,40 C960,20 1200,0 1440,24 L1440,60 L0,60 Z"
        if not flip
        else "M0,28 C240,60 480,0 720,20 C960,40 1200,60 1440,36 L1440,0 L0,0 Z"
    )
    return (
        f'<svg class="wave" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">'
        f'<path fill="{fill}" d="{d}"/></svg>'
    )


def head(title, desc=""):
    return f"""<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="stylesheet" href="assets/css/app.css">
<script src="config.js"></script>
<script src="assets/js/client.js" defer></script>
<script src="assets/js/core.js" defer></script>"""


def header():
    links = "\n      ".join(
        f'<a href="{href}" data-en="{en}" data-ar="{ar}">{en}</a>' for href, en, ar in NAV
    )
    return f"""</head>
<body>
<a class="skip" href="#main" data-en="Skip to content" data-ar="تخطي إلى المحتوى">Skip to content</a>

<header class="top">
  <div class="wrap">
    <a class="brand" href="index.html">
      <span class="mark" aria-hidden="true">H</span>
      <span><b>HealTrip</b><span data-en="Health navigation" data-ar="دليلك إلى الرعاية">Health navigation</span></span>
    </a>
    <nav class="nav">
      {links}
    </nav>
    <button class="lang" type="button">العربية</button>
    <button class="menu-btn" type="button" aria-label="Menu">≡</button>
  </div>
</header>

<main id="main">"""


FOOTER = """</main>

<footer>
  <div class="wrap">
    <div>
      <a class="brand" href="index.html" style="margin-bottom:.8rem">
        <span class="mark" aria-hidden="true">H</span><span><b>HealTrip</b></span>
      </a>
      <p data-en="HealTrip helps you understand your symptoms, prepare for a medical visit, and find appropriate care. It provides health information and navigation support, and does not replace professional medical care." data-ar="يساعدك HealTrip على فهم أعراضك والاستعداد للزيارة الطبية والوصول إلى الرعاية المناسبة. وهو يقدم معلومات صحية ودعمًا في التوجيه، ولا يحل محل الرعاية الطبية المتخصصة.">HealTrip helps you understand your symptoms, prepare for a medical visit, and find appropriate care.</p>
    </div>
    <div>
      <h3 data-en="HealTrip" data-ar="HealTrip">HealTrip</h3>
      <a href="about.html" data-en="About" data-ar="من نحن">About</a>
      <a href="how-it-works.html" data-en="How it works" data-ar="كيف يعمل">How it works</a>
      <a href="how-it-works.html#faq" data-en="Questions" data-ar="أسئلة شائعة">Questions</a>
    </div>
    <div>
      <h3 data-en="Use HealTrip" data-ar="استخدمي HealTrip">Use HealTrip</h3>
      <a href="assessment.html" data-en="Assessment" data-ar="التقييم الصحي">Assessment</a>
      <a href="chat.html" data-en="AI Assistant" data-ar="المساعد الصحي">AI Assistant</a>
      <a href="patient.html" data-en="My Profile" data-ar="ملفي الصحي">My Profile</a>
    </div>
    <div>
      <h3 data-en="Find care" data-ar="البحث عن الرعاية">Find care</h3>
      <a href="network.html" data-en="Doctors" data-ar="الأطباء">Doctors</a>
      <a href="hospitals.html" data-en="Hospitals" data-ar="المستشفيات">Hospitals</a>
      <a href="about.html#privacy" data-en="Your information" data-ar="معلوماتك">Your information</a>
    </div>
  </div>
  <div class="wrap legal">
    <span data-en="HealTrip does not diagnose, does not prescribe, and does not replace a healthcare professional. What you enter stays in your session or your profile and can be deleted at any time." data-ar="HealTrip لا يشخّص ولا يصف علاجًا ولا يحل محل الطبيب. وما تدخلينه يبقى في جلستك أو ملفك ويمكن حذفه في أي وقت.">HealTrip does not diagnose, does not prescribe, and does not replace a healthcare professional.</span>
    <a href="technical.html" class="dev-link" data-en="Technical console" data-ar="لوحة المطوّر">Technical console</a>
  </div>
</footer>
</body>
</html>
"""


def page(path, title, body, extra_scripts=(), desc=""):
    scripts = "\n".join(f'<script src="{s}" defer></script>' for s in extra_scripts)
    html = head(title, desc) + ("\n" + scripts if scripts else "") + header() + body + FOOTER
    (OUT / path).write_text(html, encoding="utf-8")
    print("wrote", path, len(html), "bytes")


# ---------------------------------------------------------------------------
# Landing
# ---------------------------------------------------------------------------
INDEX = f"""
<div class="hero">
  <div class="wrap">
    <div>
      <p class="eyebrow" data-en="Health navigation" data-ar="دليلك إلى الرعاية">Health navigation</p>
      <h1 class="display" data-en="Understand your symptoms. Know what to do next." data-ar="افهمي أعراضك. واعرفي خطوتك التالية.">Understand your symptoms. Know what to do next.</h1>
      <p class="lede" style="margin-top:1.4rem" data-en="Describe what you're experiencing in your own words, in Arabic or English. HealTrip asks thoughtful follow-up questions, helps you understand what may be relevant, prepares you for a medical visit, and helps you find appropriate care." data-ar="صفي ما تشعرين به بكلماتك، بالعربية أو الإنجليزية. يطرح HealTrip أسئلة متابعة مدروسة، ويساعدك على فهم ما قد يكون ذا صلة، ويجهّزك للزيارة الطبية، ويساعدك في الوصول إلى الرعاية المناسبة.">Describe what you're experiencing in your own words, in Arabic or English.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="assessment.html" data-en="Start your assessment" data-ar="ابدئي تقييمك الصحي">Start your assessment</a>
        <a class="btn btn-ghost" href="network.html" data-en="Find a doctor" data-ar="ابحثي عن طبيب">Find a doctor</a>
      </div>
      <p class="hero-note" data-en="HealTrip provides health information and care-navigation support. It does not replace professional medical care. If something feels severe or sudden, contact emergency services where you are." data-ar="يوفر HealTrip معلومات صحية ومساعدة في الوصول إلى الرعاية المناسبة، ولا يحل محل التقييم الطبي المتخصص. وإذا شعرتِ بأن الحالة شديدة أو مفاجئة، اتصلي بخدمات الطوارئ في مكانك.">HealTrip provides health information and care-navigation support. It does not replace professional medical care.</p>
    </div>
    <figure class="hero-figure" style="margin:0">
      <video autoplay muted loop playsinline poster="media/hero-poster.jpg">
        <source src="media/hero.mp4" type="video/mp4">
      </video>
      <figcaption class="hero-caption" data-en="A consultation goes better when you arrive prepared." data-ar="تكون الاستشارة أفضل عندما تصلين وأنتِ مستعدة.">A consultation goes better when you arrive prepared.</figcaption>
    </figure>
  </div>
</div>

{wave('#ede6d8')}
<section class="band-sand" id="about" style="padding-top:1rem">
  <div class="wrap grid grid-2" style="align-items:center">
    <div>
      <p class="eyebrow" data-en="About HealTrip" data-ar="عن HealTrip">About HealTrip</p>
      <h2 class="display" data-en="From a health worry to the right next step" data-ar="من القلق الصحي إلى الخطوة الصحيحة">From a health worry to the right next step</h2>
      <p style="margin-top:1.2rem" data-en="HealTrip was created to make the journey from noticing a health concern to seeking appropriate care clearer and calmer. Instead of searching your symptoms online and reading the worst result first, you can describe what you're experiencing and be guided through it." data-ar="أُنشئ HealTrip ليجعل الطريق من ملاحظة مشكلة صحية إلى طلب الرعاية المناسبة أوضح وأهدأ. فبدل البحث عن أعراضك على الإنترنت وقراءة أسوأ نتيجة أولًا، يمكنك وصف ما تشعرين به وأن تُرشدي خلاله خطوة بخطوة.">HealTrip was created to make the journey from noticing a health concern to seeking appropriate care clearer and calmer.</p>
      <p data-en="You answer thoughtful follow-up questions, see what may be relevant to what you described, learn what a healthcare professional may consider next, prepare for your visit, and explore the care available to you." data-ar="تجيبين عن أسئلة متابعة مدروسة، وترين ما قد يكون ذا صلة بما وصفتِه، وتتعرفين على ما قد ينظر فيه الطبيب لاحقًا، وتستعدين لزيارتك، وتستكشفين الرعاية المتاحة لك.">You answer thoughtful follow-up questions, see what may be relevant, and prepare for your visit.</p>
    </div>
    <div style="border-radius:20px;overflow:hidden;box-shadow:var(--shadow)">
      <img src="media/family-consult.jpg" alt="A family in a video consultation" style="height:360px;object-fit:cover;width:100%">
    </div>
  </div>
</section>
{wave('#ede6d8', flip=True)}

<section id="how">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow" data-en="How it works" data-ar="كيف يعمل">How it works</p>
      <h2 class="display" data-en="Five steps, at your pace" data-ar="خمس خطوات، على راحتك">Five steps, at your pace</h2>
    </div>
    <div class="steps">
      <div class="step"><span class="step-n">01</span><h3 data-en="Tell us what you're experiencing" data-ar="أخبرينا بما تشعرين به">Tell us what you're experiencing</h3><p data-en="Describe your symptoms naturally. You can type or use your voice, in Arabic or English." data-ar="صفي أعراضك بشكل طبيعي. يمكنك الكتابة أو استخدام صوتك، بالعربية أو الإنجليزية.">Describe your symptoms naturally. You can type or use your voice.</p></div>
      <div class="step"><span class="step-n">02</span><h3 data-en="Answer a few personal questions" data-ar="أجيبي عن بضعة أسئلة">Answer a few personal questions</h3><p data-en="Each follow-up question is based on what you've already told us, so you never have to repeat yourself." data-ar="كل سؤال متابعة يعتمد على ما ذكرتِه بالفعل، فلا تحتاجين إلى تكرار نفسك.">Each follow-up question is based on what you've already told us.</p></div>
      <div class="step"><span class="step-n">03</span><h3 data-en="Understand what may be relevant" data-ar="افهمي ما قد يكون ذا صلة">Understand what may be relevant</h3><p data-en="See possible explanations that may fit your answers, what supports each one, and what is still unclear." data-ar="اطّلعي على التفسيرات المحتملة التي قد تتوافق مع إجاباتك، وما يدعم كل منها، وما لم يتضح بعد.">See possible explanations that may fit your answers.</p></div>
      <div class="step"><span class="step-n">04</span><h3 data-en="Know what to prepare for" data-ar="اعرفي لماذا تستعدين">Know what to prepare for</h3><p data-en="Learn which evaluations a healthcare professional may consider, why they may be useful, and what to bring." data-ar="تعرّفي على الفحوصات التي قد يفكر فيها الطبيب، ولماذا قد تكون مفيدة، وما الذي تحضرينه.">Learn which evaluations a healthcare professional may consider, and what to bring.</p></div>
      <div class="step"><span class="step-n">05</span><h3 data-en="Find appropriate care" data-ar="اعثري على الرعاية المناسبة">Find appropriate care</h3><p data-en="Explore healthcare professionals and facilities by specialty, location, language and available services." data-ar="استكشفي الأطباء والمنشآت حسب التخصص والموقع واللغة والخدمات المتاحة.">Explore healthcare professionals and facilities by specialty, location and language.</p></div>
    </div>
  </div>
</section>

<section style="padding-top:0">
  <div class="wrap grid grid-2" style="align-items:center">
    <div>
      <p class="eyebrow" data-en="The assessment" data-ar="التقييم">The assessment</p>
      <h2 class="display" style="font-size:2.1rem" data-en="You don't need the medical words" data-ar="لستِ بحاجة إلى المصطلحات الطبية">You don't need the medical words</h2>
      <p style="margin-top:1.1rem" data-en="Tell HealTrip what you are experiencing the way you would tell a friend. Based on your answers, it may ask about timing, pattern, what makes it better or worse, and anything else that would help a healthcare professional understand your situation." data-ar="أخبري HealTrip بما تشعرين به كما تخبرين صديقة. وبناءً على إجاباتك قد يسأل عن التوقيت والنمط وما يزيد الأعراض أو يخففها، وأي شيء آخر يساعد الطبيب على فهم حالتك.">Tell HealTrip what you are experiencing the way you would tell a friend.</p>
      <div class="chat-sample">
        <div class="bubble you" data-en="I've been having headaches." data-ar="عندي صداع منذ فترة.">I've been having headaches.</div>
        <div class="bubble ht" data-en="When did they begin?" data-ar="متى بدأ؟">When did they begin?</div>
        <div class="bubble you" data-en="About three days ago." data-ar="قبل ثلاثة أيام تقريبًا.">About three days ago.</div>
        <div class="bubble ht" data-en="Have they been getting worse, improving, or staying about the same?" data-ar="هل يزداد أم يتحسن أم بقي كما هو؟">Have they been getting worse, improving, or staying about the same?</div>
      </div>
      <a class="btn btn-primary" href="assessment.html" style="margin-top:1.2rem" data-en="Start your assessment" data-ar="ابدئي تقييمك">Start your assessment</a>
    </div>
    <div style="border-radius:20px;overflow:hidden;box-shadow:var(--shadow)">
      <video autoplay muted loop playsinline style="height:400px;object-fit:cover;width:100%">
        <source src="media/clinic-loop.mp4" type="video/mp4">
      </video>
    </div>
  </div>
</section>

{wave('#dde4d6')}
<section class="band-sage" style="padding-top:1rem">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow" data-en="What may happen next" data-ar="ما الذي قد يحدث لاحقًا">What may happen next</p>
      <h2 class="display" data-en="Know what to prepare for" data-ar="اعرفي لماذا تستعدين">Know what to prepare for</h2>
      <p data-en="Depending on what you describe, a healthcare professional may consider an examination, a laboratory test, or imaging. Understanding that in advance makes the visit easier." data-ar="بحسب ما تصفينه، قد ينظر الطبيب في فحص سريري أو تحليل مخبري أو تصوير. ومعرفة ذلك مسبقًا تجعل الزيارة أسهل.">Depending on what you describe, a healthcare professional may consider an examination, a test, or imaging.</p>
    </div>
    <div class="grid grid-2">
      <div class="card"><div class="card-icon">{CHECK}</div><h3 data-en="Why it may be considered" data-ar="لماذا قد يُنظر فيه">Why it may be considered</h3><p data-en="Written in plain language, so you understand the reason rather than only the name of a test." data-ar="مكتوب بلغة بسيطة، لتفهمي السبب لا اسم الفحص فقط.">Written in plain language, so you understand the reason rather than only the name of a test.</p></div>
      <div class="card"><div class="card-icon">{CHECK}</div><h3 data-en="What it may help evaluate" data-ar="ما الذي قد يساعد في تقييمه">What it may help evaluate</h3><p data-en="The question each evaluation is trying to answer, and what it cannot tell you on its own." data-ar="السؤال الذي يحاول كل فحص الإجابة عنه، وما لا يستطيع إخبارك به وحده.">The question each evaluation is trying to answer.</p></div>
      <div class="card"><div class="card-icon">{CHECK}</div><h3 data-en="How to prepare" data-ar="كيف تستعدين">How to prepare</h3><p data-en="Only preparation that is genuinely supported. Where it depends on you, HealTrip says to ask the clinic." data-ar="فقط التحضير المدعوم فعلًا. وحين يعتمد الأمر على حالتك، يطلب منك HealTrip سؤال العيادة.">Only preparation that is genuinely supported.</p></div>
      <div class="card"><div class="card-icon">{CHECK}</div><h3 data-en="Planning ahead" data-ar="الاستعداد العملي">Planning ahead</h3><p data-en="Availability and cost vary by place and provider, so HealTrip never shows a price. You can ask the clinic before going ahead." data-ar="يختلف التوفر والتكلفة حسب المكان ومقدم الخدمة، لذلك لا يعرض HealTrip أي سعر. ويمكنك سؤال المركز الطبي قبل المضي.">Availability and cost vary, so HealTrip never shows a price.</p></div>
    </div>
    <div class="notice" style="margin-top:1.6rem">
      <p style="margin:0" data-en="Being asked to complete an evaluation does not by itself mean a particular condition has been confirmed. Tests are often used to help a clinician tell several possible explanations apart." data-ar="طلب إجراء فحص لا يعني بحد ذاته تأكيد وجود حالة معينة. فالفحوصات تُستخدم غالبًا لمساعدة الطبيب على التمييز بين عدة تفسيرات محتملة.">Being asked to complete an evaluation does not by itself mean a particular condition has been confirmed.</p>
    </div>
  </div>
</section>
{wave('#dde4d6', flip=True)}

<section>
  <div class="wrap grid grid-3">
    <article class="card card-media">
      <img src="media/patient-phone.jpg" alt="A patient using a phone">
      <div class="card-body">
        <h3 data-en="Your AI health assistant" data-ar="مساعدك الصحي">Your AI health assistant</h3>
        <p data-en="Have a conversation about what you're experiencing, ask what a word in a report means, or prepare questions for your appointment. It supports and does not replace a healthcare professional." data-ar="تحدثي عما تشعرين به، أو اسألي عن معنى مصطلح في تقرير، أو جهّزي أسئلة لموعدك. وهو يدعم ولا يحل محل الطبيب.">Have a conversation about what you're experiencing, or prepare questions for your appointment.</p>
        <p style="margin-top:1rem"><a class="btn btn-ghost" href="chat.html" data-en="Open the assistant" data-ar="افتحي المساعد">Open the assistant</a></p>
      </div>
    </article>
    <article class="card card-media">
      <img src="media/clinic-notes.jpg" alt="Health records">
      <div class="card-body">
        <h3 data-en="Your health profile" data-ar="ملفك الصحي">Your health profile</h3>
        <p data-en="Keep your history, medications, allergies, reports and notes in one place, so you arrive at an appointment prepared instead of trying to remember." data-ar="احتفظي بتاريخك وأدويتك وحساسياتك وتقاريرك وملاحظاتك في مكان واحد، لتصلي إلى الموعد مستعدة بدل محاولة التذكر.">Keep your history, medications, allergies, reports and notes in one place.</p>
        <p style="margin-top:1rem"><a class="btn btn-ghost" href="patient.html" data-en="Open my profile" data-ar="افتحي ملفي">Open my profile</a></p>
      </div>
    </article>
    <article class="card card-media">
      <img src="media/telehealth-home.jpg" alt="A patient in a video consultation at home">
      <div class="card-body">
        <h3 data-en="Find the right care" data-ar="اعثري على الرعاية المناسبة">Find the right care</h3>
        <p data-en="When you're ready, explore healthcare professionals and facilities by specialty, city, language and telemedicine." data-ar="عندما تكونين مستعدة، استكشفي الأطباء والمنشآت حسب التخصص والمدينة واللغة والطب عن بُعد.">Explore healthcare professionals and facilities by specialty, city and language.</p>
        <p style="margin-top:1rem"><a class="btn btn-ghost" href="network.html" data-en="Find care" data-ar="ابحثي عن الرعاية">Find care</a></p>
      </div>
    </article>
  </div>
</section>

<section id="prepare" class="band-sand">
  <div class="wrap grid grid-2" style="align-items:flex-start">
    <div>
      <p class="eyebrow" data-en="Before your visit" data-ar="قبل زيارتك">Before your visit</p>
      <h2 class="display" style="font-size:2rem" data-en="Prepare for your medical visit" data-ar="الاستعداد لزيارتك الطبية">Prepare for your medical visit</h2>
      <p style="margin-top:1rem" data-en="A few minutes of preparation changes how much a short appointment can cover." data-ar="دقائق قليلة من التحضير تغيّر كم يمكن تغطيته في موعد قصير.">A few minutes of preparation changes how much a short appointment can cover.</p>
    </div>
    <div>
      <div class="tick">{CHECK}<span data-en="Bring previous medical reports and test results" data-ar="أحضري التقارير الطبية ونتائج التحاليل السابقة">Bring previous medical reports and test results</span></div>
      <div class="tick">{CHECK}<span data-en="Keep a list of your current medications" data-ar="احتفظي بقائمة أدويتك الحالية">Keep a list of your current medications</span></div>
      <div class="tick">{CHECK}<span data-en="Mention any known allergies" data-ar="اذكري أي حساسية معروفة">Mention any known allergies</span></div>
      <div class="tick">{CHECK}<span data-en="Remember when the symptoms started" data-ar="تذكري متى بدأت الأعراض">Remember when the symptoms started</span></div>
      <div class="tick">{CHECK}<span data-en="Note what makes them better or worse" data-ar="دوّني ما يخففها أو يزيدها">Note what makes them better or worse</span></div>
      <div class="tick">{CHECK}<span data-en="Write down the questions you want to ask" data-ar="اكتبي الأسئلة التي تودين طرحها">Write down the questions you want to ask</span></div>
    </div>
  </div>
</section>

<section id="privacy">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow" data-en="Your information" data-ar="معلوماتك">Your information</p>
      <h2 class="display" data-en="Your health information matters" data-ar="معلوماتك الصحية مهمة">Your health information matters</h2>
    </div>
    <div class="grid grid-3">
      <div class="card"><h3 data-en="It stays yours" data-ar="تبقى ملكك">It stays yours</h3><p data-en="What you enter stays in your session or your profile, and you can delete any of it at any time." data-ar="ما تدخلينه يبقى في جلستك أو ملفك، ويمكنك حذف أي منه في أي وقت.">What you enter stays in your session or your profile, and you can delete any of it at any time.</p></div>
      <div class="card"><h3 data-en="Nothing is assumed about you" data-ar="لا يُفترض عنك شيء">Nothing is assumed about you</h3><p data-en="Anything you add is recorded as something you reported, until a healthcare professional confirms it." data-ar="أي شيء تضيفينه يُسجَّل كشيء ذكرتِه أنتِ، إلى أن يؤكده طبيب.">Anything you add is recorded as something you reported, until a healthcare professional confirms it.</p></div>
      <div class="card"><h3 data-en="Clear about its limits" data-ar="واضح بشأن حدوده">Clear about its limits</h3><p data-en="HealTrip is a navigation and information service. It does not diagnose, does not prescribe, and does not replace professional medical care." data-ar="HealTrip خدمة توجيه ومعلومات. لا يشخّص ولا يصف علاجًا ولا يحل محل الرعاية الطبية المتخصصة.">HealTrip is a navigation and information service.</p></div>
    </div>
  </div>
</section>

<section id="faq" class="band-sand">
  <div class="wrap">
    <div class="section-head">
      <h2 class="display" data-en="Questions people ask" data-ar="أسئلة يطرحها الناس">Questions people ask</h2>
    </div>
    <div class="faq">
      <details><summary data-en="Is HealTrip a doctor?" data-ar="هل HealTrip طبيب؟">Is HealTrip a doctor?</summary><p data-en="No. HealTrip helps you understand health information and find your way towards appropriate care. Medical decisions belong with a licensed healthcare professional." data-ar="لا. يساعدك HealTrip على فهم المعلومات الصحية والوصول إلى الرعاية المناسبة. أما القرارات الطبية فهي من اختصاص طبيب مرخّص.">No. HealTrip helps you understand health information and find your way towards appropriate care.</p></details>
      <details><summary data-en="Does HealTrip diagnose conditions?" data-ar="هل يشخّص HealTrip الأمراض؟">Does HealTrip diagnose conditions?</summary><p data-en="It does not give a confirmed diagnosis. It explains possibilities that may be compatible with what you described, so you can discuss them with a healthcare professional." data-ar="لا يعطي تشخيصًا مؤكدًا. بل يشرح احتمالات قد تتوافق مع ما وصفتِه، لتتمكني من مناقشتها مع الطبيب.">It does not give a confirmed diagnosis.</p></details>
      <details><summary data-en="Will HealTrip tell me which tests I need?" data-ar="هل يخبرني HealTrip بالفحوصات التي أحتاجها؟">Will HealTrip tell me which tests I need?</summary><p data-en="It explains evaluations a clinician may consider and why they may be useful. The healthcare professional decides which are appropriate after your history and examination." data-ar="يشرح الفحوصات التي قد يفكر فيها الطبيب ولماذا قد تكون مفيدة. والطبيب هو من يقرر المناسب بعد التاريخ المرضي والفحص.">It explains evaluations a clinician may consider and why they may be useful.</p></details>
      <details><summary data-en="Can I use HealTrip in Arabic?" data-ar="هل يمكنني استخدام HealTrip بالعربية؟">Can I use HealTrip in Arabic?</summary><p data-en="Yes. Everything works in Arabic and English, including the questions, the explanations and the summary you can print." data-ar="نعم. كل شيء يعمل بالعربية والإنجليزية، بما في ذلك الأسئلة والشروحات والملخص القابل للطباعة.">Yes. Everything works in Arabic and English.</p></details>
      <details><summary data-en="Can I use my voice?" data-ar="هل يمكنني استخدام صوتي؟">Can I use my voice?</summary><p data-en="Yes, where your device and browser support it. HealTrip waits while you think and does not cut you off at the first pause." data-ar="نعم، حيثما يدعم جهازك ومتصفحك ذلك. وينتظر HealTrip أثناء تفكيرك ولا يقاطعك عند أول توقف.">Yes, where your device and browser support it.</p></details>
      <details><summary data-en="Can I keep my health information?" data-ar="هل أستطيع حفظ معلوماتي الصحية؟">Can I keep my health information?</summary><p data-en="Yes. Your profile can hold your history, medications, allergies, reports and previous assessments, and you can delete any of it." data-ar="نعم. يمكن لملفك أن يحتفظ بتاريخك وأدويتك وحساسياتك وتقاريرك وتقييماتك السابقة، ويمكنك حذف أي منها.">Yes. Your profile can hold your history, medications, allergies, reports and previous assessments.</p></details>
    </div>
  </div>
</section>

<section class="closing">
  <div class="wrap" style="text-align:center">
    <h2 class="display" data-en="Take the next step with more clarity" data-ar="اتخذي خطوتك التالية بوضوح أكبر">Take the next step with more clarity</h2>
    <p style="margin:1rem auto 2rem;max-width:52ch" data-en="Start by telling us what you're experiencing." data-ar="ابدئي بإخبارنا بما تشعرين به.">Start by telling us what you're experiencing.</p>
    <div class="row" style="justify-content:center">
      <a class="btn btn-primary" href="assessment.html" data-en="Start your assessment" data-ar="ابدئي تقييمك الصحي">Start your assessment</a>
      <a class="btn btn-ghost" href="network.html" data-en="Find a doctor" data-ar="ابحثي عن طبيب">Find a doctor</a>
    </div>
  </div>
</section>
"""

page(
    "index.html",
    "HealTrip — understand your symptoms, know what to do next",
    INDEX,
    desc="Describe your symptoms in Arabic or English. HealTrip asks thoughtful follow-up questions, helps you understand what may be relevant, prepares you for a medical visit and helps you find care.",
)


# ---------------------------------------------------------------------------
# Assessment
# ---------------------------------------------------------------------------
ASSESSMENT = """
<section style="padding-bottom:1.4rem">
  <div class="wrap">
    <p class="eyebrow" data-en="Health assessment" data-ar="التقييم الصحي">Health assessment</p>
    <h1 class="display" style="font-size:clamp(1.9rem,4vw,2.8rem)" data-en="Tell us what you're experiencing" data-ar="أخبرينا بما تشعرين به">Tell us what you're experiencing</h1>
    <p class="lede" style="margin-top:1rem" data-en="Take your time. You can speak or type, in Arabic or English, and each follow-up question is based on what you've already told us." data-ar="خذي وقتك. يمكنك التحدث أو الكتابة، بالعربية أو الإنجليزية، وكل سؤال متابعة يعتمد على ما ذكرتِه بالفعل.">Take your time. You can speak or type, and each follow-up question is based on what you've already told us.</p>
    <div class="row" style="margin-top:1.2rem">
      <span class="urgency" id="urgency" data-level="routine" data-en="Getting started" data-ar="البداية">Getting started</span>
      <span style="font-size:.86rem;color:var(--mist)" id="progress"></span>
      <button class="lang" type="button" id="voice-toggle" style="margin-inline-start:auto">Voice replies: on</button>
    </div>
  </div>
</section>

<div class="wrap">
  <div class="console" id="console">
    <section>
      <div class="panel-label" data-en="Your conversation" data-ar="محادثتك">Your conversation</div>
      <div id="thread" style="min-height:220px"></div>

      <div id="composer" style="margin-top:1.6rem">
        <div class="voice-dock">
          <button class="mic" id="mic" type="button" data-on="false" aria-label="Speak">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
          </button>
          <div class="voice-state">
            <span id="voice-state-text" data-en="Tap to talk" data-ar="اضغطي للتحدث">Tap to talk</span>
            <div id="interim" class="interim"></div>
          </div>
          <button class="btn btn-ghost" id="finish-turn" type="button" style="display:none" data-en="I'm finished" data-ar="انتهيت">I'm finished</button>
        </div>

        <textarea class="field" id="intake" rows="3"
          data-en="For example: I've had a headache for three days, mostly in the morning"
          data-ar="مثال: عندي صداع منذ ثلاثة أيام، غالبًا في الصباح"
          placeholder="For example: I've had a headache for three days, mostly in the morning"></textarea>
        <div class="row" style="margin-top:.7rem">
          <button class="btn btn-primary" id="send" type="button" data-en="Send" data-ar="إرسال">Send</button>
          <span style="font-size:.82rem;color:var(--mist)" id="mic-note"></span>
        </div>
      </div>
    </section>

    <div>
      <div class="panel-label" id="state-label" data-en="What we've understood so far" data-ar="ما فهمناه حتى الآن">What we've understood so far</div>
      <div id="state"><p style="color:var(--mist);margin:0" data-en="Nothing yet. Tell us what you're experiencing to begin." data-ar="لا شيء بعد. أخبرينا بما تشعرين به للبدء.">Nothing yet.</p></div>

      <div class="panel-label" id="shortlist-label" style="margin-top:2rem;display:none" data-en="What may be relevant so far" data-ar="ما قد يكون ذا صلة حتى الآن">What may be relevant so far</div>
      <div id="shortlist"></div>

      <p style="font-size:.84rem;color:var(--mist);margin-top:2rem;border-inline-start:3px solid var(--brass);padding-inline-start:.9rem"
         data-en="These are possibilities to discuss with a healthcare professional, not a diagnosis."
         data-ar="هذه احتمالات لمناقشتها مع الطبيب، وليست تشخيصًا.">These are possibilities to discuss with a healthcare professional, not a diagnosis.</p>
    </div>
  </div>

  <section id="result" style="padding-block:2.5rem"></section>
</div>
"""
page("assessment.html", "Assessment — HealTrip", ASSESSMENT, ["assets/js/voice.js", "assets/js/assessment.js"])


# ---------------------------------------------------------------------------
# Find care
# ---------------------------------------------------------------------------
NETWORK = """
<section style="padding-bottom:1.4rem">
  <div class="wrap">
    <p class="eyebrow" data-en="Find care" data-ar="البحث عن الرعاية">Find care</p>
    <h1 class="display" style="font-size:clamp(1.9rem,4vw,2.8rem)" data-en="Find the right healthcare professional" data-ar="اعثري على الطبيب المناسب">Find the right healthcare professional</h1>
    <p class="lede" style="margin-top:1rem" data-en="Explore healthcare professionals and facilities by specialty, city, language and available services. Every record shows where its information came from." data-ar="استكشفي الأطباء والمنشآت حسب التخصص والمدينة واللغة والخدمات المتاحة. ويعرض كل سجل مصدر معلوماته.">Explore healthcare professionals and facilities by specialty, city, language and available services.</p>
  </div>
</section>

<div class="wrap">
  <div class="card" style="margin-bottom:2rem">
    <div class="row">
      <select class="field" id="f-specialty" style="width:auto;min-width:190px" aria-label="Specialty"><option value="" data-en="All specialties" data-ar="كل التخصصات">All specialties</option></select>
      <select class="field" id="f-country" style="width:auto;min-width:180px" aria-label="Country"><option value="" data-en="All countries" data-ar="كل الدول">All countries</option></select>
      <input class="field" id="f-city" style="width:auto;min-width:150px" data-en="City" data-ar="المدينة" placeholder="City" aria-label="City">
      <select class="field" id="f-language" style="width:auto;min-width:150px" aria-label="Language">
        <option value="" data-en="Any language" data-ar="أي لغة">Any language</option><option>Arabic</option><option>English</option><option>French</option><option>Urdu</option>
      </select>
      <label class="row" style="gap:.45rem;font-size:.9rem;color:var(--mist)">
        <input type="checkbox" id="f-tele"> <span data-en="Telemedicine only" data-ar="طب عن بُعد فقط">Telemedicine only</span>
      </label>
      <button class="btn btn-primary" id="search" type="button" data-en="Search" data-ar="بحث">Search</button>
    </div>
  </div>

  <p id="count" style="color:var(--mist);font-size:.9rem"></p>
  <div class="grid grid-2" id="doctors" style="margin-bottom:3rem"></div>

  <h2 class="display" id="hospitals" style="font-size:1.7rem" data-en="Hospitals and facilities" data-ar="المستشفيات والمنشآت">Hospitals and facilities</h2>
  <p style="color:var(--mist)" data-en="Explore facilities by the type of care you may be looking for." data-ar="استكشفي المنشآت حسب نوع الرعاية التي قد تبحثين عنها.">Explore facilities by the type of care you may be looking for.</p>
  <div class="grid grid-3" id="hospitals-list" style="margin-top:1.4rem"></div>

  <section>
    <h2 class="display" style="font-size:1.6rem" data-en="How we check a professional's registration" data-ar="كيف نتحقق من تسجيل الطبيب">How we check a professional's registration</h2>
    <p style="color:var(--mist)" data-en="A verified mark appears only when an official medical register has actually been checked. Until then, each record shows its source openly." data-ar="لا تظهر علامة التحقق إلا إذا تم الرجوع فعلًا إلى سجل طبي رسمي. وحتى ذلك الحين يعرض كل سجل مصدره بوضوح.">A verified mark appears only when an official medical register has actually been checked.</p>
    <div class="grid grid-3" id="authorities" style="margin-top:1.2rem"></div>
  </section>
</div>
"""
page("network.html", "Find care — HealTrip", NETWORK, ["assets/js/network.js"])


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------
PATIENT = """
<section style="padding-bottom:1.4rem">
  <div class="wrap">
    <p class="eyebrow" data-en="My health profile" data-ar="ملفي الصحي">My health profile</p>
    <h1 class="display" style="font-size:clamp(1.9rem,4vw,2.8rem)" data-en="Keep your health information in one place" data-ar="احتفظي بمعلوماتك الصحية في مكان واحد">Keep your health information in one place</h1>
    <p class="lede" style="margin-top:1rem" data-en="Your history, medications, allergies, reports and notes. Everything you add is kept as something you reported, until a healthcare professional confirms it, and you can delete any of it." data-ar="تاريخك وأدويتك وحساسياتك وتقاريرك وملاحظاتك. وكل ما تضيفينه يُحفظ كشيء ذكرتِه أنتِ حتى يؤكده طبيب، ويمكنك حذف أي منه.">Your history, medications, allergies, reports and notes, all in one place.</p>
  </div>
</section>

<div class="wrap" style="padding-bottom:3rem">
  <div class="console">
    <section>
      <div class="panel-label" data-en="About you" data-ar="عنك">About you</div>
      <form id="profile-form" class="grid" style="gap:.9rem">
        <div>
          <label class="lbl" for="full_name" data-en="Full name" data-ar="الاسم الكامل">Full name</label>
          <input class="field" id="full_name" autocomplete="name">
        </div>
        <div class="row" style="flex-wrap:nowrap;gap:.9rem">
          <div style="flex:1"><label class="lbl" for="country" data-en="Country" data-ar="الدولة">Country</label><input class="field" id="country"></div>
          <div style="flex:1"><label class="lbl" for="city" data-en="City" data-ar="المدينة">City</label><input class="field" id="city"></div>
        </div>
        <div class="row" style="flex-wrap:nowrap;gap:.9rem">
          <div style="flex:1"><label class="lbl" for="date_of_birth" data-en="Date of birth" data-ar="تاريخ الميلاد">Date of birth</label><input class="field" id="date_of_birth" type="date"></div>
          <div style="flex:1"><label class="lbl" for="preferred_language" data-en="Preferred language" data-ar="اللغة المفضلة">Preferred language</label>
            <select class="field" id="preferred_language"><option value="en">English</option><option value="ar">العربية</option></select></div>
        </div>
        <div class="row">
          <button class="btn btn-primary" type="submit" data-en="Save" data-ar="حفظ">Save</button>
          <span id="profile-status" style="font-size:.86rem;color:var(--mist)"></span>
        </div>
      </form>
    </section>
    <div>
      <div class="panel-label" data-en="Add to your record" data-ar="أضيفي إلى سجلك">Add to your record</div>
      <form id="record-form" class="grid" style="gap:.9rem">
        <div>
          <label class="lbl" for="record_type" data-en="What is this?" data-ar="ما هذا؟">What is this?</label>
          <select class="field" id="record_type">
            <option value="condition" data-en="A health condition" data-ar="حالة صحية">A health condition</option>
            <option value="medication" data-en="A medication" data-ar="دواء">A medication</option>
            <option value="allergy" data-en="An allergy" data-ar="حساسية">An allergy</option>
            <option value="prescription" data-en="A prescription" data-ar="وصفة">A prescription</option>
            <option value="lab_result" data-en="A test result" data-ar="نتيجة تحليل">A test result</option>
            <option value="medical_history" data-en="Past medical history" data-ar="تاريخ مرضي سابق">Past medical history</option>
            <option value="note" data-en="A note" data-ar="ملاحظة">A note</option>
          </select>
        </div>
        <div>
          <label class="lbl" for="record_title" data-en="Name it" data-ar="سمّيه">Name it</label>
          <input class="field" id="record_title" data-en="For example: Penicillin" data-ar="مثال: البنسلين" placeholder="For example: Penicillin">
        </div>
        <div>
          <label class="lbl" for="record_content" data-en="Details" data-ar="التفاصيل">Details</label>
          <textarea class="field" id="record_content" rows="3" data-en="Dose, reaction, date, or anything you'd want a healthcare professional to know" data-ar="الجرعة أو التفاعل أو التاريخ أو أي شيء تودين أن يعرفه الطبيب" placeholder="Dose, reaction, date, or anything you'd want a healthcare professional to know"></textarea>
        </div>
        <div class="row">
          <button class="btn btn-primary" type="submit" data-en="Add" data-ar="إضافة">Add</button>
          <button class="btn btn-ghost" id="voice-record" type="button" data-en="Say it instead" data-ar="قوليها بصوتك">Say it instead</button>
          <span id="record-status" style="font-size:.86rem;color:var(--mist)"></span>
        </div>
      </form>
    </div>
  </div>

  <section>
    <h2 class="display" style="font-size:1.6rem" data-en="Your records" data-ar="سجلاتك">Your records</h2>
    <div id="records" style="margin-top:1.2rem"></div>
  </section>
</div>
"""
page("patient.html", "My profile — HealTrip", PATIENT, ["assets/js/patient.js"])


# ---------------------------------------------------------------------------
# Assistant
# ---------------------------------------------------------------------------
CHAT = """
<section style="padding-bottom:1.4rem">
  <div class="wrap">
    <p class="eyebrow" data-en="AI health assistant" data-ar="المساعد الصحي">AI health assistant</p>
    <h1 class="display" style="font-size:clamp(1.9rem,4vw,2.8rem)" data-en="Have a conversation about your health" data-ar="تحدثي عن صحتك">Have a conversation about your health</h1>
    <p class="lede" style="margin-top:1rem" data-en="Ask what a word in a report means, organise what you want to say, or prepare questions for your appointment. For symptoms, the assessment is the better place, because it asks the questions that matter and checks for anything urgent." data-ar="اسألي عن معنى مصطلح في تقرير، أو نظّمي ما تودين قوله، أو جهّزي أسئلة لموعدك. أما للأعراض فالتقييم هو المكان الأنسب، لأنه يطرح الأسئلة المهمة ويفحص أي علامة عاجلة.">Ask what a word in a report means, organise what you want to say, or prepare questions for your appointment.</p>
  </div>
</section>

<div class="wrap" style="padding-bottom:3rem">
  <div class="card" id="login" style="max-width:460px;margin-bottom:2rem">
    <h3 data-en="Sign in to keep your conversations" data-ar="سجّلي الدخول لحفظ محادثاتك">Sign in to keep your conversations</h3>
    <label class="lbl" for="email" data-en="Email" data-ar="البريد الإلكتروني">Email</label>
    <input class="field" id="email" type="email" autocomplete="email" style="margin-bottom:.8rem">
    <label class="lbl" for="password" data-en="Password, at least 10 characters" data-ar="كلمة المرور، 10 أحرف على الأقل">Password, at least 10 characters</label>
    <input class="field" id="password" type="password" autocomplete="current-password" style="margin-bottom:1rem">
    <div class="row">
      <button class="btn btn-primary" id="signin" type="button" data-en="Sign in" data-ar="دخول">Sign in</button>
      <button class="btn btn-ghost" id="register" type="button" data-en="Create account" data-ar="إنشاء حساب">Create account</button>
    </div>
  </div>

  <div class="chatbox" id="chatbox" style="display:none">
    <div class="messages" id="messages"></div>
    <form class="composer-bar" id="chat-form">
      <input class="field" id="message" data-en="Ask a question about your health" data-ar="اسألي سؤالًا عن صحتك" placeholder="Ask a question about your health" autocomplete="off">
      <button class="btn btn-primary" type="submit" data-en="Send" data-ar="إرسال">Send</button>
    </form>
  </div>
</div>
"""
page("chat.html", "AI health assistant — HealTrip", CHAT, ["assets/js/chat.js"])


# ---------------------------------------------------------------------------
# Technical console. Not linked from the patient navigation.
# ---------------------------------------------------------------------------
TECHNICAL = """
<section style="padding-bottom:1rem">
  <div class="wrap">
    <p class="eyebrow">Technical console</p>
    <h1 class="display" style="font-size:clamp(1.9rem,4vw,2.8rem)">Architecture, agent, tests and sources</h1>
    <p class="lede" style="margin-top:1rem">Everything an engineer, a reviewer or a clinician would want to inspect, kept out of the patient experience. Numbers come from the suites running live on this server; reload to run them again.</p>
    <div class="row" style="margin-top:1rem">
      <span class="chip" id="api-status">…</span>
      <a class="btn btn-ghost" href="/api/v1/openapi.json" target="_blank" rel="noopener" style="padding:.5rem 1.1rem;font-size:.85rem">OpenAPI document</a>
      <a class="btn btn-ghost" href="index.html" style="padding:.5rem 1.1rem;font-size:.85rem">Back to the patient site</a>
    </div>
  </div>
</section>

<div class="wrap">
  <section style="padding-top:1rem">
    <div class="grid grid-2">
      <div class="card">
        <div class="panel-label">Request path</div>
        <pre class="code">patient text or speech
  -> schema validation (zod)
  -> safety gate: 15 deterministic rules, concepts + negation scope
  -> structured patient state
  -> next-best-question engine
  -> differential with support / contradiction / missing
  -> evidence verification: no registered source, no display
  -> possible evaluations, evidence grounded
  -> care pathway, specialty, provider search
  -> FHIR, printable report, audit</pre>
      </div>
      <div class="card">
        <div class="panel-label">Anti-hallucination path</div>
        <pre class="code">model
  -> tool name + arguments
  -> schema validation
  -> service
  -> PostgreSQL / knowledge base
  -> typed result with source and status
  -> model may quote the result, nothing else
  -> claim screen over the wording</pre>
        <p style="margin-top:1rem;font-size:.9rem;color:var(--mist)">The model has no SQL, no credentials and no table access. A request the schema rejects never reaches a service.</p>
      </div>
    </div>
  </section>

  <section>
    <h2 class="display" style="font-size:1.7rem">Agent tools</h2>
    <div class="card" id="tools" style="margin-top:1.2rem"></div>
  </section>

  <section>
    <h2 class="display" style="font-size:1.7rem">Try the agent</h2>
    <p style="color:var(--mist)">Calls POST /api/v1/agent/chat and renders the execution trace it returns. Ask for a clinician in a city the directory does not cover and watch it refuse to invent one.</p>
    <div class="card" style="margin-top:1.2rem">
      <div class="row" style="flex-wrap:nowrap">
        <input class="field" id="probe" placeholder="Find me a cardiologist in London">
        <button class="btn btn-primary" id="probe-send" type="button">Send</button>
      </div>
      <div id="probe-out" style="margin-top:1.2rem"></div>
    </div>
  </section>

  <section id="eval">
    <h2 class="display" style="font-size:1.7rem">Measured results</h2>
    <div class="grid grid-2" style="margin-top:1.2rem">
      <div class="card"><div class="panel-label">Evaluation suites</div><div id="metrics"><p style="color:var(--mist)">Running…</p></div></div>
      <div class="card"><div class="panel-label">Knowledge layer</div><div id="knowledge"></div></div>
    </div>
  </section>

  <section id="gates">
    <h2 class="display" style="font-size:1.7rem">Clinical readiness gates</h2>
    <p style="color:var(--mist)">Technical readiness is not clinical validation. The engineering gates are checked on every run; the rest need clinicians, a lawyer, a regulator and an independent study.</p>
    <div class="card" id="gatelist" style="margin-top:1.2rem"></div>
  </section>

  <section>
    <h2 class="display" style="font-size:1.7rem">Safety rules</h2>
    <p style="color:var(--mist)">Run on the raw text of every turn, before any reasoning and before any model call.</p>
    <div class="card" id="flags" style="margin-top:1.2rem"></div>
  </section>

  <section id="sources">
    <h2 class="display" style="font-size:1.7rem">Source register</h2>
    <div class="card" id="sourcelist" style="margin-top:1.2rem"></div>
  </section>

  <section>
    <h2 class="display" style="font-size:1.7rem">Endpoints</h2>
    <div class="card" id="endpoints" style="margin-top:1.2rem"></div>
  </section>

  <section>
    <h2 class="display" style="font-size:1.7rem">Candidate explanations</h2>
    <div class="grid grid-3" id="conditions" style="margin-top:1.2rem"></div>
  </section>
</div>
"""
page("technical.html", "Technical console — HealTrip", TECHNICAL, ["assets/js/technical.js"])


# ---------------------------------------------------------------------------
# About
# ---------------------------------------------------------------------------
ABOUT = f"""
<section>
  <div class="wrap">
    <p class="eyebrow" data-en="About HealTrip" data-ar="عن HealTrip">About HealTrip</p>
    <h1 class="display" style="font-size:clamp(1.9rem,4vw,2.8rem)" data-en="Health questions deserve a calmer answer" data-ar="الأسئلة الصحية تستحق إجابة أهدأ">Health questions deserve a calmer answer</h1>
    <p class="lede" style="margin-top:1rem;max-width:62ch" data-en="Most people meet a health worry alone, at night, with a search engine. The first result is rarely the most likely one, and almost never the most useful. HealTrip exists for that moment." data-ar="يواجه معظم الناس القلق الصحي وحدهم، ليلًا، مع محرك بحث. وأول نتيجة نادرًا ما تكون الأرجح، وغالبًا ليست الأنفع. ومن أجل تلك اللحظة وُجد HealTrip.">Most people meet a health worry alone, at night, with a search engine.</p>
  </div>
</section>

<section class="band-sand">
  <div class="wrap grid grid-2" style="align-items:center">
    <div>
      <h2 class="display" style="font-size:1.9rem" data-en="What we set out to build" data-ar="ما سعينا لبنائه">What we set out to build</h2>
      <p style="margin-top:1rem" data-en="Not a machine that names your illness. Something that listens properly, asks the questions a careful clinician would ask, and explains what your answers may point to without pretending to be certain." data-ar="ليس آلة تسمّي مرضك. بل شيء يستمع جيدًا، ويطرح الأسئلة التي يطرحها طبيب متأنٍّ، ويشرح ما قد تشير إليه إجاباتك دون ادعاء اليقين.">Not a machine that names your illness. Something that listens properly and asks the questions a careful clinician would ask.</p>
      <p data-en="Then it does the part most tools skip: it tells you what may happen at the appointment, what a healthcare professional may want to look at and why, and what to bring with you." data-ar="ثم يقوم بالجزء الذي تتجاهله معظم الأدوات: يخبرك بما قد يحدث في الموعد، وما قد يرغب الطبيب في النظر فيه ولماذا، وما الذي تحضرينه معك.">Then it tells you what may happen at the appointment, and what to bring with you.</p>
    </div>
    <div style="border-radius:20px;overflow:hidden;box-shadow:var(--shadow)">
      <img src="media/clinician-call.jpg" alt="A clinician on a video call" style="height:340px;object-fit:cover;width:100%">
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="section-head"><h2 class="display" data-en="What we will not do" data-ar="ما لن نفعله">What we will not do</h2>
      <p data-en="A health service earns trust by being clear about its limits before it lists what it can do." data-ar="الخدمة الصحية تكسب الثقة بوضوح حدودها قبل أن تعدد ما تستطيعه.">A health service earns trust by being clear about its limits.</p></div>
    <div class="grid grid-2">
      <div class="card"><h3 data-en="We will not name your diagnosis" data-ar="لن نسمّي تشخيصك">We will not name your diagnosis</h3><p data-en="You will see possibilities that may be compatible with what you described, and the wording says exactly that." data-ar="سترين احتمالات قد تتوافق مع ما وصفتِه، والصياغة تقول ذلك بوضوح.">You will see possibilities that may be compatible with what you described.</p></div>
      <div class="card"><h3 data-en="We will not tell you which test to get" data-ar="لن نخبرك بالفحص الذي تجرينه">We will not tell you which test to get</h3><p data-en="Choosing an evaluation depends on your examination, age and history. We explain what a clinician may consider, and why." data-ar="اختيار الفحص يعتمد على فحصك وعمرك وتاريخك. ونحن نوضح ما قد يفكر فيه الطبيب ولماذا.">Choosing an evaluation depends on your examination, age and history.</p></div>
      <div class="card"><h3 data-en="We will not invent a doctor" data-ar="لن نخترع طبيبًا">We will not invent a doctor</h3><p data-en="Every professional shown comes from our directory, with its source visible. If there is no match, we say so." data-ar="كل طبيب يُعرض يأتي من دليلنا، ومصدره ظاهر. وإذا لم توجد نتيجة نقول ذلك.">Every professional shown comes from our directory, with its source visible.</p></div>
      <div class="card"><h3 data-en="We will not guess a price" data-ar="لن نخمّن سعرًا">We will not guess a price</h3><p data-en="Cost and availability vary by place and provider. We tell you to ask the clinic rather than showing a number we cannot stand behind." data-ar="تختلف التكلفة والتوفر حسب المكان ومقدم الخدمة. ونطلب منك سؤال المركز الطبي بدل عرض رقم لا نستطيع ضمانه.">Cost and availability vary by place and provider.</p></div>
    </div>
  </div>
</section>

<section id="privacy" class="band-sage">
  <div class="wrap">
    <div class="section-head"><h2 class="display" data-en="Your health information" data-ar="معلوماتك الصحية">Your health information</h2></div>
    <div class="grid grid-3">
      <div class="card"><h3 data-en="It stays yours" data-ar="تبقى ملكك">It stays yours</h3><p data-en="What you enter stays in your session or your profile, and you can delete any of it at any time." data-ar="ما تدخلينه يبقى في جلستك أو ملفك، ويمكنك حذف أي منه في أي وقت.">What you enter stays in your session or your profile.</p></div>
      <div class="card"><h3 data-en="Nothing is assumed" data-ar="لا يُفترض شيء">Nothing is assumed</h3><p data-en="Anything you add is recorded as something you reported, until a healthcare professional confirms it." data-ar="أي شيء تضيفينه يُسجَّل كشيء ذكرتِه، حتى يؤكده طبيب.">Anything you add is recorded as something you reported.</p></div>
      <div class="card"><h3 data-en="You can take it with you" data-ar="يمكنك أخذها معك">You can take it with you</h3><p data-en="Every assessment produces a summary you can print and hand to a healthcare professional." data-ar="كل تقييم ينتج ملخصًا يمكنك طباعته وتسليمه للطبيب.">Every assessment produces a summary you can print.</p></div>
    </div>
    <p style="text-align:center;margin-top:2rem"><a class="btn btn-primary" href="assessment.html" data-en="Start your assessment" data-ar="ابدئي تقييمك">Start your assessment</a></p>
  </div>
</section>
"""
page("about.html", "About — HealTrip", ABOUT, desc="Why HealTrip exists, what it does, and what it deliberately will not do.")


# ---------------------------------------------------------------------------
# How it works
# ---------------------------------------------------------------------------
HOW = f"""
<section>
  <div class="wrap">
    <p class="eyebrow" data-en="How it works" data-ar="كيف يعمل">How it works</p>
    <h1 class="display" style="font-size:clamp(1.9rem,4vw,2.8rem)" data-en="From what you feel to what to do next" data-ar="من شعورك إلى خطوتك التالية">From what you feel to what to do next</h1>
    <p class="lede" style="margin-top:1rem;max-width:60ch" data-en="Five steps. You can stop at any point, and nothing is kept unless you want it kept." data-ar="خمس خطوات. يمكنك التوقف في أي لحظة، ولا يُحفظ شيء إلا إذا أردتِ ذلك.">Five steps. You can stop at any point.</p>
  </div>
</section>

<section class="band-sand">
  <div class="wrap">
    <div class="steps">
      <div class="step"><span class="step-n">01</span><h3 data-en="You describe it" data-ar="تصفين ما تشعرين به">You describe it</h3><p data-en="In your own words, typed or spoken, in Arabic or English. No medical terms needed." data-ar="بكلماتك، كتابة أو صوتًا، بالعربية أو الإنجليزية. دون حاجة لمصطلحات طبية.">In your own words, typed or spoken.</p></div>
      <div class="step"><span class="step-n">02</span><h3 data-en="We check for anything urgent" data-ar="نفحص أي علامة عاجلة">We check for anything urgent</h3><p data-en="Before anything else. If something needs urgent attention, we say so immediately and stop asking questions." data-ar="قبل أي شيء آخر. وإذا كان هناك ما يحتاج اهتمامًا عاجلًا نقول ذلك فورًا ونتوقف عن الأسئلة.">Before anything else, and we stop asking questions if it matters.</p></div>
      <div class="step"><span class="step-n">03</span><h3 data-en="We ask what matters" data-ar="نسأل ما يهم">We ask what matters</h3><p data-en="Each question follows from your last answer, with the reason it was asked shown next to it." data-ar="كل سؤال ينبع من إجابتك السابقة، ومعه سبب طرحه.">Each question follows from your last answer.</p></div>
      <div class="step"><span class="step-n">04</span><h3 data-en="We explain, with sources" data-ar="نشرح، مع المصادر">We explain, with sources</h3><p data-en="What may be relevant, what supports it, what is still unclear, and where the information came from." data-ar="ما قد يكون ذا صلة، وما يدعمه، وما لم يتضح بعد، ومن أين جاءت المعلومة.">What may be relevant, and where the information came from.</p></div>
      <div class="step"><span class="step-n">05</span><h3 data-en="You go prepared" data-ar="تذهبين مستعدة">You go prepared</h3><p data-en="What a clinician may consider, what to bring, and which kind of professional to look for." data-ar="ما قد يفكر فيه الطبيب، وما تحضرينه، وأي تخصص تبحثين عنه.">What a clinician may consider, and what to bring.</p></div>
    </div>
  </div>
</section>

<section>
  <div class="wrap grid grid-2" style="align-items:center">
    <div>
      <h2 class="display" style="font-size:1.9rem" data-en="Questions that actually follow on" data-ar="أسئلة تتابع فعلًا">Questions that actually follow on</h2>
      <p style="margin-top:1rem" data-en="A questionnaire asks everyone the same thing. A good clinician asks the one question your last answer made important. That is what we tried to build." data-ar="الاستبيان يسأل الجميع الشيء نفسه. أما الطبيب الجيد فيسأل السؤال الذي جعلته إجابتك الأخيرة مهمًا. وهذا ما حاولنا بناءه.">A questionnaire asks everyone the same thing. A good clinician asks the one question your last answer made important.</p>
      <div class="chat-sample">
        <div class="bubble you" data-en="I've had chest discomfort for two days." data-ar="عندي انزعاج في الصدر منذ يومين.">I've had chest discomfort for two days.</div>
        <div class="bubble ht" data-en="Does it come on with effort, or also while you're resting?" data-ar="هل يظهر مع المجهود أم أيضًا أثناء الراحة؟">Does it come on with effort, or also while you're resting?</div>
        <div class="bubble you" data-en="Only when I move or twist." data-ar="فقط عند الحركة أو الالتفاف.">Only when I move or twist.</div>
        <div class="bubble ht" data-en="If you press on the sore spot, does the same discomfort come back?" data-ar="إذا ضغطتِ على المكان المؤلم، هل يعود نفس الانزعاج؟">If you press on the sore spot, does the same discomfort come back?</div>
      </div>
    </div>
    <div style="border-radius:20px;overflow:hidden;box-shadow:var(--shadow)">
      <img src="media/clinician-desk.jpg" alt="A clinician taking notes" style="height:380px;object-fit:cover;width:100%">
    </div>
  </div>
</section>

<section id="faq" class="band-sand">
  <div class="wrap">
    <div class="section-head"><h2 class="display" data-en="Questions people ask" data-ar="أسئلة يطرحها الناس">Questions people ask</h2></div>
    <div class="faq">
      <details open><summary data-en="Is HealTrip a doctor?" data-ar="هل HealTrip طبيب؟">Is HealTrip a doctor?</summary><p data-en="No. It helps you understand health information and find your way towards appropriate care. Medical decisions belong with a licensed healthcare professional." data-ar="لا. يساعدك على فهم المعلومات الصحية والوصول إلى الرعاية المناسبة. أما القرارات الطبية فهي من اختصاص طبيب مرخّص.">No. Medical decisions belong with a licensed healthcare professional.</p></details>
      <details><summary data-en="Does it diagnose?" data-ar="هل يشخّص؟">Does it diagnose?</summary><p data-en="No. It explains possibilities that may be compatible with what you described, so you can discuss them with a healthcare professional." data-ar="لا. يشرح احتمالات قد تتوافق مع ما وصفتِه، لتناقشيها مع الطبيب.">No. It explains possibilities that may be compatible with what you described.</p></details>
      <details><summary data-en="Will it tell me which tests I need?" data-ar="هل يخبرني بالفحوصات التي أحتاجها؟">Will it tell me which tests I need?</summary><p data-en="It explains what a clinician may consider and why it may be useful. The professional decides what is appropriate after your history and examination." data-ar="يشرح ما قد يفكر فيه الطبيب ولماذا قد يكون مفيدًا. والطبيب يقرر المناسب بعد التاريخ المرضي والفحص.">It explains what a clinician may consider and why it may be useful.</p></details>
      <details><summary data-en="What happens if something looks urgent?" data-ar="ماذا يحدث إذا بدا الأمر عاجلًا؟">What happens if something looks urgent?</summary><p data-en="The questions stop immediately and you are told to seek urgent care. Nothing else is shown above that message." data-ar="تتوقف الأسئلة فورًا ويُطلب منك طلب رعاية عاجلة. ولا يُعرض شيء آخر فوق تلك الرسالة.">The questions stop immediately and you are told to seek urgent care.</p></details>
      <details><summary data-en="Can I use Arabic?" data-ar="هل يمكنني استخدام العربية؟">Can I use Arabic?</summary><p data-en="Yes. The questions, the explanations, the assistant and the printable summary all work in Arabic and English." data-ar="نعم. الأسئلة والشروحات والمساعد والملخص القابل للطباعة تعمل كلها بالعربية والإنجليزية.">Yes, everything works in Arabic and English.</p></details>
      <details><summary data-en="Can I speak instead of typing?" data-ar="هل أستطيع التحدث بدل الكتابة؟">Can I speak instead of typing?</summary><p data-en="Yes, where your device supports it. We wait while you think, and we don't cut you off at the first pause." data-ar="نعم، حيثما يدعم جهازك ذلك. ننتظر أثناء تفكيرك ولا نقاطعك عند أول توقف.">Yes. We wait while you think.</p></details>
      <details><summary data-en="What happens to what I write?" data-ar="ماذا يحدث لما أكتبه؟">What happens to what I write?</summary><p data-en="It stays in your session, or in your profile if you sign in, and you can delete it at any time." data-ar="يبقى في جلستك، أو في ملفك إذا سجّلتِ الدخول، ويمكنك حذفه في أي وقت.">It stays in your session or your profile, and you can delete it.</p></details>
    </div>
    <p style="text-align:center;margin-top:2rem"><a class="btn btn-primary" href="assessment.html" data-en="Start your assessment" data-ar="ابدئي تقييمك">Start your assessment</a></p>
  </div>
</section>
"""
page("how-it-works.html", "How it works — HealTrip", HOW, desc="How a HealTrip assessment works, step by step, and the questions people ask most.")


# ---------------------------------------------------------------------------
# Hospitals
# ---------------------------------------------------------------------------
HOSPITALS = """
<section style="padding-bottom:1.4rem">
  <div class="wrap">
    <p class="eyebrow" data-en="Hospitals and facilities" data-ar="المستشفيات والمنشآت">Hospitals and facilities</p>
    <h1 class="display" style="font-size:clamp(1.9rem,4vw,2.8rem)" data-en="Find care near you" data-ar="اعثري على رعاية قريبة منك">Find care near you</h1>
    <p class="lede" style="margin-top:1rem" data-en="Explore facilities by the kind of care you may be looking for, including which have an emergency department." data-ar="استكشفي المنشآت حسب نوع الرعاية التي تبحثين عنها، بما في ذلك التي لديها قسم طوارئ.">Explore facilities by the kind of care you may be looking for.</p>
  </div>
</section>

<div class="wrap" style="padding-bottom:3rem">
  <div class="card" style="margin-bottom:2rem">
    <div class="row">
      <select class="field" id="f-specialty" style="width:auto;min-width:190px" aria-label="Specialty"><option value="" data-en="All specialties" data-ar="كل التخصصات">All specialties</option></select>
      <select class="field" id="f-country" style="width:auto;min-width:180px" aria-label="Country"><option value="" data-en="All countries" data-ar="كل الدول">All countries</option></select>
      <input class="field" id="f-city" style="width:auto;min-width:150px" data-en="City" data-ar="المدينة" placeholder="City" aria-label="City">
      <button class="btn btn-primary" id="search" type="button" data-en="Search" data-ar="بحث">Search</button>
    </div>
  </div>
  <div class="grid grid-3" id="hospitals-list"></div>
</div>
"""
page("hospitals.html", "Hospitals — HealTrip", HOSPITALS, ["assets/js/network.js"])


# the interface reads the same locale bundles the service reads
(OUT / "locales").mkdir(exist_ok=True)
for f in LOCALES_SRC.glob("*.json"):
    shutil.copy(f, OUT / "locales" / f.name)
    print("copied locale", f.name)

for stale in ("docs.html", "evidence.html"):
    target = OUT / stale
    if target.exists():
        target.unlink()
        print("removed", stale)
