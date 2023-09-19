import React, { useState } from 'react';
import { GiantState } from '../../types/redux/GiantState';
import { connect } from 'react-redux';
import Modal from "../UtilComponents/Modal";
import {ProgressAnimation} from "../UtilComponents/ProgressAnimation";

type DeleteStatus = "unconfirmed" | "deleting" | "deleted"

export function DeleteModal({ deleteItemHandler, isOpen, setModalOpen }: 
    { deleteItemHandler: () => void, isOpen: boolean, setModalOpen: (value: boolean) => void }) {
    const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>("unconfirmed");
    
    const deleteItem = async () => {
        try {
            
            setDeleteStatus("deleting");
            deleteItemHandler();
            setDeleteStatus("deleted");
        }
        catch (e){
            console.error("Error deleting item", e);
        }
    }

    const onDismiss = () => {
        setModalOpen(false);
        setDeleteStatus("unconfirmed");
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
                    {deleteStatus === "deleted" ? "Item deleted" : "Delete item?"}
                </h2>
                <div className='form__row'>
                    {deleteStatus === "deleted" ? "This item has been successfully deleted."  :
                        "Are you sure you want to delete this item? This action will permanently delete the resource."}
                </div>
                <div className='form__row btn-group btn-group--left'>
                    { deleteStatus === "deleted" ?
                        <>
                            <button className="btn" onClick={()=>document.location.href="/"}>
                                Giant Home
                            </button>
                            <button className="btn" onClick={onDismiss}>Close</button>
                        </> :
                        <>
                            <button className="btn" onClick={onDismiss}>Cancel</button>
                            <button className="btn" onClick={deleteItem}>
                                Delete</button>
                            {spinner}
                        </>
                    }
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
