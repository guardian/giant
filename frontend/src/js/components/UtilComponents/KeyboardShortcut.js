import { useEffect } from 'react';
import Mousetrap from 'mousetrap';

// We used to use react-keydown that provides a decorator syntax:
//   @keydown('a')
//   function doYourThing() { }
//
// Decorator syntax is not a standard and therefore not supported by create-react-app and others.
//
// Representing the API using a dummy React node is one way to automatically register/unregister
// the listeners as components appear and disappear.
export function KeyboardShortcut({ shortcut, func }) {
    useEffect(() => {
        Mousetrap.bind(shortcut, func);

        return () => {
            Mousetrap.unbind(shortcut);
        };
    });

    return null;
}