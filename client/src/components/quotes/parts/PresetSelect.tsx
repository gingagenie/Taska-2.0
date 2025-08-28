import React from 'react';

interface Preset {
  id: string;
  name: string;
  description?: string;
  unit_amount: number;
  tax_rate?: number;
}

interface PresetSelectProps {
  presets: Preset[];
  onSelect: (presetId: string) => void;
}

export function PresetSelect({ presets, onSelect }: PresetSelectProps) {
  return (
    <select 
      className="border rounded-lg px-2 py-2 text-sm bg-white w-[90px] relative z-20" 
      onChange={(e) => {
        if (e.target.value) {
          onSelect(e.target.value);
          e.target.value = ''; // Reset selection
        }
      }} 
      defaultValue=""
    >
      <option value="" disabled>+ Preset</option>
      {presets.map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}