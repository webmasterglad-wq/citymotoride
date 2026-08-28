import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

export const AVATAR_BUCKET = 'avatars';
export const MOTORIDE_UPLOADS_BUCKET = 'motoride-uploads';

export interface StorageBucketInfo {
  id: string;
  name: string;
  public: boolean;
  file_size_limit?: number;
  allowed_mime_types?: string[];
  created_at?: string;
}

export interface UploadResult {
  url: string | null;
  storageType: 'supabase' | 'local_fallback';
  error: string | null;
  bucketName?: string;
  filePath?: string;
}

/**
 * SQL script for creating the Supabase Storage Bucket and RLS policies.
 */
export const STORAGE_SQL_SCRIPT = `-- ========================================================
-- SUPABASE STORAGE BUCKET & RLS POLICIES FOR MOTORIDE
-- Run this in Supabase Dashboard -> SQL Editor
-- ========================================================

-- 1. Create the 'avatars' storage bucket (Public CDN enabled, 5MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880, -- 5 MB in bytes
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE 
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- 2. Create the 'motoride-uploads' storage bucket for receipts and trip media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'motoride-uploads',
    'motoride-uploads',
    true,
    10485760, -- 10 MB in bytes
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Storage Security Policies: Allow public read access to avatar images
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public can view avatars'
    ) THEN
        CREATE POLICY "Public can view avatars"
            ON storage.objects FOR SELECT
            USING (bucket_id IN ('avatars', 'motoride-uploads'));
    END IF;
END $$;

-- 4. Storage Security Policies: Allow uploads/inserts to avatars bucket
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow public upload to avatars'
    ) THEN
        CREATE POLICY "Allow public upload to avatars"
            ON storage.objects FOR INSERT
            WITH CHECK (bucket_id IN ('avatars', 'motoride-uploads'));
    END IF;
END $$;

-- 5. Storage Security Policies: Allow update & replacement of avatars
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow update avatars'
    ) THEN
        CREATE POLICY "Allow update avatars"
            ON storage.objects FOR UPDATE
            USING (bucket_id IN ('avatars', 'motoride-uploads'));
    END IF;
END $$;
`;

/**
 * Creates or provisions the avatars bucket via the Supabase client SDK.
 */
export const createSupabaseBucket = async (
  bucketName: string = AVATAR_BUCKET,
  isPublic: boolean = true
): Promise<{ success: boolean; message: string; error?: string }> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      success: false,
      message: 'Supabase client is not configured. Please add your Project URL and Anon Key.',
    };
  }

  try {
    // 1. Try to create the bucket via Supabase Storage API
    const { data, error } = await supabase.storage.createBucket(bucketName, {
      public: isPublic,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
    });

    if (error) {
      const msg = error.message || '';
      // If bucket already exists, consider it a success
      if (
        msg.toLowerCase().includes('already exists') ||
        msg.toLowerCase().includes('duplicate') ||
        error.name === 'BucketAlreadyExists'
      ) {
        return {
          success: true,
          message: `Storage bucket "${bucketName}" is already created and ready for public image storage.`,
        };
      }

      // If anon key lacks admin permissions to create bucket via REST, provide clear SQL guidance
      if (msg.toLowerCase().includes('violates row-level security') || msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('unauthorized')) {
        return {
          success: false,
          message: `Notice: Creating buckets directly via Client Anon Key requires running the SQL script in Supabase Dashboard.`,
          error: error.message,
        };
      }

      return {
        success: false,
        message: `Supabase Storage error: ${error.message}`,
        error: error.message,
      };
    }

    return {
      success: true,
      message: `Bucket "${bucketName}" was successfully created in Supabase with Public CDN access!`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to communicate with Supabase Storage.',
      error: err?.message,
    };
  }
};

/**
 * Checks if a specific bucket exists in Supabase.
 */
export const checkBucketExists = async (
  bucketName: string = AVATAR_BUCKET
): Promise<{ exists: boolean; bucket?: StorageBucketInfo | null; error?: string }> => {
  const supabase = getSupabaseClient();
  if (!supabase) return { exists: false, error: 'Supabase not connected' };

  try {
    const { data, error } = await supabase.storage.getBucket(bucketName);
    if (error) {
      // If getBucket fails, try listBuckets
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      if (!listError && buckets) {
        const found = buckets.find((b) => b.id === bucketName || b.name === bucketName);
        if (found) {
          return { exists: true, bucket: found as StorageBucketInfo };
        }
      }
      return { exists: false, error: error.message };
    }

    return { exists: Boolean(data), bucket: data as StorageBucketInfo };
  } catch (err: any) {
    return { exists: false, error: err?.message };
  }
};

/**
 * Uploads an image file to Supabase Storage bucket 'avatars'.
 * Falls back to base64 DataURL if Supabase is offline or bucket is not ready.
 */
export const uploadAvatarImage = async (
  file: File,
  options?: {
    role?: 'passenger' | 'captain' | string;
    userId?: string;
    bucketName?: string;
  }
): Promise<UploadResult> => {
  const bucketName = options?.bucketName || AVATAR_BUCKET;
  const role = options?.role || 'user';
  const userId = options?.userId || 'anon';

  // Helper for Base64 Data URL fallback
  const fallbackToBase64 = (): Promise<UploadResult> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          resolve({
            url: event.target.result,
            storageType: 'local_fallback',
            error: null,
          });
        } else {
          resolve({
            url: null,
            storageType: 'local_fallback',
            error: 'Failed to encode image file locally.',
          });
        }
      };
      reader.onerror = () => {
        resolve({
          url: null,
          storageType: 'local_fallback',
          error: 'FileReader error occurred.',
        });
      };
      reader.readAsDataURL(file);
    });
  };

  // If Supabase is not connected, immediately use local fallback
  if (!isSupabaseConfigured()) {
    return fallbackToBase64();
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return fallbackToBase64();
  }

  try {
    // Determine file extension
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const cleanExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext) ? ext : 'jpg';
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const fileName = `${role}_${userId}_${Date.now()}_${randomSuffix}.${cleanExt}`;
    const filePath = `avatars/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });

    if (uploadError) {
      console.warn(`[Supabase Storage] Upload to bucket "${bucketName}" returned error:`, uploadError.message);
      
      // If bucket is missing, attempt to provision it once and retry upload
      if (
        uploadError.message.toLowerCase().includes('not found') ||
        uploadError.message.toLowerCase().includes('bucket')
      ) {
        const createResult = await createSupabaseBucket(bucketName, true);
        if (createResult.success) {
          const retry = await supabase.storage
            .from(bucketName)
            .upload(filePath, file, { cacheControl: '3600', upsert: true });
          
          if (!retry.error && retry.data) {
            const { data: publicUrlData } = supabase.storage
              .from(bucketName)
              .getPublicUrl(filePath);

            return {
              url: publicUrlData.publicUrl,
              storageType: 'supabase',
              error: null,
              bucketName,
              filePath,
            };
          }
        }
      }

      // Fallback to base64 so user flow never breaks
      const base64Res = await fallbackToBase64();
      return {
        ...base64Res,
        error: `Supabase Storage upload notice: ${uploadError.message} (Stored locally as backup)`,
      };
    }

    // Retrieve public URL from Supabase Storage CDN
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return {
      url: publicUrlData.publicUrl,
      storageType: 'supabase',
      error: null,
      bucketName,
      filePath,
    };
  } catch (err: any) {
    console.error('[Supabase Storage] Unexpected upload exception:', err);
    const base64Res = await fallbackToBase64();
    return {
      ...base64Res,
      error: err?.message || 'Storage error, saved locally.',
    };
  }
};
