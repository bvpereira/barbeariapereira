-- Restore barb0 image paths: storage objects live under old folder ed8f7d0c-...,
-- DB URLs reference 01879baf-... Move the storage objects to match DB paths.

WITH svc AS (
  SELECT id, unnest(ARRAY[image_url,image_url_2,image_url_3,image_url_4,image_url_5]) AS url
  FROM public.servicos WHERE barbearia_id='01879baf-8f8b-4c3d-810f-7740b6432cd9'
), svc_paths AS (
  SELECT id AS parent_id, regexp_replace(url, '^.*/', '') AS fname FROM svc WHERE url IS NOT NULL
)
UPDATE storage.objects o
SET name = '01879baf-8f8b-4c3d-810f-7740b6432cd9/' || s.parent_id || '/' || s.fname
FROM svc_paths s
WHERE o.bucket_id='service-images'
  AND o.name LIKE 'ed8f7d0c-8444-4749-960b-80d0be8545b6/%/' || s.fname
  AND NOT EXISTS (
    SELECT 1 FROM storage.objects o2
    WHERE o2.bucket_id='service-images'
      AND o2.name = '01879baf-8f8b-4c3d-810f-7740b6432cd9/' || s.parent_id || '/' || s.fname
  );

WITH col AS (
  SELECT id, unnest(ARRAY[foto_url,foto_url_2,foto_url_3,foto_url_4,foto_url_5,foto_url_6,foto_url_7]) AS url
  FROM public.colaboradores WHERE barbearia_id='01879baf-8f8b-4c3d-810f-7740b6432cd9'
), col_paths AS (
  SELECT id AS parent_id, regexp_replace(url, '^.*/', '') AS fname FROM col WHERE url IS NOT NULL
)
UPDATE storage.objects o
SET name = '01879baf-8f8b-4c3d-810f-7740b6432cd9/' || c.parent_id || '/' || c.fname
FROM col_paths c
WHERE o.bucket_id='collaborator-images'
  AND o.name LIKE 'ed8f7d0c-8444-4749-960b-80d0be8545b6/%/' || c.fname
  AND NOT EXISTS (
    SELECT 1 FROM storage.objects o2
    WHERE o2.bucket_id='collaborator-images'
      AND o2.name = '01879baf-8f8b-4c3d-810f-7740b6432cd9/' || c.parent_id || '/' || c.fname
  );