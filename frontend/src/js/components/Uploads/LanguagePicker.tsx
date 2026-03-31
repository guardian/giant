import React, { useEffect, useState } from "react";
import { Dropdown } from "semantic-ui-react";
import {
  fetchSupportedLanguages,
  LanguageOption,
} from "../../services/CollectionsApi";

type Props = {
  value: string;
  onChange: (language: string) => void;
  disabled?: boolean;
};

export default function LanguagePicker({ value, onChange, disabled }: Props) {
  const [options, setOptions] = useState<LanguageOption[]>([]);

  useEffect(() => {
    fetchSupportedLanguages().then(setOptions);
  }, []);

  return (
    <>
      <span className="form__label">Language</span>
      <Dropdown
        selection
        compact
        style={{ minWidth: "10em" }}
        options={options}
        value={value}
        onChange={(_e, { value }) => onChange(value as string)}
        disabled={disabled}
      />
      <small
        style={{ color: "grey", marginTop: "0.25em", display: "block" }}
      >
        Setting a language can improve OCR/translation quality
      </small>
    </>
  );
}
