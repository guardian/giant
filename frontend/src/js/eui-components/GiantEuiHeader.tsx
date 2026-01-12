import React, { useEffect, useState } from "react";
import {
  EuiAvatar,
  EuiFieldSearch,
  EuiHeader,
  EuiHeaderLogo,
  EuiHeaderSectionItemButton,
  EuiIcon,
} from "@elastic/eui";
import { bindActionCreators } from "redux";
import { connect, useDispatch } from "react-redux";
import { getWorkspacesMetadata } from "../actions/workspaces/getWorkspacesMetadata";
import { performSearch } from "../actions/search/performSearch";
import { clearSearch } from "../actions/search/clearSearch";
import { useWorkspaceId } from "../util/workspaceUtils";
import history from "../util/history";
import { GiantEuiLeftHandNav } from "./GiantEuiLeftHandNav";
import { GiantState } from "../types/redux/GiantState";
import { GiantDispatch } from "../types/redux/GiantDispatch";
import GiantEuiSearchResultNav from "./GiantEuiSearchResultNav";
import GiantEuiSearchResultCount from "./GiantEuiSearchResultCount";
import { getWorkspace } from "../actions/workspaces/getWorkspace";

type Props = ReturnType<typeof mapStateToProps> &
  ReturnType<typeof mapDispatchToProps>;

function GiantEuiHeader({
  user,
  currentWorkspace,
  workspacesMetadata,
  performSearch,
  searchState,
}: Props) {
  const dispatch = useDispatch();

  const workspaceId = useWorkspaceId();
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    dispatch(getWorkspacesMetadata());
  }, [dispatch]);

  useEffect(() => {
    if (workspaceId) {
      dispatch(getWorkspace(workspaceId));
    }
    dispatch(clearSearch());
    setSearchTerm("");
  }, [workspaceId, dispatch]);

  function goToSettings() {
    history.push("/settings");
  }

  const search = (
    <React.Fragment>
      <EuiFieldSearch
        style={{ width: "250px" }}
        placeholder={
          currentWorkspace
            ? `Search in workspace ${currentWorkspace.name}`
            : "Search anywhere"
        }
        aria-label={
          currentWorkspace
            ? `Search in workspace ${currentWorkspace.name}`
            : "Search anywhere"
        }
        value={searchTerm}
        isLoading={searchState.isSearchInProgress}
        onChange={(e) => setSearchTerm(e.target.value)}
        onSearch={(searchTerm: string) => {
          const trimmedSearchTerm = searchTerm.trim();
          if (trimmedSearchTerm.length === 0) {
            return clearSearch();
          }

          let searchQuery = {
            q: JSON.stringify([trimmedSearchTerm]),
          };

          if (workspaceId) {
            searchQuery = {
              ...searchQuery,
              ...{ filters: { workspace: [workspaceId] } },
            };
          }

          performSearch(searchQuery);
        }}
        compressed
      />
    </React.Fragment>
  );

  const logo = (
    <EuiHeaderLogo iconType="logoKibana" href="#" aria-label="Go to home page">
      Giant
    </EuiHeaderLogo>
  );

  function getBreadcrumbs() {
    if (!currentWorkspace) {
      return [];
    }
    return [
      {
        text: currentWorkspace.name,
        onClick: (e: React.MouseEvent) => {
          history.push(`/workspaces/${currentWorkspace.id}`);
        },
      },
    ];
  }

  const sections = [
    {
      items: [
        <GiantEuiLeftHandNav workspacesMetadata={workspacesMetadata} />,
        logo,
      ],
      borders: "right" as const,
      breadcrumbs: getBreadcrumbs(),
    },
    {
      items: [<GiantEuiSearchResultCount />, <div style={{ width: 8 }} />],
      borders: "none" as const,
    },
    {
      items: [search, <div style={{ width: 8 }} />],
      borders: "none" as const,
    },
    {
      items: [
        <GiantEuiSearchResultNav />,
        <EuiHeaderSectionItemButton>
          <EuiAvatar size="m" name={user?.displayName || ""} />
        </EuiHeaderSectionItemButton>,
        <EuiHeaderSectionItemButton onClick={goToSettings}>
          <EuiIcon type="apps" size="m" />
        </EuiHeaderSectionItemButton>,
      ],
    },
  ];

  return <EuiHeader position="fixed" sections={sections} />;
}

function mapStateToProps(state: GiantState) {
  return {
    workspacesMetadata: state.workspaces.workspacesMetadata,
    currentWorkspace: state.workspaces.currentWorkspace,
    resource: state.resource,
    user: state.auth.token?.user,
    searchState: state.search,
  };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
  return {
    performSearch: bindActionCreators(performSearch, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(GiantEuiHeader);
