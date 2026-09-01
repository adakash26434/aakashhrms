"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ToastOptions {
  type?: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

// Global Event Emitter for standalone `toast(...)` calls
type ToastListener = (toast: ToastOptions) => void;
const listeners = new Set<ToastListener>();

export const toast = {
  show: (options: ToastOptions) => {
    listeners.forEach((listener) => listener(options));
  },
  success: (message: string, title?: string, duration?: number) => {
    listeners.forEach((listener) =>
      listener({ type: "success", title, message, duration })
    );
  },
  error: (message: string, title?: string, duration?: number) => {
    listeners.forEach((listener) =>
      listener({ type: "error", title: title || "Error", message, duration })
    );
  },
  warning: (message: string, title?: string, duration?: number) => {
    listeners.forEach((listener) =>
      listener({ type: "warning", title: title || "Notice", message, duration })
    );
  },
  info: (message: string, title?: string, duration?: number) => {
    listeners.forEach((listener) =>
      listener({ type: "info", title, message, duration })
    );
  },
  promise: async <T,>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    }
  ): Promise<T> => {
    const id = Math.random().toString(36).substring(2, 9);
    toast.info(loading, "Please wait...", 10000);
    try {
      const data = await promise;
      const msg = typeof success === "function" ? success(data) : success;
      toast.success(msg);
      return data;
    } catch (err) {
      const msg = typeof error === "function" ? error(err) : error;
      toast.error(msg);
      throw err;
    }
  },
};

interface ToastContextType {
  toast: (options: ToastOptions) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({
      type = "info",
      title,
      message,
      duration = 4500,
    }: ToastOptions) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev.slice(-4), newToast]); // Keep up to 5 visible

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  // Subscribe to standalone `toast.*` calls
  useEffect(() => {
    const handleGlobalToast: ToastListener = (options) => {
      addToast(options);
    };
    listeners.add(handleGlobalToast);
    return () => {
      listeners.delete(handleGlobalToast);
    };
  }, [addToast]);

  const success = useCallback(
    (message: string, title?: string) => addToast({ type: "success", title, message }),
    [addToast]
  );
  const error = useCallback(
    (message: string, title?: string) => addToast({ type: "error", title: title || "Error", message }),
    [addToast]
  );
  const warning = useCallback(
    (message: string, title?: string) => addToast({ type: "warning", title: title || "Notice", message }),
    [addToast]
  );
  const info = useCallback(
    (message: string, title?: string) => addToast({ type: "info", title, message }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toast: addToast, success, error, warning, info, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback to standalone toast functions if used outside provider
    return {
      toast: toast.show,
      success: toast.success,
      error: toast.error,
      warning: toast.warning,
      info: toast.info,
      removeToast: () => {},
    };
  }
  return context;
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-5 right-5 z-[99999] flex max-w-sm w-full flex-col gap-2.5 sm:max-w-md"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  toast: item,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const config = {
    success: {
      icon: CheckCircle2,
      iconColor: "text-emerald-600",
      bg: "bg-white border-emerald-200 text-emerald-950 shadow-emerald-900/10",
      badge: "bg-emerald-100 text-emerald-800",
      accent: "bg-emerald-500",
    },
    error: {
      icon: AlertCircle,
      iconColor: "text-red-600",
      bg: "bg-white border-red-200 text-red-950 shadow-red-900/10",
      badge: "bg-red-100 text-red-800",
      accent: "bg-red-500",
    },
    warning: {
      icon: AlertTriangle,
      iconColor: "text-amber-600",
      bg: "bg-white border-amber-200 text-amber-950 shadow-amber-900/10",
      badge: "bg-amber-100 text-amber-800",
      accent: "bg-amber-500",
    },
    info: {
      icon: Info,
      iconColor: "text-emerald-700",
      bg: "bg-white border-gray-200 text-gray-900 shadow-gray-900/10",
      badge: "bg-gray-100 text-gray-800",
      accent: "bg-emerald-600",
    },
  }[item.type];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "pointer-events-auto relative flex w-full items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-xl transition-all duration-300 transform translate-y-0 opacity-100 animate-in fade-in slide-in-from-top-3 overflow-hidden",
        config.bg
      )}
    >
      {/* Left accent color bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", config.accent)} />

      <div className="flex shrink-0 pt-0.5 ml-1">
        <Icon className={cn("h-5 w-5", config.iconColor)} />
      </div>

      <div className="flex-1 min-w-0 pr-1">
        {item.title && (
          <h5 className="text-xs font-bold uppercase tracking-wider mb-0.5 text-gray-900">
            {item.title}
          </h5>
        )}
        <p className="text-sm font-medium leading-snug text-gray-700 break-words">
          {item.message}
        </p>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
