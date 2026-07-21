import React, { FC, useEffect } from "react";
import { Resource } from "../../types/Resource";
import _ from "lodash";

import { hasTextContent, getDefaultView } from "../../util/resourceUtils";
import { keyboardShortcuts } from "../../util/keyboardShortcuts";
import { KeyboardShortcut } from "../UtilComponents/KeyboardShortcut";

import { connect } from "react-redux";
import { bindActionCreators } from "redux";

import { setResourceView } from "../../actions/urlParams/setViews";
import { GiantDispatch } from "../../types/redux/GiantDispatch";

export function previewLabelForMimeTypes(mimeTypes: string[]): string {
  if (mimeTypes.some((m) => m.startsWith("video/"))) {
    return "Video";
  }
  if (mimeTypes.some((m) => m.startsWith("audio/"))) {
    return "Audio";
  }
  return "Preview";
}

type PreviewSwitcherProps = {
  resource: Resource;
  view?: string;
  totalPages?: number;
  setResourceView: typeof setResourceView;
};

function canPreview(previewStatus?: string): boolean {
  return previewStatus !== "disabled";
}

const PreviewSwitcher: FC<PreviewSwitcherProps> = ({
  resource,
  view,
  totalPages,
  setResourceView,
}) => {
  const currentViewModeIsValid = (): boolean => {
    if (!view) {
      return false;
    }

    if (view === "combined" && (totalPages ?? 0) > 0) {
      return true;
    }

    if (
      view === "table" &&
      (!resource.parents ||
        !resource.parents.some(
          (m) => m.uri.endsWith("csv") || m.uri.endsWith("tsv"),
        ) ||
        !resource.text)
    ) {
      return false;
    }

    if (view === "text" && !hasTextContent(resource)) {
      return false;
    }

    if (view.startsWith("ocr") && !_.get(resource, view)) {
      return false;
    }

    if (view === "preview" && !canPreview(resource.previewStatus)) {
      return false;
    }

    return true;
  };

  const previewLabel = (): string =>
    previewLabelForMimeTypes(resource?.mimeTypes ?? []);

  useEffect(() => {
    if (resource && view && !currentViewModeIsValid()) {
      const fallback = getDefaultView(resource);
      if (fallback) {
        setResourceView(fallback);
      }
    }
    // Mirrors the previous componentDidMount/componentDidUpdate behaviour by
    // re-running whenever the relevant props change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  const showText = () => {
    setResourceView("text");
  };

  const showCombined = () => {
    // Combined view is only available when the document has been ingested as pages (e.g. PDF).
    if ((totalPages ?? 0) > 0) {
      setResourceView("combined");
    }
  };

  const showPreview = () => {
    if (canPreview(resource?.previewStatus)) {
      setResourceView("preview");
    }
  };

  const showOcr = () => {
    if (resource?.transcript) {
      const languages = Object.keys(resource.transcript);
      if (languages.length > 0) {
        setResourceView(`transcript.${languages[0]}`);
      }
    } else if (resource?.ocr) {
      const languages = Object.keys(resource.ocr);
      if (languages.length > 0) {
        setResourceView(`ocr.${languages[0]}`);
      }
    }
  };

  const renderMultiLangLinks = (
    current: string,
    langView: string,
    textPrefix?: string,
  ): JSX.Element[] | false => {
    if (_.get(resource, langView)) {
      const languages = Object.keys(_.get(resource, langView));
      if (languages.length > 0) {
        return languages.map((l) => (
          <PreviewLink
            key={l}
            current={current}
            to={`${langView}.${l}`}
            text={`${textPrefix || ""} (${_.startCase(l)})`}
            navigate={setResourceView}
          />
        ));
      }
    }
    return false;
  };

  const current = view ? view : resource.transcript ? "transcript" : "text";

  const { parents } = resource;

  return (
    <nav className="preview__links">
      <KeyboardShortcut shortcut={keyboardShortcuts.showText} func={showText} />
      <KeyboardShortcut
        shortcut={keyboardShortcuts.showCombined}
        func={showCombined}
      />
      <KeyboardShortcut
        shortcut={keyboardShortcuts.showPreview}
        func={showPreview}
      />
      <KeyboardShortcut shortcut={keyboardShortcuts.showOcr} func={showOcr} />
      {(totalPages ?? 0) > 0 && (
        <PreviewLink
          current={current}
          text="Combined"
          to="combined"
          navigate={setResourceView}
        />
      )}
      {hasTextContent(resource) && !resource.transcript ? (
        <PreviewLink
          current={current}
          text="Text"
          to="text"
          navigate={setResourceView}
        />
      ) : (
        false
      )}
      {resource.transcript
        ? renderMultiLangLinks(current, "transcript", "Transcript")
        : false}
      {resource.vttTranscript
        ? renderMultiLangLinks(
            current,
            "vttTranscript",
            "Transcript time codes",
          )
        : false}
      {!resource.transcript && renderMultiLangLinks(current, "ocr", "OCR")}
      {canPreview(resource.previewStatus) ? (
        <PreviewLink
          current={current}
          text={previewLabel()}
          to="preview"
          navigate={setResourceView}
        />
      ) : (
        false
      )}
      {parents &&
        parents.some((m) => m.uri.endsWith("csv") || m.uri.endsWith("tsv")) && (
          <PreviewLink
            current={current}
            text="Table"
            to="table"
            navigate={setResourceView}
          />
        )}
    </nav>
  );
};

type PreviewLinkProps = {
  current: string;
  text: string;
  to: string;
  navigate: (view: string) => void;
};

const PreviewLink: FC<PreviewLinkProps> = ({ current, text, to, navigate }) => {
  const active = current.toLowerCase() === to.toLowerCase();
  const clazz = `btn-link preview__link ${active ? "preview__link--active" : ""}`;

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    navigate(to);
  };

  return (
    <button className={clazz} onClick={onClick}>
      {text}
    </button>
  );
};

function mapStateToProps() {
  return {};
}

function mapDispatchToProps(dispatch: GiantDispatch) {
  return {
    setResourceView: bindActionCreators(setResourceView, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(PreviewSwitcher);
