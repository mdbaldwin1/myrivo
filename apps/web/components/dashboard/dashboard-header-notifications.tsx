"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NotificationsFeed } from "@/components/dashboard/notifications-feed";
import { useHasMounted } from "@/components/use-has-mounted";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buildStoreWorkspacePath } from "@/lib/routes/store-workspace";

type DashboardHeaderNotificationsProps = {
  storeSlug: string | null;
  initialNotificationSoundEnabled?: boolean;
};

type NotificationsUnreadPayload = {
  unreadCount?: number;
};

type NotificationSoundPreferencePayload = {
  profile?: {
    preferences?: {
      notificationSoundEnabled?: boolean;
    };
  };
};

const BELL_POLL_INTERVAL_MS = 30_000;
const SOUND_COOLDOWN_MS = 12_000;
const NOTIFICATION_SOUND_PREF_STORAGE_KEY = "myrivo.notificationSoundEnabled";
const NOTIFICATION_LAST_UNREAD_STORAGE_KEY = "myrivo.notificationLastUnreadCount";

export function DashboardHeaderNotifications({ storeSlug, initialNotificationSoundEnabled = false }: DashboardHeaderNotificationsProps) {
  const hasMounted = useHasMounted();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(initialNotificationSoundEnabled);
  const hasLoadedUnreadRef = useRef(false);
  const unreadCountRef = useRef(0);
  const lastSoundAtRef = useRef(0);
  const pendingSoundRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const inboxHref = useMemo(() => buildStoreWorkspacePath(storeSlug, "/notifications", "/dashboard/stores"), [storeSlug]);

  const ensureAudioContextReady = useCallback(async () => {
    if (typeof window === "undefined") {
      return null;
    }

    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    if (audioContextRef.current.state !== "running") {
      await audioContextRef.current.resume().catch(() => undefined);
    }

    return audioContextRef.current;
  }, []);

  const ensureAudioElement = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }
    if (!audioElementRef.current) {
      const element = new Audio("/sounds/notification.wav");
      element.preload = "auto";
      element.volume = 0.8;
      audioElementRef.current = element;
    }
    return audioElementRef.current;
  }, []);

  const playNotificationPing = useCallback(async () => {
    const audioElement = ensureAudioElement();
    if (audioElement) {
      try {
        audioElement.currentTime = 0;
        await audioElement.play();
        pendingSoundRef.current = false;
        return;
      } catch {
        // Fall back to WebAudio path below.
      }
    }

    const context = await ensureAudioContextReady();
    if (!context || context.state !== "running") {
      pendingSoundRef.current = true;
      return;
    }
    pendingSoundRef.current = false;

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(980, context.currentTime);
    gainNode.gain.setValueAtTime(0.0001, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.24);
  }, [ensureAudioContextReady, ensureAudioElement]);

  const maybePlayPendingPing = useCallback(() => {
    if (!pendingSoundRef.current) {
      return;
    }
    void playNotificationPing();
  }, [playNotificationPing]);

  const isSoundEnabled = useCallback(() => {
    if (notificationSoundEnabled) {
      return true;
    }
    if (typeof window === "undefined") {
      return false;
    }
    return initialNotificationSoundEnabled || window.localStorage.getItem(NOTIFICATION_SOUND_PREF_STORAGE_KEY) === "1";
  }, [initialNotificationSoundEnabled, notificationSoundEnabled]);

  const updateUnreadCount = useCallback(
    (nextCount: number) => {
      const nextUnread = Math.max(0, Math.trunc(nextCount));
      const previousUnread = unreadCountRef.current;
      const shouldPing =
        hasLoadedUnreadRef.current &&
        isSoundEnabled() &&
        nextUnread > previousUnread &&
        Date.now() - lastSoundAtRef.current >= SOUND_COOLDOWN_MS;

      unreadCountRef.current = nextUnread;
      hasLoadedUnreadRef.current = true;
      setUnreadCount(nextUnread);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(NOTIFICATION_LAST_UNREAD_STORAGE_KEY, String(nextUnread));
      }

      if (shouldPing) {
        lastSoundAtRef.current = Date.now();
        pendingSoundRef.current = true;
        void playNotificationPing();
      }
    },
    [isSoundEnabled, playNotificationPing]
  );

  const loadUnreadCount = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        limit: "1",
        offset: "0",
        status: "unread"
      });
      const response = await fetch(`/api/notifications?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as NotificationsUnreadPayload;
      if (!response.ok) {
        return;
      }
      updateUnreadCount(typeof payload.unreadCount === "number" ? payload.unreadCount : 0);
    } catch {
      // Ignore transient polling errors in the header badge.
    }
  }, [updateUnreadCount]);

  const loadNotificationSoundPreference = useCallback(async () => {
    try {
      const response = await fetch("/api/user/profile", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as NotificationSoundPreferencePayload;
      if (!response.ok) {
        return;
      }
      const enabled = Boolean(payload.profile?.preferences?.notificationSoundEnabled);
      setNotificationSoundEnabled(enabled);
      window.localStorage.setItem(NOTIFICATION_SOUND_PREF_STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      // Ignore preference fetch failures and leave sound disabled.
    }
  }, []);

  useEffect(() => {
    const restoreClientStateTimeout = window.setTimeout(() => {
      const storedNotificationSoundEnabled = window.localStorage.getItem(NOTIFICATION_SOUND_PREF_STORAGE_KEY) === "1";
      const storedUnreadCountRaw = window.localStorage.getItem(NOTIFICATION_LAST_UNREAD_STORAGE_KEY);
      const storedUnreadCount = storedUnreadCountRaw ? Number.parseInt(storedUnreadCountRaw, 10) : NaN;

      if (storedNotificationSoundEnabled || initialNotificationSoundEnabled) {
        setNotificationSoundEnabled(true);
      }

      if (Number.isFinite(storedUnreadCount) && storedUnreadCount >= 0) {
        unreadCountRef.current = storedUnreadCount;
        hasLoadedUnreadRef.current = true;
        setUnreadCount(storedUnreadCount);
      }
    }, 0);

    const initialLoadTimeout = window.setTimeout(() => {
      void Promise.all([loadUnreadCount(), loadNotificationSoundPreference()]);
    }, 0);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      void loadUnreadCount();
    }, BELL_POLL_INTERVAL_MS);

    const handleWindowFocus = () => {
      void loadUnreadCount();
      void loadNotificationSoundPreference();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadUnreadCount();
        void loadNotificationSoundPreference();
      }
    };
    const handleUserInteraction = () => {
      void ensureAudioContextReady();
      maybePlayPendingPing();
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pointerdown", handleUserInteraction);
    window.addEventListener("keydown", handleUserInteraction);

    return () => {
      window.clearTimeout(restoreClientStateTimeout);
      window.clearTimeout(initialLoadTimeout);
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pointerdown", handleUserInteraction);
      window.removeEventListener("keydown", handleUserInteraction);
    };
  }, [ensureAudioContextReady, initialNotificationSoundEnabled, loadNotificationSoundPreference, loadUnreadCount, maybePlayPendingPing]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = "";
        audioElementRef.current = null;
      }
    };
  }, []);

  if (!hasMounted) {
    return (
      <Button type="button" variant="outline" size="icon" className="relative h-9 w-9" aria-label="Notifications">
        <Bell className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          void ensureAudioContextReady();
          maybePlayPendingPing();
          void loadUnreadCount();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,24rem)] p-0">
        <div className="border-b border-border/70 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Notifications</p>
            <Link href={inboxHref} className="text-xs font-medium text-primary hover:underline" onClick={() => setOpen(false)}>
              View inbox
            </Link>
          </div>
        </div>
        <div className="p-2">
          <NotificationsFeed storeSlug={storeSlug} mode="compact" onUnreadCountChange={updateUnreadCount} onNavigate={() => setOpen(false)} />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
