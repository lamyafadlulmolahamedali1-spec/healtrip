'use strict';

/**
 * Provider directory.
 *
 * Every record carries its own provenance. `source` is "Demo registry" for all
 * seeded records, and the UI shows that label instead of a verification badge.
 * A record only becomes "Verified" when an importer has written a real
 * licensing-authority reference and a verification timestamp (see
 * docs/PROVIDER_VERIFICATION.md). Nothing here is a real practitioner.
 */

const DOCTORS = [
  {
    id: 'demo-001', full_name: 'Dr. Amina Rahman', specialty: 'Cardiology', subspecialty: 'Non-invasive cardiology',
    qualifications: 'MBBS, MRCP', licensing_authority: null, license_number: null, license_status: 'unverified',
    country: 'United Kingdom', city: 'London', languages: ['English', 'Arabic'], telemedicine: true,
    organization: 'Thameside Heart Clinic', source: 'Demo registry', source_url: null, verified_at: null,
    contact_email: null, contact_source: null, profile_url: null, registry_profile_url: null,
    certificates: [], years_experience: null, consultation_modes: [],
  },
  {
    id: 'demo-002', full_name: 'Dr. Omar Hassan', specialty: 'General Practice', subspecialty: 'Family medicine',
    qualifications: 'MBBCh, MRCGP', licensing_authority: null, license_number: null, license_status: 'unverified',
    country: 'United Kingdom', city: 'Manchester', languages: ['English', 'Arabic'], telemedicine: true,
    organization: 'Northgate Family Practice', source: 'Demo registry', source_url: null, verified_at: null,
    contact_email: null, contact_source: null, profile_url: null, registry_profile_url: null,
    certificates: [], years_experience: null, consultation_modes: [],
  },
  {
    id: 'demo-003', full_name: 'Dr. Lina Ahmed', specialty: 'Neurology', subspecialty: 'Headache medicine',
    qualifications: 'MD, PhD', licensing_authority: null, license_number: null, license_status: 'unverified',
    country: 'Saudi Arabia', city: 'Riyadh', languages: ['Arabic', 'English'], telemedicine: true,
    organization: 'Riyadh Neuroscience Centre', source: 'Demo registry', source_url: null, verified_at: null,
    contact_email: null, contact_source: null, profile_url: null, registry_profile_url: null,
    certificates: [], years_experience: null, consultation_modes: [],
  },
  {
    id: 'demo-004', full_name: 'Dr. Yusuf Bashir', specialty: 'Gastroenterology', subspecialty: 'Upper GI',
    qualifications: 'MBBS, FRCP', licensing_authority: null, license_number: null, license_status: 'unverified',
    country: 'United Arab Emirates', city: 'Dubai', languages: ['Arabic', 'English', 'Urdu'], telemedicine: false,
    organization: 'Creekside Digestive Health', source: 'Demo registry', source_url: null, verified_at: null,
    contact_email: null, contact_source: null, profile_url: null, registry_profile_url: null,
    certificates: [], years_experience: null, consultation_modes: [],
  },
  {
    id: 'demo-005', full_name: 'Dr. Sara Elmahdi', specialty: 'General Surgery', subspecialty: 'Emergency surgery',
    qualifications: 'MBBS, MRCS', licensing_authority: null, license_number: null, license_status: 'unverified',
    country: 'Sudan', city: 'Khartoum', languages: ['Arabic', 'English'], telemedicine: false,
    organization: 'Blue Nile Surgical Unit', source: 'Demo registry', source_url: null, verified_at: null,
    contact_email: null, contact_source: null, profile_url: null, registry_profile_url: null,
    certificates: [], years_experience: null, consultation_modes: [],
  },
  {
    id: 'demo-006', full_name: 'Dr. Noor Al-Tamimi', specialty: 'Dermatology', subspecialty: 'Allergy and eczema',
    qualifications: 'MD, MSc', licensing_authority: null, license_number: null, license_status: 'unverified',
    country: 'Saudi Arabia', city: 'Jeddah', languages: ['Arabic', 'English'], telemedicine: true,
    organization: 'Jeddah Skin Institute', source: 'Demo registry', source_url: null, verified_at: null,
    contact_email: null, contact_source: null, profile_url: null, registry_profile_url: null,
    certificates: [], years_experience: null, consultation_modes: [],
  },
  {
    id: 'demo-007', full_name: 'Dr. Hana Farouk', specialty: 'Internal Medicine', subspecialty: 'General internal medicine',
    qualifications: 'MBBS, MRCP', licensing_authority: null, license_number: null, license_status: 'unverified',
    country: 'Egypt', city: 'Cairo', languages: ['Arabic', 'English', 'French'], telemedicine: true,
    organization: 'Nile Medical Centre', source: 'Demo registry', source_url: null, verified_at: null,
    contact_email: null, contact_source: null, profile_url: null, registry_profile_url: null,
    certificates: [], years_experience: null, consultation_modes: [],
  },
  {
    id: 'demo-008', full_name: 'Dr. Karim Nasser', specialty: 'Orthopaedics', subspecialty: 'Spine',
    qualifications: 'MD, FRCS', licensing_authority: null, license_number: null, license_status: 'unverified',
    country: 'United Kingdom', city: 'Birmingham', languages: ['English', 'Arabic'], telemedicine: false,
    organization: 'Midlands Spine Unit', source: 'Demo registry', source_url: null, verified_at: null,
    contact_email: null, contact_source: null, profile_url: null, registry_profile_url: null,
    certificates: [], years_experience: null, consultation_modes: [],
  },
  {
    id: 'demo-009', full_name: 'Dr. Salma Idris', specialty: 'ENT', subspecialty: 'Otology and balance',
    qualifications: 'MBBS, FRCS (ORL)', licensing_authority: null, license_number: null, license_status: 'unverified',
    country: 'Sudan', city: 'Khartoum', languages: ['Arabic', 'English'], telemedicine: true,
    organization: 'Omdurman ENT Centre', source: 'Demo registry', source_url: null, verified_at: null,
    contact_email: null, contact_source: null, profile_url: null, registry_profile_url: null,
    certificates: [], years_experience: null, consultation_modes: [],
  },
  {
    id: 'demo-010', full_name: 'Dr. Faisal Khan', specialty: 'Urology', subspecialty: 'Stone disease',
    qualifications: 'MBBS, FEBU', licensing_authority: null, license_number: null, license_status: 'unverified',
    country: 'United Arab Emirates', city: 'Abu Dhabi', languages: ['Arabic', 'English', 'Urdu'], telemedicine: false,
    organization: 'Corniche Urology Unit', source: 'Demo registry', source_url: null, verified_at: null,
    contact_email: null, contact_source: null, profile_url: null, registry_profile_url: null,
    certificates: [], years_experience: null, consultation_modes: [],
  },
  {
    id: 'demo-011', full_name: 'Dr. Maya Haddad', specialty: 'Ophthalmology', subspecialty: 'Anterior segment',
    qualifications: 'MD, FRCOphth', licensing_authority: null, license_number: null, license_status: 'unverified',
    country: 'United Kingdom', city: 'London', languages: ['English', 'Arabic', 'French'], telemedicine: false,
    organization: 'Bloomsbury Eye Clinic', source: 'Demo registry', source_url: null, verified_at: null,
    contact_email: null, contact_source: null, profile_url: null, registry_profile_url: null,
    certificates: [], years_experience: null, consultation_modes: [],
  },
  {
    id: 'demo-012', full_name: 'Dr. Tarek Saleh', specialty: 'Endocrinology', subspecialty: 'Diabetes',
    qualifications: 'MBBCh, MRCP (Endo)', licensing_authority: null, license_number: null, license_status: 'unverified',
    country: 'Egypt', city: 'Alexandria', languages: ['Arabic', 'English'], telemedicine: true,
    organization: 'Delta Diabetes Institute', source: 'Demo registry', source_url: null, verified_at: null,
    contact_email: null, contact_source: null, profile_url: null, registry_profile_url: null,
    certificates: [], years_experience: null, consultation_modes: [],
  },
];

const HOSPITALS = [
  { id: 'hos-001', name: 'Thameside General Hospital', city: 'London', country: 'United Kingdom', emergency: true, specialties: ['Cardiology', 'General Surgery', 'Internal Medicine'], lat: 51.5074, lng: -0.1278, source: 'Demo registry' },
  { id: 'hos-002', name: 'Northgate Royal Infirmary', city: 'Manchester', country: 'United Kingdom', emergency: true, specialties: ['General Practice', 'Orthopaedics', 'Neurology'], lat: 53.4808, lng: -2.2426, source: 'Demo registry' },
  { id: 'hos-003', name: 'Riyadh Central Medical City', city: 'Riyadh', country: 'Saudi Arabia', emergency: true, specialties: ['Neurology', 'Cardiology', 'Dermatology'], lat: 24.7136, lng: 46.6753, source: 'Demo registry' },
  { id: 'hos-004', name: 'Creek Specialist Hospital', city: 'Dubai', country: 'United Arab Emirates', emergency: true, specialties: ['Gastroenterology', 'Internal Medicine'], lat: 25.2048, lng: 55.2708, source: 'Demo registry' },
  { id: 'hos-005', name: 'Khartoum Teaching Hospital', city: 'Khartoum', country: 'Sudan', emergency: true, specialties: ['General Surgery', 'General Practice'], lat: 15.5007, lng: 32.5599, source: 'Demo registry' },
  { id: 'hos-006', name: 'Jeddah Coastal Hospital', city: 'Jeddah', country: 'Saudi Arabia', emergency: false, specialties: ['Dermatology', 'General Practice'], lat: 21.4858, lng: 39.1925, source: 'Demo registry' },
];

/** Registries a future importer can write into. No live integration is shipped. */
const AUTHORITIES = [
  { code: 'GMC', name: 'General Medical Council', country: 'United Kingdom', register_url: 'https://www.gmc-uk.org/registration-and-licensing/our-registers', bulk_license_required: true },
  { code: 'SCFHS', name: 'Saudi Commission for Health Specialties', country: 'Saudi Arabia', register_url: 'https://scfhs.org.sa/en', bulk_license_required: true },
  { code: 'DHA', name: 'Dubai Health Authority', country: 'United Arab Emirates', register_url: 'https://www.dha.gov.ae/', bulk_license_required: true },
];

function searchDoctors({ specialty, country, city, language, telemedicine } = {}) {
  return DOCTORS.filter((d) => {
    if (specialty && d.specialty.toLowerCase() !== String(specialty).toLowerCase()) return false;
    if (country && d.country.toLowerCase() !== String(country).toLowerCase()) return false;
    if (city && d.city.toLowerCase() !== String(city).toLowerCase()) return false;
    if (language && !d.languages.some((l) => l.toLowerCase() === String(language).toLowerCase())) return false;
    if (telemedicine === true && !d.telemedicine) return false;
    return true;
  });
}

function searchHospitals({ specialty, country, city, emergency } = {}) {
  return HOSPITALS.filter((h) => {
    if (specialty && !h.specialties.some((s) => s.toLowerCase() === String(specialty).toLowerCase())) return false;
    if (country && h.country.toLowerCase() !== String(country).toLowerCase()) return false;
    if (city && h.city.toLowerCase() !== String(city).toLowerCase()) return false;
    if (emergency === true && !h.emergency) return false;
    return true;
  });
}

function verifyLicense(doctorId) {
  const d = DOCTORS.find((x) => x.id === doctorId);
  if (!d) return { found: false };
  return {
    found: true,
    doctor_id: d.id,
    license_status: d.license_status,
    licensing_authority: d.licensing_authority,
    verified_at: d.verified_at,
    note: 'This record comes from the demo registry. Connect a licensing-authority importer before showing any verification badge.',
    authorities: AUTHORITIES,
  };
}

module.exports = { DOCTORS, HOSPITALS, AUTHORITIES, searchDoctors, searchHospitals, verifyLicense };
