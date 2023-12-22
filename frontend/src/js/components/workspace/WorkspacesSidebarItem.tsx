import React, { FC } from 'react';
import SidebarSearchLink from '../UtilComponents/SidebarSearchLink';
import { moveItems } from '../../actions/workspaces/moveItem';
import { GiantState } from '../../types/redux/GiantState';
import { bindActionCreators } from 'redux';
import { GiantDispatch } from '../../types/redux/GiantDispatch';
import { connect } from 'react-redux';
import { getIdsOfEntriesToMove } from '../../util/treeUtils';
import {copyItems} from "../../actions/workspaces/copyItem";
import Modal from "../UtilComponents/Modal";
import CreateFolderModal from "./CreateFolderModal";

interface PropsFromParent {
    selectedWorkspaceId: string,
    linkedToWorkspaceId: string,
    linkedToWorkspaceName: string,
}

type PropTypes = ReturnType<typeof mapDispatchToProps>
    & ReturnType<typeof mapStateToProps>
    & PropsFromParent

const WorkspacesSidebarItem: FC<PropTypes> = ({selectedEntries, moveItems, copyItems, selectedWorkspaceId, linkedToWorkspaceId, linkedToWorkspaceName}) => {
    return <SidebarSearchLink
        onDrop={(e: React.DragEvent) => {
            const json = e.dataTransfer.getData('application/json');
            const {id: idOfDraggedEntry} = JSON.parse(json);
            const entryIds = getIdsOfEntriesToMove(selectedEntries, idOfDraggedEntry);
            e.metaKey ? copyItems(selectedWorkspaceId, entryIds, linkedToWorkspaceId) : moveItems(selectedWorkspaceId, entryIds, linkedToWorkspaceId);
        }}
        key={linkedToWorkspaceId}
        to={`/workspaces/${linkedToWorkspaceId}`}
    >
        <div className='sidebar__item__text'>{linkedToWorkspaceName}</div>
    </SidebarSearchLink>
}

function mapStateToProps(state: GiantState) {
    return {
        selectedEntries: state.workspaces.selectedEntries,
    };
}

function mapDispatchToProps(dispatch: GiantDispatch) {
    return {
        moveItems: bindActionCreators(moveItems, dispatch),
        copyItems: bindActionCreators(copyItems, dispatch)
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(WorkspacesSidebarItem);
