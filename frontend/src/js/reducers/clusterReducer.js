export default function cluster(state = {
    nodes: undefined
}, action) {
    switch (action.type) {
        case 'NODES_GET_RECEIVE':
            action.nodes.sort((a, b) => a.hostname.localeCompare(b.hostname));
            return Object.assign({}, state, {
                nodes: action.nodes
            });

        default:
            return state;
    }
}
