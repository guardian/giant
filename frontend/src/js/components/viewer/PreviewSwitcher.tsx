import React, { FC } from "react";
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

class PreviewSwitcher extends React.Component<PreviewSwitcherProps> {
  currentViewModeIsValid(resource: Resource): boolean {
    const { view, totalPages } = this.props;

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

    if (view === "preview" && !this.canPreview(resource.previewStatus)) {
      return false;
    }

    return true;
  }

  canPreview(previewStatus?: string): boolean {
    return previewStatus !== "disabled";
  }

  previewLabel(): string {
    return previewLabelForMimeTypes(this.props.resource?.mimeTypes ?? []);
  }

  componentDidUpdateOrMount() {
    if (
      this.props.resource &&
      this.props.view &&
      !this.currentViewModeIsValid(this.props.resource)
    ) {
      const fallback = getDefaultView(this.props.resource);
      if (fallback) {
        this.props.setResourceView(fallback);
      }
    }
  }

  componentDidMount() {
    this.componentDidUpdateOrMount();
  }

  componentDidUpdate() {
    this.componentDidUpdateOrMount();
  }

  showText = () => {
    this.props.setResourceView("text");
  };

  showCombined = () => {
    // Combined view is only available when the document has been ingested as pages (e.g. PDF).
    if ((this.props.totalPages ?? 0) > 0) {
      this.props.setResourceView("combined");
    }
  };

  showPreview = () => {
    if (this.canPreview(this.props.resource?.previewStatus)) {
      this.props.setResourceView("preview");
    }
  };

  showOcr = () => {
    const resource = this.props.resource;
    if (resource?.transcript) {
      const languages = Object.keys(resource.transcript);
      if (languages.length > 0) {
        this.props.setResourceView(`transcript.${languages[0]}`);
      }
    } else if (resource?.ocr) {
      const languages = Object.keys(resource.ocr);
      if (languages.length > 0) {
        this.props.setResourceView(`ocr.${languages[0]}`);
      }
    }
  };

  showTable = () => {
    this.props.setResourceView("table");
  };

  renderMultiLangLinks(
    current: string,
    view: string,
    textPrefix?: string,
  ): JSX.Element[] | false {
    if (_.get(this.props.resource, view)) {
      const languages = Object.keys(_.get(this.props.resource, view));
      if (languages.length > 0) {
        return languages.map((l) => (
          <PreviewLink
            key={l}
            current={current}
            to={`${view}.${l}`}
            text={`${textPrefix || ""} (${_.startCase(l)})`}
            navigate={this.props.setResourceView}
          />
        ));
      }
    }
    return false;
  }

  render() {
    const current = this.props.view
      ? this.props.view
      : this.props.resource.transcript
        ? "transcript"
        : "text";

    const { parents } = this.props.resource;

    return (
      <nav className="preview__links">
        <KeyboardShortcut
          shortcut={keyboardShortcuts.showText}
          func={this.showText}
        />
        <KeyboardShortcut
          shortcut={keyboardShortcuts.showCombined}
          func={this.showCombined}
        />
        <KeyboardShortcut
          shortcut={keyboardShortcuts.showPreview}
          func={this.showPreview}
        />
        <KeyboardShortcut
          shortcut={keyboardShortcuts.showOcr}
          func={this.showOcr}
        />
        {(this.props.totalPages ?? 0) > 0 && (
          <PreviewLink
            current={current}
            text="Combined"
            to="combined"
            navigate={this.props.setResourceView}
          />
        )}
        {hasTextContent(this.props.resource) &&
        !this.props.resource.transcript ? (
          <PreviewLink
            current={current}
            text="Text"
            to="text"
            navigate={this.props.setResourceView}
          />
        ) : (
          false
        )}
        {this.props.resource.transcript
          ? this.renderMultiLangLinks(current, "transcript", "Transcript")
          : false}
        {this.props.resource.vttTranscript
          ? this.renderMultiLangLinks(
              current,
              "vttTranscript",
              "Transcript time codes",
            )
          : false}
        {!this.props.resource.transcript &&
          this.renderMultiLangLinks(current, "ocr", "OCR")}
        {this.canPreview(this.props.resource.previewStatus) ? (
          <PreviewLink
            current={current}
            text={this.previewLabel()}
            to="preview"
            navigate={this.props.setResourceView}
          />
        ) : (
          false
        )}
        {parents &&
          parents.some(
            (m) => m.uri.endsWith("csv") || m.uri.endsWith("tsv"),
          ) && (
            <PreviewLink
              current={current}
              text="Table"
              to="table"
              navigate={this.props.setResourceView}
            />
          )}
      </nav>
    );
  }
}

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
