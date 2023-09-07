

import {useEffect, useState} from "react";
import {GiantState} from "../../types/redux/GiantState";
import {GiantDispatch} from "../../types/redux/GiantDispatch";
import {connect} from "react-redux";
import '@elastic/eui/dist/eui_theme_light.css';
import {WorkspaceMetadata} from "../../types/Workspaces";
import {bindActionCreators} from "redux";
import {getCollections} from "../../actions/collections/getCollections";
import {Collection} from "../../types/Collection";
import {getDefaultCollection} from "../Uploads/UploadTarget";
import {IngestionEvents} from "./IngestionEvents";
import {PartialUser} from "../../types/User";
import {EuiButtonGroup, EuiFlexGroup, EuiProvider, EuiSelect} from "@elastic/eui";
import {getWorkspacesMetadata} from "../../actions/workspaces/getWorkspacesMetadata";
import {EuiFormControlLayout} from "@elastic/eui";
import {EuiFormLabel} from "@elastic/eui";
import { css } from "@emotion/react";
import { FilterState } from "./types";
import { updateCurrentWorkspace } from "../../actions/ingestEvents/updateCurrentWorkspace";
import _ from 'lodash'

function MyUploads(
    {getCollections, getWorkspacesMetadata, updateCurrentWorkspace, collections, currentUser, workspacesMetadata, currentWorkspace = "all"}: {
        getCollections: (dispatch: any) => any,
        getWorkspacesMetadata: (dispatch: any) => any,
        updateCurrentWorkspace: (dispatch: any) => any,
        collections: Collection[],
        currentUser?: PartialUser,
        workspacesMetadata: WorkspaceMetadata[],
        currentWorkspace?: string
          }) {

    const [defaultCollection, setDefaultCollection] = useState<Collection>()

    const [toggleIdSelected, setToggleIdSelected] = useState<FilterState>(FilterState.All);

    useEffect(() => {
        updateCurrentWorkspace(currentWorkspace)
    }, [currentWorkspace, updateCurrentWorkspace])

    useEffect(() => {
        getCollections({})
        getWorkspacesMetadata({})
    }, [getCollections, getWorkspacesMetadata])

    useEffect(() => {
        if (currentUser && collections.length > 0) {
            setDefaultCollection(
                getDefaultCollection(currentUser.username, collections)
            )
        }
    }, [collections, currentUser])

    const toggleFilterButtons: {id: FilterState, label: string}[] = [
        { id: FilterState.All, label: 'all' },
        { id: FilterState.ErrorsOnly, label: 'errors only' },
      ];

    return (
        <div className='app__main-content'>
        <h1 className='page-title'>My workspace uploads</h1>
        <EuiProvider globalStyles={false} colorMode="light">
            {defaultCollection &&
                <>
                {workspacesMetadata.length > 0 &&
                <EuiFlexGroup>
                    <EuiFormControlLayout prepend={<EuiFormLabel htmlFor={"workspace-picker"}>Workspace</EuiFormLabel>}>
                        <EuiSelect
                            value={currentWorkspace}
                            onChange={(e) => updateCurrentWorkspace(e.target.value)}
                            id={"workspace-picker"}
                            options={
                                [{value: "all", text: "All workspaces"}].concat(
                                    _.sortBy(workspacesMetadata, (w) => w.name).map((w: WorkspaceMetadata) =>
                                        ({value: w.name, text: w.name}))
                                )
                            }
                        ></EuiSelect>
                    </EuiFormControlLayout>
                    <EuiButtonGroup
                        css={css`border: none;`}
                        legend="selection group to show all events or just the errors"
                        options={toggleFilterButtons}
                        idSelected={toggleIdSelected}
                        onChange={(id) => setToggleIdSelected(id as FilterState)}
                    >
                    </EuiButtonGroup>
                </EuiFlexGroup>
                }
                 <IngestionEvents
                     collectionId={defaultCollection.uri}
                     workspaces={workspacesMetadata.filter((w) => currentWorkspace === "all" || w.name === currentWorkspace)}
                     breakdownByWorkspace={true}
                     showErrorsOnly={toggleIdSelected === FilterState.ErrorsOnly}
                 ></IngestionEvents>
                </>
            }
        </EuiProvider>
        </div>
    )
}


function mapStateToProps(state: GiantState) {
    return {
        workspacesMetadata: state.workspaces.workspacesMetadata,
        currentUser: state.auth.token?.user,
        collections: state.collections,
        currentWorkspace: state.urlParams.currentWorkspace,
    }
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {
        getCollections: bindActionCreators(getCollections, dispatch),
        getWorkspacesMetadata: bindActionCreators(
            getWorkspacesMetadata,
            dispatch
        ),
        updateCurrentWorkspace: bindActionCreators(
            updateCurrentWorkspace,
            dispatch
        ),
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(MyUploads)
