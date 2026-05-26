insert into public.source_connectors (
  slug,
  name,
  official_organization,
  base_url,
  source_family,
  is_official,
  free_for_demo,
  runtime_allowed,
  api_key_required,
  notes
) values
  (
    'dailymed',
    'DailyMed',
    'U.S. National Library of Medicine',
    'https://dailymed.nlm.nih.gov/dailymed/services/v2',
    'medical',
    true,
    true,
    false,
    false,
    'Drug label ingestion and SPL metadata. Backend import only.'
  ),
  (
    'openfda_label',
    'openFDA Drug Label',
    'U.S. Food and Drug Administration',
    'https://api.fda.gov/drug/label.json',
    'medical',
    true,
    true,
    false,
    true,
    'FDA drug label JSON ingestion. Backend import only.'
  ),
  (
    'openfda_ndc',
    'openFDA NDC Directory',
    'U.S. Food and Drug Administration',
    'https://api.fda.gov/drug/ndc.json',
    'medical',
    true,
    true,
    false,
    true,
    'NDC product metadata. Backend import only.'
  ),
  (
    'openfda_enforcement',
    'openFDA Drug Enforcement',
    'U.S. Food and Drug Administration',
    'https://api.fda.gov/drug/enforcement.json',
    'medical',
    true,
    true,
    false,
    true,
    'Drug recall and enforcement metadata. Backend import only.'
  ),
  (
    'rxnorm',
    'RxNorm',
    'U.S. National Library of Medicine',
    'https://rxnav.nlm.nih.gov/REST',
    'medical',
    true,
    true,
    false,
    false,
    'Drug name and RxCUI normalization. Backend import only.'
  ),
  (
    'rxterms',
    'RxTerms',
    'U.S. National Library of Medicine',
    'https://rxnav.nlm.nih.gov/REST',
    'medical',
    true,
    true,
    false,
    false,
    'Consumer-friendly drug display names. Backend import only.'
  ),
  (
    'rxclass',
    'RxClass',
    'U.S. National Library of Medicine',
    'https://rxnav.nlm.nih.gov/REST/rxclass',
    'medical',
    true,
    true,
    false,
    false,
    'Drug class mapping. Backend import only.'
  ),
  (
    'medlineplus_connect',
    'MedlinePlus Connect',
    'U.S. National Library of Medicine',
    'https://connect.medlineplus.gov/service',
    'medical',
    true,
    true,
    false,
    false,
    'Patient education links and context. Backend import only.'
  ),
  (
    'nhs_website_content',
    'NHS Website Content API',
    'NHS England',
    'https://api.nhs.uk',
    'medical',
    true,
    true,
    false,
    true,
    'English patient education content. Backend import only.'
  )
on conflict (slug) do update set
  name = excluded.name,
  official_organization = excluded.official_organization,
  base_url = excluded.base_url,
  source_family = excluded.source_family,
  is_official = excluded.is_official,
  free_for_demo = excluded.free_for_demo,
  runtime_allowed = false,
  api_key_required = excluded.api_key_required,
  notes = excluded.notes,
  updated_at = now();

insert into public.medical_entities (
  entity_type,
  canonical_name,
  display_name,
  description,
  metadata
) values
  ('scenario', 'cold_fever', '感冒发热', 'MVP household scenario for cold and fever.', '{"mvp": true}'::jsonb),
  ('scenario', 'children_fever', '儿童退烧', 'MVP household scenario for child fever and fever reducers.', '{"mvp": true}'::jsonb),
  ('scenario', 'hypertension', '高血压', 'MVP household scenario for hypertension medication evidence.', '{"mvp": true}'::jsonb),
  ('scenario', 'diabetes', '糖尿病', 'MVP household scenario for diabetes medication evidence.', '{"mvp": true}'::jsonb),
  ('drug', 'acetaminophen', 'acetaminophen', 'Initial MVP medicine.', '{"mvp": true}'::jsonb),
  ('drug', 'paracetamol', 'paracetamol', 'Initial MVP medicine and acetaminophen synonym in many regions.', '{"mvp": true}'::jsonb),
  ('drug', 'ibuprofen', 'ibuprofen', 'Initial MVP medicine.', '{"mvp": true}'::jsonb),
  ('drug', 'amlodipine', 'amlodipine', 'Initial MVP medicine.', '{"mvp": true}'::jsonb),
  ('drug', 'lisinopril', 'lisinopril', 'Initial MVP medicine.', '{"mvp": true}'::jsonb),
  ('drug', 'metformin', 'metformin', 'Initial MVP medicine.', '{"mvp": true}'::jsonb),
  ('ingredient', 'acetaminophen', 'acetaminophen', 'Initial MVP ingredient.', '{"mvp": true}'::jsonb),
  ('ingredient', 'ibuprofen', 'ibuprofen', 'Initial MVP ingredient.', '{"mvp": true}'::jsonb),
  ('ingredient', 'amlodipine', 'amlodipine', 'Initial MVP ingredient.', '{"mvp": true}'::jsonb),
  ('ingredient', 'lisinopril', 'lisinopril', 'Initial MVP ingredient.', '{"mvp": true}'::jsonb),
  ('ingredient', 'metformin', 'metformin', 'Initial MVP ingredient.', '{"mvp": true}'::jsonb)
on conflict (entity_type, canonical_name) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  metadata = public.medical_entities.metadata || excluded.metadata,
  updated_at = now();

