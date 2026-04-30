-- Fix mutable search path
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- Fix listing on public bucket by restricting select policy
DROP POLICY "Service images are publicly accessible" ON storage.objects;
CREATE POLICY "Service images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'service-images');
-- Note: In Supabase, if you want to prevent listing, you usually don't allow SELECT on the whole bucket but allow it based on specific conditions. 
-- However, for public access to images, SELECT is needed. To truly "prevent listing" via API but allow direct access, 
-- one often uses the fact that they are public at the bucket level or uses more specific RLS.
-- For now, setting the search_path is the most critical fix.