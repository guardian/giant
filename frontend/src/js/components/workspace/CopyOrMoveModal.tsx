import React from 'react';

type Props = {
   onSubmit: (action: "copy" | "move") => void
}
export const CopyOrMoveModal = ({onSubmit}: Props) => {

    return (
        <form className='form' >
            <h2>Copy or move items</h2>
            Do you want to copy or move the selected items to the destination workspace?

            <div className='modal-action__buttons'>
                <button
                        className='btn'
                        onClick={() => onSubmit("move")}
                        type='button'>Move</button>


                <button
                    className='btn'
                    onClick={() => onSubmit("copy")}
                    type='button'>Copy</button>
            </div>
        </form>
    );


}
