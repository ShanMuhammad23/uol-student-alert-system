"use client";

import { ToastContainer, toast, type ToastOptions } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export const appToast = {
  success: (message: string, options?: ToastOptions) =>
    toast.success(message, options),
  error: (message: string, options?: ToastOptions) => toast.error(message, options),
  info: (message: string, options?: ToastOptions) => toast.info(message, options),
  warning: (message: string, options?: ToastOptions) =>
    toast.warning(message, options),
};

export function AppToastContainer() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      newestOnTop
      closeOnClick
      pauseOnHover
      theme="colored"
    />
  );
}
