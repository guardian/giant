import React, { useEffect, useState } from "react";
import { Dropdown } from "semantic-ui-react";
import { fetchSupportedLanguages } from "../../services/CollectionsApi";
import { Language } from "../../types/Collection";

type Props = {
  value: string;
  onChange: (language: string) => void;
  disabled?: boolean;
};

export type LanguageOption = { key: string; value: string; text: string };
const languagesToLanguageOptions = (languages: Language[]): LanguageOption[] =>
  languages.map((lang) => ({
    key: lang.key,
    value: lang.key,
    text: lang.key.charAt(0).toUpperCase() + lang.key.slice(1),
  }));

export default function LanguagePicker({ value, onChange, disabled }: Props) {
  const [options, setOptions] = useState<LanguageOption[]>([]);

  useEffect(() => {
    fetchSupportedLanguages().then((languages) =>
      setOptions(languagesToLanguageOptions(languages)),
    );
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
      <small style={{ color: "grey", marginTop: "0.25em", display: "block" }}>
        Setting a language can improve OCR/translation quality
      </small>
    </>
  );
}
