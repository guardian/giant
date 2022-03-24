import React, { useState } from 'react';
import { GiantState } from '../../types/redux/GiantState';
import { connect } from 'react-redux';
import { Resource } from '../../types/Resource';
import Modal from "../UtilComponents/Modal";
import {deleteBlob} from "../../services/BlobApi";



export function DeleteButton({ resource }: { resource: Resource | null }) {
    const [modalOpen, setModalOpen] = useState(false);

    const isAdmin =true

    if (!resource || !isAdmin) {
        return null;
    }
    console.log(resource.uri)

    const deleteItem = (uri: string) => (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault()
        console.log("woohoo")
        deleteBlob(uri);
        setModalOpen(false)
        window.history.go(-2)
    }

    return <React.Fragment>
        <Modal
            isOpen={modalOpen}
            dismiss={() => setModalOpen(false)}
        >

            <form className="form" onSubmit={deleteItem(resource.uri)}>
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
