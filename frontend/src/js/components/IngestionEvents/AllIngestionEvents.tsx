

import React, {useEffect, useState} from "react";
import {GiantState} from "../../types/redux/GiantState";
import {GiantDispatch} from "../../types/redux/GiantDispatch";
import {connect} from "react-redux";
import '@elastic/eui/dist/eui_theme_light.css';
import {WorkspaceMetadata} from "../../types/Workspaces";
import {bindActionCreators} from "redux";
import {getCollections} from "../../actions/collections/getCollections";
import {Collection, Ingestion} from "../../types/Collection";
import {IngestionEvents} from "./IngestionEvents";
import {EuiButtonGroup, EuiFlexGroup, EuiFlexItem, EuiFormControlLayout, EuiFormLabel, EuiProvider} from "@elastic/eui";
import {EuiSelect} from "@elastic/eui";
import {EuiSelectOption} from "@elastic/eui";
import styles from "./IngestionEvents.module.css";
import { css } from "@emotion/react";

function getCollection(collectionId: string, collections: Collection[]) {
    return collections.find((collection: Collection) => collection.uri === collectionId)
}

export function AllIngestionEvents(
    {getCollections, collections, workspacesMetadata}: {
        getCollections: (dispatch: any) => any,
        collections: Collection[],
        workspacesMetadata: WorkspaceMetadata[],
    }) {

    const ALL_FILTER_ID = 'all__0';
    const ERRORS_FILTER_ID = 'errors__1';
    const [selectedCollectionId, setSelectedCollectionId] = useState<string>("")
    const [ingestOptions, setIngestOptions] = useState<EuiSelectOption[]>([])
    const [ingestId, setIngestId] = useState<string>("all")
    const [toggleIdSelected, setToggleIdSelected] = useState(ALL_FILTER_ID);

    useEffect(() => {
        getCollections({})
    }, [getCollections])

    const collectionOptions: EuiSelectOption[] = collections.map((collection: Collection) => ({
        value: collection.uri,
        text: collection.display
    }))

    useEffect(() => {
        const sc = getCollection(selectedCollectionId, collections)
        sc && setIngestOptions(sc.ingestions.map((ingestion: Ingestion) => ({
            value: ingestion.path,
            text: ingestion.display
        })).concat([{value: "all", text: "All ingestions"}]))
    }, [selectedCollectionId, collections])

    const toggleFilterButtons = [
        { id: ALL_FILTER_ID, label: 'all' },
        { id: ERRORS_FILTER_ID, label: 'errors only' },
      ];

    return (
        <div className='app__main-content'>
            <h1 className='page-title'>All ingestion events</h1>
            <EuiProvider globalStyles={false} colorMode="light">
                <EuiFlexGroup wrap alignItems={"flexStart"} >
                    {collections.length > 0 && <EuiFlexItem grow={false}>
                        <EuiFormControlLayout className={styles.dropdown} prepend={<EuiFormLabel htmlFor={"collection-picker"}>Collection</EuiFormLabel>}>
                            <EuiSelect
                                hasNoInitialSelection={true}
                                value={selectedCollectionId}
                                onChange={(e) => setSelectedCollectionId(e.target.value)}
                                options={collectionOptions}>
                                id={"collection-picker"}
                            </EuiSelect>
                        </EuiFormControlLayout>
                    </EuiFlexItem>
                    }

                    {ingestOptions &&
                        <EuiFlexItem grow={false}>
                        <EuiFormControlLayout  className={styles.dropdown} prepend={<EuiFormLabel htmlFor={"ingest-picker"}>Ingest</EuiFormLabel>}>
                            <EuiSelect
                                value={ingestId}
                                onChange={(e) => setIngestId(e.target.value)} options={ingestOptions}>
                                id={"ingest-picker"}

                            </EuiSelect>
                        </EuiFormControlLayout>
                        </EuiFlexItem>
                    }

                    <EuiButtonGroup 
                        css={css`border: none;`}
                        legend="selection group to show all events or just the errors"
                        options={toggleFilterButtons} 
                        idSelected={toggleIdSelected}
                        onChange={(id) => setToggleIdSelected(id)}
                    /> 
                </EuiFlexGroup>

                {selectedCollectionId && 
                    <IngestionEvents 
                        collectionId={selectedCollectionId} 
                        ingestId={ingestId} 
                        workspaces={workspacesMetadata} 
                        breakdownByWorkspace={false}
                        showErrorsOnly={toggleIdSelected === ERRORS_FILTER_ID}
                    />
                }
            </EuiProvider>
        </div>
    );  
}


function mapStateToProps(state: GiantState) {
    return {
        workspacesMetadata: state.workspaces.workspacesMetadata,
        collections: state.collections
    };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {
        getCollections: bindActionCreators(getCollections, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AllIngestionEvents);