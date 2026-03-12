"use client";

import { useEffect, useState } from "react";

export function readLocalStorageFlag(key: string) {
  return window.localStorage.getItem(key) === "1";
}

function dispatchLocalStorageFlagChange() {
  window.dispatchEvent(new Event("myrivo:local-storage-change"));
}

export function writeLocalStorageFlag(key: string, value: boolean) {
  window.localStorage.setItem(key, value ? "1" : "0");
  dispatchLocalStorageFlagChange();
}

export function useLocalStorageFlag(key: string) {
  const [value, setValue] = useState(false);

  useEffect(() => {
    function syncValue() {
      setValue(readLocalStorageFlag(key));
    }

    function onStorage(event: StorageEvent) {
      if (event.key === key || event.key === null) {
        syncValue();
      }
    }

    syncValue();
    window.addEventListener("storage", onStorage);
    window.addEventListener("myrivo:local-storage-change", syncValue);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("myrivo:local-storage-change", syncValue);
    };
  }, [key]);

  return value;
}
