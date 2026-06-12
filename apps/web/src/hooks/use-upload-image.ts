'use client';

import { useMutation } from '@tanstack/react-query';
import type { UploadImagePurpose } from '@repo/types/api/upload';

import { uploadApi } from '@/lib/upload-api';
import { useUserStore } from '@/stores/userStore';

export function useUploadImage() {
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({
      file,
      purpose,
      groupId,
    }: {
      file: File;
      purpose: UploadImagePurpose;
      groupId?: string;
    }) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }

      return uploadApi.uploadImage(accessToken, file, { purpose, groupId });
    },
  });
}
