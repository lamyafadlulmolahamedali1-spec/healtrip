-- HealTrip migration 003: structured clinical evaluations.
-- Additive only. Existing installations are unaffected, and the API works
-- without these tables because the knowledge layer is the source of truth.
-- They exist so evaluations can be curated, versioned and reviewed in the
-- database once a clinician is signing entries off.

create table if not exists clinical_evaluations (
  id            text primary key,
  eval_type     text not null,                 -- laboratory | imaging | bedside test | clinical examination | procedure
  name_en       text not null,
  name_ar       text not null,
  why_en        text not null,
  why_ar        text not null,
  question_en   text not null,                 -- the clinical question it may help answer
  question_ar   text not null,
  expect_en     text,
  expect_ar     text,
  preparation_en text,                         -- null means none indicated; never invented
  preparation_ar text,
  safety_relevant boolean not null default false,
  confidence    text not null default 'evidence_supported',
  reviewed_by   text,                          -- clinician sign-off, empty until reviewed
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- Which candidate explanations an evaluation may help assess.
create table if not exists clinical_evaluation_links (
  evaluation_id text not null references clinical_evaluations(id) on delete cascade,
  condition_id  text not null,
  primary key (evaluation_id, condition_id)
);
create index if not exists clinical_evaluation_links_condition_idx on clinical_evaluation_links (condition_id);

-- Every evaluation must carry at least one registered source to be shown.
create table if not exists clinical_evaluation_evidence (
  evaluation_id text not null references clinical_evaluations(id) on delete cascade,
  source_id     text not null references evidence_sources(id),
  retrieved_at  timestamptz not null default now(),
  primary key (evaluation_id, source_id)
);

-- Costs are deliberately absent. HealTrip does not store or estimate prices,
-- because an unsourced number shown to a patient is worse than none.
