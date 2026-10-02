-- HealTrip seed data. Every provider record is demo data: no real practitioner, no licence checked.

insert into doctors (id, full_name, specialty, subspecialty, qualifications, licensing_authority, license_number, license_status, country, city, languages, telemedicine, organization, source, verified_at) values
  ('demo-001', 'Dr. Amina Rahman', 'Cardiology', 'Non-invasive cardiology', 'MBBS, MRCP', null, null, 'unverified', 'United Kingdom', 'London', ARRAY['English','Arabic']::text[], true, 'Thameside Heart Clinic', 'Demo registry', null),
  ('demo-002', 'Dr. Omar Hassan', 'General Practice', 'Family medicine', 'MBBCh, MRCGP', null, null, 'unverified', 'United Kingdom', 'Manchester', ARRAY['English','Arabic']::text[], true, 'Northgate Family Practice', 'Demo registry', null),
  ('demo-003', 'Dr. Lina Ahmed', 'Neurology', 'Headache medicine', 'MD, PhD', null, null, 'unverified', 'Saudi Arabia', 'Riyadh', ARRAY['Arabic','English']::text[], true, 'Riyadh Neuroscience Centre', 'Demo registry', null),
  ('demo-004', 'Dr. Yusuf Bashir', 'Gastroenterology', 'Upper GI', 'MBBS, FRCP', null, null, 'unverified', 'United Arab Emirates', 'Dubai', ARRAY['Arabic','English','Urdu']::text[], false, 'Creekside Digestive Health', 'Demo registry', null),
  ('demo-005', 'Dr. Sara Elmahdi', 'General Surgery', 'Emergency surgery', 'MBBS, MRCS', null, null, 'unverified', 'Sudan', 'Khartoum', ARRAY['Arabic','English']::text[], false, 'Blue Nile Surgical Unit', 'Demo registry', null),
  ('demo-006', 'Dr. Noor Al-Tamimi', 'Dermatology', 'Allergy and eczema', 'MD, MSc', null, null, 'unverified', 'Saudi Arabia', 'Jeddah', ARRAY['Arabic','English']::text[], true, 'Jeddah Skin Institute', 'Demo registry', null),
  ('demo-007', 'Dr. Hana Farouk', 'Internal Medicine', 'General internal medicine', 'MBBS, MRCP', null, null, 'unverified', 'Egypt', 'Cairo', ARRAY['Arabic','English','French']::text[], true, 'Nile Medical Centre', 'Demo registry', null),
  ('demo-008', 'Dr. Karim Nasser', 'Orthopaedics', 'Spine', 'MD, FRCS', null, null, 'unverified', 'United Kingdom', 'Birmingham', ARRAY['English','Arabic']::text[], false, 'Midlands Spine Unit', 'Demo registry', null),
  ('demo-009', 'Dr. Salma Idris', 'ENT', 'Otology and balance', 'MBBS, FRCS (ORL)', null, null, 'unverified', 'Sudan', 'Khartoum', ARRAY['Arabic','English']::text[], true, 'Omdurman ENT Centre', 'Demo registry', null),
  ('demo-010', 'Dr. Faisal Khan', 'Urology', 'Stone disease', 'MBBS, FEBU', null, null, 'unverified', 'United Arab Emirates', 'Abu Dhabi', ARRAY['Arabic','English','Urdu']::text[], false, 'Corniche Urology Unit', 'Demo registry', null),
  ('demo-011', 'Dr. Maya Haddad', 'Ophthalmology', 'Anterior segment', 'MD, FRCOphth', null, null, 'unverified', 'United Kingdom', 'London', ARRAY['English','Arabic','French']::text[], false, 'Bloomsbury Eye Clinic', 'Demo registry', null),
  ('demo-012', 'Dr. Tarek Saleh', 'Endocrinology', 'Diabetes', 'MBBCh, MRCP (Endo)', null, null, 'unverified', 'Egypt', 'Alexandria', ARRAY['Arabic','English']::text[], true, 'Delta Diabetes Institute', 'Demo registry', null)
on conflict (id) do nothing;

insert into hospitals (id, name, city, country, emergency, specialties, lat, lng, source) values
  ('hos-001', 'Thameside General Hospital', 'London', 'United Kingdom', true, ARRAY['Cardiology','General Surgery','Internal Medicine']::text[], 51.5074, -0.1278, 'Demo registry'),
  ('hos-002', 'Northgate Royal Infirmary', 'Manchester', 'United Kingdom', true, ARRAY['General Practice','Orthopaedics','Neurology']::text[], 53.4808, -2.2426, 'Demo registry'),
  ('hos-003', 'Riyadh Central Medical City', 'Riyadh', 'Saudi Arabia', true, ARRAY['Neurology','Cardiology','Dermatology']::text[], 24.7136, 46.6753, 'Demo registry'),
  ('hos-004', 'Creek Specialist Hospital', 'Dubai', 'United Arab Emirates', true, ARRAY['Gastroenterology','Internal Medicine']::text[], 25.2048, 55.2708, 'Demo registry'),
  ('hos-005', 'Khartoum Teaching Hospital', 'Khartoum', 'Sudan', true, ARRAY['General Surgery','General Practice']::text[], 15.5007, 32.5599, 'Demo registry'),
  ('hos-006', 'Jeddah Coastal Hospital', 'Jeddah', 'Saudi Arabia', false, ARRAY['Dermatology','General Practice']::text[], 21.4858, 39.1925, 'Demo registry')
on conflict (id) do nothing;

insert into evidence_sources (id, title, publisher, url, source_type, tier) values
  ('who_ai_health', 'Ethics and governance of artificial intelligence for health', 'World Health Organization', 'https://www.who.int/publications/i/item/9789240029200', 'guidance', 1),
  ('nice_chest_pain', 'Recent-onset chest pain of suspected cardiac origin (CG95)', 'NICE (UK)', 'https://www.nice.org.uk/guidance/cg95', 'clinical guideline', 1),
  ('nice_headache', 'Headaches in over 12s: diagnosis and management (CG150)', 'NICE (UK)', 'https://www.nice.org.uk/guidance/cg150', 'clinical guideline', 1),
  ('nice_sepsis', 'Suspected sepsis: recognition, diagnosis and early management (NG51)', 'NICE (UK)', 'https://www.nice.org.uk/guidance/ng51', 'clinical guideline', 1),
  ('nice_low_back', 'Low back pain and sciatica in over 16s (NG59)', 'NICE (UK)', 'https://www.nice.org.uk/guidance/ng59', 'clinical guideline', 1),
  ('cdc_stroke', 'Stroke signs and symptoms', 'US Centers for Disease Control and Prevention', 'https://www.cdc.gov/stroke/signs-symptoms/', 'public health reference', 1),
  ('medlineplus', 'MedlinePlus health topics', 'US National Library of Medicine', 'https://medlineplus.gov/', 'general medical reference', 4),
  ('nhs_conditions', 'Health A to Z', 'NHS (UK)', 'https://www.nhs.uk/conditions/', 'general medical reference', 3),
  ('hl7_fhir', 'FHIR R4 specification', 'HL7 International', 'https://hl7.org/fhir/R4/', 'interoperability standard', 2)
on conflict (id) do nothing;
