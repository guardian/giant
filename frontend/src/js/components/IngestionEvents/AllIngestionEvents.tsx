

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
import { FilterState } from "./types";
import { updateCurrentCollection } from "./updateCurrentCollection";
import { updateCurrentIngestion } from "./updateCurrentIngestion";

function getCollection(collectionId: string, collections: Collection[]) {
    return collections.find((collection: Collection) => collection.uri === collectionId)
}

export function AllIngestionEvents(
    {getCollections, updateCurrentCollection, updateCurrentIngestion, collections, workspacesMetadata, currentCollection, currentIngestion = "all"}: {
        getCollections: (dispatch: any) => any,
        updateCurrentCollection: (dispatch: any) => any,
        updateCurrentIngestion: (dispatch: any) => any,
        collections: Collection[],
        workspacesMetadata: WorkspaceMetadata[],
        currentCollection?: string,
        currentIngestion?: string
    }) {

    const [ingestOptions, setIngestOptions] = useState<EuiSelectOption[]>([])
    const [ingestId, setIngestId] = useState<string>("all")
    const [toggleIdSelected, setToggleIdSelected] = useState<FilterState>(FilterState.All);

    useEffect(() => {
        getCollections({})
    }, [getCollections])

    const collectionOptions: EuiSelectOption[] = collections.map((collection: Collection) => ({
        value: collection.uri,
        text: collection.display
    }))

    useEffect(() => {
        if (currentCollection) {
            const sc = getCollection(currentCollection, collections)
            sc && setIngestOptions(sc.ingestions.map((ingestion: Ingestion) => ({
                value: ingestion.path,
                text: ingestion.display
            })).concat([{value: "all", text: "All ingestions"}]))
            console.log("ingestions", sc?.ingestions)
            if (sc?.ingestions.find((i) => i.display === currentIngestion) === undefined){
                updateCurrentIngestion(undefined)
            }
        }
    }, [currentCollection, collections, currentIngestion, updateCurrentIngestion])

    const toggleFilterButtons = [
        { id: FilterState.All, label: 'all' },
        { id: FilterState.ErrorsOnly, label: 'errors only' },
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
                                value={currentCollection}
                                onChange={(e) => updateCurrentCollection(e.target.value)}
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
                        onChange={(id) => setToggleIdSelected(id as FilterState)}
                    />
                </EuiFlexGroup>

                {currentCollection &&
                    <IngestionEvents
                        collectionId={currentCollection}
                        ingestId={currentIngestion}
                        workspaces={workspacesMetadata}
                        breakdownByWorkspace={false}
                        showErrorsOnly={toggleIdSelected === FilterState.ErrorsOnly}
                    />
                }
            </EuiProvider>
        </div>
    );
}


function mapStateToProps(state: GiantState) {
    return {
        workspacesMetadata: state.workspaces.workspacesMetadata,
        collections: state.collections,
        currentCollection: state.urlParams.currentCollection,
        currentIngestion: state.urlParams.currentIngestion,
    };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {
        getCollections: bindActionCreators(getCollections, dispatch),
        updateCurrentCollection: bindActionCreators(updateCurrentCollection, dispatch),
        updateCurrentIngestion: bindActionCreators(updateCurrentIngestion, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AllIngestionEvents);