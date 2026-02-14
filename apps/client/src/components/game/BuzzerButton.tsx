interface BuzzerButtonProps {
  disabled: boolean;
  onBuzz: () => void;
}

export const BuzzerButton = ({ disabled, onBuzz }: BuzzerButtonProps) => (
  <button className="buzzer" disabled={disabled} onClick={onBuzz}>
    BUZZ NOW
  </button>
);
