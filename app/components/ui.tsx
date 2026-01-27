"use client";

import React from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

export function Button({
  children,
  onClick,
  variant = "secondary",
  type = "button",
  disabled
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 14px",
        borderRadius: 6,
        border: "1px solid #cfcfcf",
        background: "#ffffff",
        color: "#1b1b1b",
        cursor: "pointer",
        ...(variant === "primary"
          ? { background: "#1f2937", color: "#ffffff", borderColor: "#1f2937" }
          : variant === "danger"
            ? { color: "#a10d0d", borderColor: "#a10d0d" }
            : {})
      }}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="stack" style={{ gap: 6 }}>
      <span style={{ fontSize: 13, color: "#4b4b4b" }}>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        style={{
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #d0d0d0",
          background: "#ffffff",
          color: "#1b1b1b"
        }}
      />
    </label>
  );
}

export function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="stack" style={{ gap: 6 }}>
      <span style={{ fontSize: 13, color: "#4b4b4b" }}>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #d0d0d0",
          background: "#ffffff",
          color: "#1b1b1b"
        }}
      />
    </label>
  );
}

export function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="stack" style={{ gap: 6 }}>
      <span style={{ fontSize: 13, color: "#4b4b4b" }}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #d0d0d0",
          background: "#ffffff",
          color: "#1b1b1b"
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
