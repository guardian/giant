

import React, {useEffect, useState} from "react";
import authFetch from "../../util/auth/authFetch";
import {GiantState} from "../../types/redux/GiantState";
import {GiantDispatch} from "../../types/redux/GiantDispatch";
import {connect} from "react-redux";
import '@elastic/eui/dist/eui_theme_light.css';
import {WorkspaceMetadata} from "../../types/Workspaces";
import {bindActionCreators} from "redux";
import {getCollections} from "../../actions/collections/getCollections";
import {Collection, Ingestion} from "../../types/Collection";
import IngestionEvents from "./IngestionEvents";
import {PartialUser} from "../../types/User";
import {EuiFlexGroup, EuiFlexItem, EuiFormControlLayout, EuiFormLabel, EuiProvider} from "@elastic/eui";
import {EuiSelect} from "@elastic/eui";
import {EuiSelectOption} from "@elastic/eui";
import styles from "./IngestionEvents.module.css";

function getCollection(collectionId: string, collections: Collection[]) {
    return collections.find((collection: Collection) => collection.uri === collectionId)
}

export function AllIngestionEvents(
    props: {
        getCollections: (dispatch: any) => any,
        collections: Collection[],
        currentUser?: PartialUser,
        workspacesMetadata: WorkspaceMetadata[],
    }) {

    const [selectedCollectionId, setSelectedCollectionId] = useState<string>("")
    const [ingestOptions, setIngestOptions] = useState<EuiSelectOption[]>([])
    const [ingestId, setIngestId] = useState<string>("all")

    useEffect(() => {
        props.getCollections({})
    }, [])

    const collectionOptions: EuiSelectOption[] = props.collections.map((collection: Collection) => ({
        value: collection.uri,
        text: collection.display
    }))

    useEffect(() => {
        const sc = getCollection(selectedCollectionId, props.collections)
        sc && setIngestOptions(sc.ingestions.map((ingestion: Ingestion) => ({
            value: ingestion.path,
            text: ingestion.display
        })).concat([{value: "all", text: "All ingestions"}]))
    }, [selectedCollectionId, props.collections])


    return             <div className='app__main-content'>
        <h1 className='page-title'>
            All ingestion events</h1>
            <EuiProvider colorMode="light">

            <EuiFlexGroup alignItems={"flexStart"} >
        {props.collections.length > 0 && <EuiFlexItem grow={false}>
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
            </EuiFlexGroup>

        {selectedCollectionId && <IngestionEvents collectionId={selectedCollectionId} ingestId={ingestId} workspaces={props.workspacesMetadata} breakdownByWorkspace={false}></IngestionEvents>}
    </EuiProvider>
    </div>
}


function mapStateToProps(state: GiantState) {
    return {
        workspacesMetadata: state.workspaces.workspacesMetadata,
        currentUser: state.auth.token?.user,
        collections: state.collections
    };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {
        getCollections: bindActionCreators(getCollections, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AllIngestionEvents);