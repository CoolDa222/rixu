import { AlertCircle, CheckCircle2, X } from "lucide-react";

export interface ToastState {
  message: string;
  tone: "success" | "error";
}

export function Toast({
  toast,
  onClose,
}: {
  toast: ToastState;
  onClose: () => void;
}) {
  return (
    <div className={`toast toast-${toast.tone}`} role="status">
      {toast.tone === "success" ? (
        <CheckCircle2 size={18} />
      ) : (
        <AlertCircle size={18} />
      )}
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        title="关闭提示"
        aria-label="关闭提示"
      >
        <X size={15} />
      </button>
    </div>
  );
}
