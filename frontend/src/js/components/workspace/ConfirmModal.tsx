import React from 'react';
import { GiantState } from '../../types/redux/GiantState';
import { connect } from 'react-redux';
import Modal from "../UtilComponents/Modal";
import {ProgressAnimation} from "../UtilComponents/ProgressAnimation";
import { isTreeLeaf, TreeEntry } from '../../types/Tree';
import { WorkspaceEntry } from '../../types/Workspaces';

export type ModalStatus = "unconfirmed" | "doing" | "done" | "failed"

export function DeleteModal({ deleteItemHandler, isOpen, setModalOpen, deleteStatus, entry }: 
    {   deleteItemHandler: () => void, 
        isOpen: boolean, 
        setModalOpen: (value: boolean) => void, 
        deleteStatus: ModalStatus,
        entry: null | TreeEntry<WorkspaceEntry>
    }) {
        if (entry !== null) {            
            const modalTitle: Record<ModalStatus, string> = {
                unconfirmed: "Delete item from Giant?",
                doing: "Deleting item from Giant",
                done: "Item deleted from Giant",
                failed: "Failed to delete item from Giant"
            }
    
            const modalMessage: Record<ModalStatus, string> = {
                unconfirmed: `This will delete the file [${entry.name}] from Giant. It cannot be undone. Are you sure you want to proceed?`,
                doing: "",
                done: "This item has been successfully deleted from Giant.",
                failed: "Failed to delete item from Giant. Please contact the administrator to delete this item."
            }
    
            return <ConfirmModal 
                    handler={deleteItemHandler} 
                    isOpen={isOpen} 
                    setModalOpen={setModalOpen} 
                    status={deleteStatus} 
                    modalTitle={modalTitle}
                    modalMessage={modalMessage}/>
        }
        
        return null;
}

export function RemoveFromWorkspaceModal({ removeHandler, isOpen, setModalOpen, removeStatus, entry }: 
    {   removeHandler: () => void, 
        isOpen: boolean, 
        setModalOpen: (value: boolean) => void, 
        removeStatus: ModalStatus,
        entry: null | TreeEntry<WorkspaceEntry>
    }) {        
        if (entry !== null) {
            const removeMessage = isTreeLeaf(entry) ?
                `This will remove the file [${entry.name}] from the current workspace. It cannot be undone. Are you sure you want to proceed?` :
                `This will remove the selection [${entry.name}] and everything nested inside it from your workspace. It cannot be undone. Are you sure you want to proceed?`
                
            const modalTitle: Record<ModalStatus, string> = {
                unconfirmed: "Remove item from workspace?",
                doing: "Removing item from workspace",
                done: "Item removed from workspace",
                failed: "Failed to remove item from workspace"
            }
        
            const modalMessage: Record<ModalStatus, string> = {
                unconfirmed: removeMessage,
                doing: "",
                done: "This item has been successfully removed from workspace.",
                failed: "Failed to remove item. Please contact the administrator to delete this item."
            }

            return <ConfirmModal 
                handler={removeHandler} 
                isOpen={isOpen} 
                setModalOpen={setModalOpen} 
                status={removeStatus} 
                modalTitle={modalTitle}
                modalMessage={modalMessage}/>
        }

        return null;
}

function ConfirmModal({ handler, isOpen, setModalOpen, status, modalTitle, modalMessage }: 
    {   handler: () => void, 
        isOpen: boolean, 
        setModalOpen: (value: boolean) => void, 
        status: ModalStatus,
        modalTitle: Record<ModalStatus, string>,
        modalMessage: Record<ModalStatus, string> }) {

    const onDismiss = () => {
        setModalOpen(false);
    }

    const handle = () => {
        try {
            handler();            
        }
        catch (e){
            console.error("Error handling item", e);
        }
    }

    const spinner = status === "doing" ? <ProgressAnimation /> : false;

    return <React.Fragment>
        <Modal
            isOpen={isOpen}
            isDismissable={true}
            dismiss={onDismiss}
        >
            <div className="form form-full-width">
                <h2 className='modal__title'>
                    {modalTitle[status]}                  
                </h2>
                <div className='form__row'>
                    {modalMessage[status]}
                </div>
                <div className='form__row btn-group btn-group--left'>
                    { status === "unconfirmed" && 
                        <>
                            <button className="btn" onClick={onDismiss}>Cancel</button>
                            <button className="btn" onClick={handle}>Proceed</button>
                        </>
                    }
                    { status === "done" &&
                        <>
                            <button className="btn" onClick={()=>document.location.href="/"}>
                                Giant Home
                            </button>
                            <button className="btn" onClick={onDismiss}>Close</button>
                        </>
                    }
                    { status === "failed" &&
                        <button className="btn" onClick={onDismiss}>Cancel</button>
                    }
                    {spinner}
                </div>
            </div>
        </Modal>
    </React.Fragment>
    ;
}

function mapStateToProps(state: GiantState) {
    return {
        resource: state.resource,
    };
}

export default connect(mapStateToProps)(DeleteModal);
