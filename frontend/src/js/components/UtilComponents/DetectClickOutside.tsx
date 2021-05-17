import React, { FunctionComponent, useEffect, useRef } from 'react';

type Props = {
    onClickOutside: (e: MouseEvent) => void,
};

const DetectClickOutside: FunctionComponent<Props> = ({onClickOutside, children}) => {
    const wrapperRef: React.MutableRefObject<HTMLDivElement | null> = useRef(null);

    function handleClickOutside(event: MouseEvent) {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
            onClickOutside(event);
        }
    }

    useEffect(() => {
        // Bind the event listener
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            // Unbind the event listener on clean up
            document.removeEventListener('mousedown', handleClickOutside);
        };
    });
    return <div ref={wrapperRef}>{children}</div>;
};

export default DetectClickOutside;
