"use client";

import { toast } from "sonner";

type NotifyOptions = {
  description?: string;
  duration?: number;
};

export const notify = {
  success(message: string, options?: NotifyOptions) {
    toast.success(message, options);
  },
  error(message: string, options?: NotifyOptions) {
    toast.error(message, options);
  },
  warning(message: string, options?: NotifyOptions) {
    toast.warning(message, options);
  },
  info(message: string, options?: NotifyOptions) {
    toast(message, options);
  }
};
