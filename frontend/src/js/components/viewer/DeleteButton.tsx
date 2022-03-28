import React, { useState } from 'react';
import { GiantState } from '../../types/redux/GiantState';
import { connect } from 'react-redux';
import { Resource } from '../../types/Resource';
import Modal from "../UtilComponents/Modal";
import {deleteBlob} from "../../services/BlobApi";



export function DeleteButton({ resource, isAdmin }: { resource: Resource | null , isAdmin: Boolean}) {
    const [modalOpen, setModalOpen] = useState(false);

    if (!isAdmin || !resource ) {
        return null;
    }

    const deleteItem = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault()
        try {
            await deleteBlob(resource.uri);
            setModalOpen(false)
            // if the user has come from a search this will take them back to the search results
            // in other instances the file will have been opened in a new tab so we'll need to do something else
            window.history.back()
        }
        catch (e){
            console.error("Error deleting item", e)
        }
    }

    return <React.Fragment>
        <Modal
            isOpen={modalOpen}
            dismiss={() => setModalOpen(false)}
        >

            <form className="form" onSubmit={deleteItem}>
                <h2 className='modal__title'>Delete Item?</h2>
                <div className='form__row'>
            Are you sure you want to delete this item? This action will permanently delete the resource from all collections and
            datasets.
                </div>
                <div className='form__row'>
            <button className="btn btn-danger" type='submit'>
            Delete</button>
                </div>
            </form>
        </Modal>
        <button className="btn" onClick={() => setModalOpen(true)}>
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

export default connect(mapStateToProps)(DeleteButton);
