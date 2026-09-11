-- =====================================================================
-- Storage bucket for student photos
-- Migration: 20260911_student_photos_bucket.sql
-- =====================================================================

-- Create storage bucket for student photos (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-photos',
  'student-photos',
  true,  -- Publicly accessible
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload files (public access)
CREATE POLICY "Allow public uploads to student-photos"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'student-photos');

-- Allow anyone to read files (public access)
CREATE POLICY "Allow public reads from student-photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'student-photos');

-- Allow authenticated users to update files (for editing)
CREATE POLICY "Allow public updates to student-photos"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'student-photos');

-- Allow authenticated users to delete files (for removing old photos)
CREATE POLICY "Allow public deletes from student-photos"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'student-photos');
