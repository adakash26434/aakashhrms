import React, { useEffect, useState } from "react";

interface NumberInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange"
  > {
  value: number;
  onChange: (value: number) => void;
}

export function NumberInput({
  value,
  onChange,
  className,
  onBlur,
  ...props
}: NumberInputProps) {
  const [inputValue, setInputValue] = useState<string>(String(value));

  // Sync local state when parent value changes externally
  useEffect(() => {
    if (Number(inputValue) !== value) {
      setInputValue(String(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    const numericValue = Number(val);
    if (!isNaN(numericValue)) {
      onChange(numericValue);
    } else {
      onChange(0);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // If the displayed string doesn't match the actual value, format it on blur
    if (inputValue !== String(value)) {
      setInputValue(String(value));
    }
    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <input
      type="number"
      value={inputValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      {...props}
    />
  );
}
