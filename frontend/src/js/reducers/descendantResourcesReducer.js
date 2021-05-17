// Important to note that descendant nodes are lazily fetched when expanded in the UI,
// and that these are stored in a flat structure in Redux to make state updates straightforward.
// Resources in redux - whether the root resource or descendant resources - only ever contain
// information about their direct children. The tree structure is preserved in state simply
// by using URIs as pointers between nodes, rather than having an indefinitely nested structure in memory.
export default function descendantResources(state = {}, action) {
    switch (action.type) {
        case 'RESOURCE_CHILD_GET_RECEIVE':
            return {...state, [action.resource.uri]: action.resource};

        default:
            return state;
    }
}
