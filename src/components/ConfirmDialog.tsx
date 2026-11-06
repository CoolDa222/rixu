import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  danger = false,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      eyebrow="请确认"
      width="medium"
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="button button-secondary" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className={`button ${danger ? "button-danger" : "button-primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "处理中..." : confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm-message">
        <span className={danger ? "danger-icon" : "info-icon"}>
          <AlertTriangle size={22} />
        </span>
        <p>{description}</p>
      </div>
    </Modal>
  );
}
