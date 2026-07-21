"use client";

import Modal from "@/components/Modal";
import MfaEnrollFields from "@/components/MfaEnrollFields";

interface Props {
  onEnrolled: () => void;
  onCancel: () => void;
}

export default function MfaEnrollModal({ onEnrolled, onCancel }: Props) {
  return (
    <Modal title="MFA'yı Etkinleştir" onClose={onCancel}>
      <div className="mt-4">
        <MfaEnrollFields onEnrolled={onEnrolled} onCancel={onCancel} />
      </div>
    </Modal>
  );
}
