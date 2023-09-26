import React from 'react';
import { GiantState } from '../../types/redux/GiantState';
import { connect } from 'react-redux';
import Modal from "../UtilComponents/Modal";
import {ProgressAnimation} from "../UtilComponents/ProgressAnimation";

export type DeleteStatus = "unconfirmed" | "deleting" | "deleted" | "failed"

export function DeleteModal({ deleteItemHandler, isOpen, setModalOpen, deleteStatus }: 
    {   deleteItemHandler: () => void, 
        isOpen: boolean, 
        setModalOpen: (value: boolean) => void, 
        deleteStatus: DeleteStatus }) {
    
    const modalTitle: Record<DeleteStatus, string> = {
        unconfirmed: "Delete item?",
        deleting: "Deleting item",
        deleted: "Item deleted",
        failed: "Failed to delete"
    }

    const modalMessage: Record<DeleteStatus, string> = {
        unconfirmed: "Are you sure you want to delete this item? This action will permanently delete the item from giant.",
        deleting: "",
        deleted: "This item has been successfully deleted.",
        failed: "Failed to delete item. Please contact the administrator to delete this item."
    }

    const deleteItem = () => {
        try {
            deleteItemHandler();            
        }
        catch (e){
            console.error("Error deleting item", e);
        }
    }

    const onDismiss = () => {
        setModalOpen(false);
    }

    const spinner = deleteStatus === "deleting" ? <ProgressAnimation /> : false;

    return <React.Fragment>
        <Modal
            isOpen={isOpen}
            isDismissable={true}
            dismiss={onDismiss}
        >
            <div className="form form-full-width">
                <h2 className='modal__title'>
                    {modalTitle[deleteStatus]}                  
                </h2>
                <div className='form__row'>
                    {modalMessage[deleteStatus]}
                </div>
                <div className='form__row btn-group btn-group--left'>
                    { deleteStatus === "unconfirmed" && 
                        <>
                            <button className="btn" onClick={onDismiss}>Cancel</button>
                            <button className="btn" onClick={deleteItem}>Delete</button>
                        </>
                    }
                    { deleteStatus === "deleted" &&
                        <>
                            <button className="btn" onClick={()=>document.location.href="/"}>
                                Giant Home
                            </button>
                            <button className="btn" onClick={onDismiss}>Close</button>
                        </>
                    }
                    { deleteStatus === "failed" &&
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
