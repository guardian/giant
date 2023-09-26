import React, { useState } from 'react';
import { GiantState } from '../../types/redux/GiantState';
import { connect } from 'react-redux';
import { Resource } from '../../types/Resource';
import Modal from "../UtilComponents/Modal";
import {ProgressAnimation} from "../UtilComponents/ProgressAnimation";

type DeleteStatus = "unconfirmed" | "deleting" | "deleted" | "failed";

export function DeleteButtonModal({ resource, deleteBlob, buttonTitle }: { resource: Resource | null, deleteBlob: (blobUri: string) => Promise<Response>, buttonTitle: string | undefined }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>("unconfirmed");

    if (!resource) {
        return null;
    }

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

    const hasChildResources = resource.children.length > 0
    const tooltip = hasChildResources ? "Item cannot be deleted as it has child resources" : "Delete item"

    const deleteItem = async () => {
        try {
            setDeleteStatus("deleting")
            await deleteBlob(resource.uri);
            setDeleteStatus("deleted")
        }
        catch (e){
            setDeleteStatus("failed")        
            console.error("Error deleting item", e)
        }
    }

    const closeModal = () => {
        setDeleteStatus("unconfirmed");
        setModalOpen(false);
    }

    const spinner = deleteStatus === "deleting" ? <ProgressAnimation /> : false;

    return <React.Fragment>
        <Modal
            isOpen={modalOpen}
            isDismissable={false}
            dismiss={() => {}}
        >
            <div className="form form-full-width">
                <h2 className='modal__title'>
                    {modalTitle[deleteStatus]}
                </h2>
                <div className='form__row'>
                    {modalMessage[deleteStatus]}
                </div>
                <div className='form__row'>
                    { deleteStatus === "unconfirmed" &&
                        <>
                            <button className="btn" onClick={closeModal}>Cancel</button>
                            <button className="btn" onClick={deleteItem}>Delete</button>
                        </>
                    }
                    { deleteStatus === "deleted" && 
                        <>
                            <button className="btn" onClick={()=>document.location.href="/"}>Giant Home</button>
                            {(window.history.length > 1) && <button className="btn" onClick={() => window.history.back()}>Back to last page</button>}
                        </>
                    }
                    
                    { deleteStatus === "failed" &&
                        <button className="btn" onClick={closeModal}>Cancel</button>
                    }
                    {spinner}
                </div>
            </div>
        </Modal>

        <button className="btn" onClick={() => setModalOpen(true)} title={tooltip} disabled={hasChildResources}>
            {buttonTitle || 'Delete'}
        </button>
    </React.Fragment>
    ;
}

function mapStateToProps(state: GiantState) {
    return {
        resource: state.resource,
    };
}

export default connect(mapStateToProps)(DeleteButtonModal);
