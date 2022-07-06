import React, { useState } from 'react';
import { GiantState } from '../../types/redux/GiantState';
import { connect } from 'react-redux';
import { Resource } from '../../types/Resource';
import Modal from "../UtilComponents/Modal";
import {deleteBlob} from "../../services/BlobApi";
import {ProgressAnimation} from "../UtilComponents/ProgressAnimation";

type DeleteStatus = "unconfirmed" | "deleting" | "deleted"

export function DeleteButtonModal({ resource }: { resource: Resource | null }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>("unconfirmed");

    if (!resource) {
        return null;
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
            console.error("Error deleting item", e)
        }
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
                    {deleteStatus === "deleted" ? "Item deleted" : "Delete item?"}
                </h2>
                <div className='form__row'>
                    {deleteStatus === "deleted" ? "This item has been successfully deleted."  :
                        "Are you sure you want to delete this item? This action will permanently delete the resource from all collections and datasets."}
                </div>
                <div className='form__row'>
                    { deleteStatus === "deleted" ?
                        <>
                            <button className="btn" onClick={()=>document.location.href="/"}>
                                Giant Home
                            </button>
                            {window.history.length > 1 &&  <button className="btn" onClick={() => window.history.back()}>Back to last page</button>}
                        </> :
                        <>
                            <button className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button className="btn" onClick={deleteItem}>
                                Delete</button>
                            {spinner}
                        </>
                    }
                </div>
            </div>
        </Modal>

        <button className="btn" onClick={() => setModalOpen(true)} title={tooltip} disabled={hasChildResources}>
            Delete
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
